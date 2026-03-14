import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Countdown from '../components/Countdown'
import { DriverAvatar } from '../components/DriverAvatar'
import Flag from '../components/Flag'


// ── Sparkline Component ─────────────────────────────────────────────────
function Sparkline({ data, width = 200, height = 50 }) {
    if (!data || data.length < 2) return null

    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const padX = 4
    const padTop = 18  // extra room for text labels above dots
    const padBottom = 4

    const points = data.map((val, i) => {
        const x = padX + (i / (data.length - 1)) * (width - padX * 2)
        const y = height - padBottom - ((val - min) / range) * (height - padTop - padBottom)
        return `${x},${y}`
    })

    const gradientPoints = [
        `${padX},${height - padBottom}`,
        ...points,
        `${padX + ((data.length - 1) / (data.length - 1)) * (width - padX * 2)},${height - padBottom}`
    ]

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--green)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--green)" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <polygon points={gradientPoints.join(' ')} fill="url(#sparkGrad)" />
            <polyline
                points={points.join(' ')}
                fill="none"
                stroke="var(--green)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {data.map((val, i) => {
                const x = padX + (i / (data.length - 1)) * (width - padX * 2)
                const y = height - padBottom - ((val - min) / range) * (height - padTop - padBottom)
                return (
                    <g key={i}>
                        <circle cx={x} cy={y} r="4" fill="var(--bg-card)" stroke="var(--green)" strokeWidth="2" />
                        <text x={x} y={y - 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="600">
                            {val}
                        </text>
                    </g>
                )
            })}
        </svg>
    )
}

export default function Dashboard() {
    const { profile } = useAuth()
    const [nextRace, setNextRace] = useState(null)
    const [allPastRaces, setAllPastRaces] = useState([])
    const [pastRaceIndex, setPastRaceIndex] = useState(0)
    const [myTeam, setMyTeam] = useState(null)
    const [globalRank, setGlobalRank] = useState(null)
    const [leagueRanks, setLeagueRanks] = useState([])
    const [nextRaceScore, setNextRaceScore] = useState(null)
    const [loading, setLoading] = useState(true)

    // New feature states
    const [sparklineData, setSparklineData] = useState([])
    const [sparklineLabels, setSparklineLabels] = useState([])
    const [streaks, setStreaks] = useState([])
    const [accuracy, setAccuracy] = useState(null)
    const [rival, setRival] = useState(null)
    const [bestPrediction, setBestPrediction] = useState(null)


    useEffect(() => { loadData() }, [profile])

    async function loadData() {
        // Get next upcoming race
        const { data: races } = await supabase
            .from('races')
            .select('*, circuits(*)')
            .eq('is_test', false)
            .gte('race_date', new Date().toISOString().split('T')[0])
            .order('race_date', { ascending: true })
            .limit(1)

        if (races?.length) setNextRace(races[0])

        // Get last completed races with results
        const { data: past } = await supabase
            .from('races')
            .select('*, circuits(*)')
            .eq('status', 'completed')
            .order('race_date', { ascending: false })
            .limit(10)

        if (past?.length) {
            // Fetch scores for all fetched past races for this user
            const { data: scores } = await supabase
                .from('user_race_scores')
                .select('*')
                .in('race_id', past.map(r => r.id))
                .eq('user_id', profile?.id)

            const pastWithScores = past.map(r => ({
                ...r,
                myScore: scores?.find(s => s.race_id === r.id)
            }))
            setAllPastRaces(pastWithScores)
        }

        // Get my team for next race
        if (races?.length && profile) {
            const { data: team } = await supabase
                .from('team_selections')
                .select('*, driver1:drivers!team_selections_driver1_id_fkey(*, constructors(*)), driver2:drivers!team_selections_driver2_id_fkey(*, constructors(*)), driver3:drivers!team_selections_driver3_id_fkey(*, constructors(*)), driver4:drivers!team_selections_driver4_id_fkey(*, constructors(*))')
                .eq('user_id', profile.id)
                .eq('race_id', races[0].id)
                .maybeSingle()
            setMyTeam(team)

            // Check if results are already available for this race
            const { data: nScore } = await supabase
                .from('user_race_scores')
                .select('*')
                .eq('race_id', races[0].id)
                .eq('user_id', profile.id)
                .maybeSingle()
            setNextRaceScore(nScore)
        }

        // Calculate custom ranks
        if (profile) {
            const { count: higherGlobal } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gt('total_points', profile.total_points || 0)
            setGlobalRank((higherGlobal || 0) + 1)

            const { data: myLeaguesData } = await supabase
                .from('league_members')
                .select('league_id, leagues(name, is_global)')
                .eq('user_id', profile.id)

            const myCustomLeagues = myLeaguesData?.filter(m => m.leagues && !m.leagues.is_global) || []
            let lRanks = []
            for (const member of myCustomLeagues) {
                const { count: higherInLeague } = await supabase
                    .from('profiles')
                    .select('id, league_members!inner(league_id)', { count: 'exact', head: true })
                    .eq('league_members.league_id', member.league_id)
                    .gt('total_points', profile.total_points || 0)

                lRanks.push({
                    id: member.league_id,
                    name: member.leagues.name,
                    rank: (higherInLeague || 0) + 1
                })
            }
            // Sort by rank ascending
            lRanks.sort((a, b) => a.rank - b.rank)
            setLeagueRanks(lRanks)

            // ── NEW: Load enhanced stats ────────────────────────────
            await loadEnhancedStats(profile, past)
        }

        setLoading(false)
    }

    async function loadEnhancedStats(profile, completedRaces) {
        if (!profile || !completedRaces?.length) return

        // 1. Sparkline: all my scores chronologically
        const { data: allMyScores } = await supabase
            .from('user_race_scores')
            .select('total_points, prediction_points, race_id, races(name, round)')
            .eq('user_id', profile.id)
            .order('races(round)', { ascending: true })

        if (allMyScores?.length) {
            // Sort by round
            const sorted = [...allMyScores].sort((a, b) => (a.races?.round || 0) - (b.races?.round || 0))
            setSparklineData(sorted.map(s => s.total_points))
            setSparklineLabels(sorted.map(s => s.races?.name?.replace(' Grand Prix', '')?.replace('GP ', '') || ''))

            // 7. Best prediction: find race with max prediction_points
            const bestPred = sorted.reduce((best, s) =>
                (s.prediction_points > (best?.prediction_points || 0)) ? s : best, null)
            if (bestPred && bestPred.prediction_points > 0) {
                setBestPrediction({
                    points: bestPred.prediction_points,
                    raceName: bestPred.races?.name || 'Onbekend'
                })
            }
        }

        // 3. Streaks: check consecutive top-N finishes
        const raceIds = completedRaces.map(r => r.id)
        const { data: allScoresForRaces } = await supabase
            .from('user_race_scores')
            .select('user_id, race_id, total_points, prediction_points')
            .in('race_id', raceIds)

        if (allScoresForRaces?.length) {
            const foundStreaks = []

            // Group scores by race_id, calculate rank per race for this user
            const raceGroups = {}
            allScoresForRaces.forEach(s => {
                if (!raceGroups[s.race_id]) raceGroups[s.race_id] = []
                raceGroups[s.race_id].push(s)
            })

            // Sort races from newest to oldest (completedRaces is already newest first)
            let topScorerStreak = 0
            let topPredictorStreak = 0
            let wasTopPredictor = false

            for (const race of completedRaces) {
                const raceScores = raceGroups[race.id] || []
                if (raceScores.length === 0) break

                const sorted = [...raceScores].sort((a, b) => b.total_points - a.total_points)
                const myRank = sorted.findIndex(s => s.user_id === profile.id) + 1

                if (myRank > 0 && myRank <= 3) {
                    topScorerStreak++
                } else {
                    break
                }
            }

            // Check top predictor streak (separate loop for prediction points)
            for (const race of completedRaces) {
                const raceScores = raceGroups[race.id] || []
                if (raceScores.length === 0) break

                const sortedPred = [...raceScores].sort((a, b) => b.prediction_points - a.prediction_points)
                const myPredRank = sortedPred.findIndex(s => s.user_id === profile.id) + 1

                if (myPredRank === 1 && race === completedRaces[0]) {
                    wasTopPredictor = true
                }
                if (myPredRank > 0 && myPredRank <= 3) {
                    topPredictorStreak++
                } else {
                    break
                }
            }

            if (topScorerStreak >= 2) {
                foundStreaks.push({ icon: '🔥', text: `Top 3 scorer ${topScorerStreak} races op rij!` })
            }
            if (wasTopPredictor) {
                foundStreaks.push({ icon: '🔮', text: 'Beste voorspeller vorige race!' })
            } else if (topPredictorStreak >= 2) {
                foundStreaks.push({ icon: '🎯', text: `Top 3 voorspeller ${topPredictorStreak} races op rij!` })
            }

            setStreaks(foundStreaks)
        }

        // 4. Prediction accuracy
        const { data: myPredictions } = await supabase
            .from('predictions')
            .select('race_id, session_type, p1_driver_id, p2_driver_id, p3_driver_id')
            .eq('user_id', profile.id)
            .in('race_id', raceIds)

        const { data: raceResults } = await supabase
            .from('race_results')
            .select('race_id, session_type, driver_id, position')
            .in('race_id', raceIds)
            .lte('position', 20) // top 20

        if (myPredictions?.length && raceResults?.length) {
            let totalDiff = 0
            let totalComparisons = 0
            let exactMatches = 0

            myPredictions.forEach(pred => {
                const sessionResults = raceResults.filter(
                    r => r.race_id === pred.race_id && r.session_type === pred.session_type
                )
                if (sessionResults.length === 0) return

                const predicted = [
                    { driverId: pred.p1_driver_id, predPos: 1 },
                    { driverId: pred.p2_driver_id, predPos: 2 },
                    { driverId: pred.p3_driver_id, predPos: 3 }
                ]

                predicted.forEach(({ driverId, predPos }) => {
                    const actual = sessionResults.find(r => r.driver_id === driverId)
                    if (actual) {
                        const diff = Math.abs(actual.position - predPos)
                        totalDiff += diff
                        totalComparisons++
                        if (diff === 0) exactMatches++
                    }
                })
            })

            if (totalComparisons > 0) {
                setAccuracy({
                    avgDiff: (totalDiff / totalComparisons).toFixed(1),
                    exactPct: Math.round((exactMatches / totalComparisons) * 100),
                    exactCount: exactMatches,
                    totalPredictions: totalComparisons
                })
            }
        }

        // 6. Head-to-head rival
        const myPoints = profile.total_points || 0
        const myGlobalRank = ((await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('total_points', myPoints)).count || 0) + 1

        if (myGlobalRank === 1) {
            // I'm #1, show how far ahead of #2
            const { data: runner } = await supabase
                .from('profiles')
                .select('id, username, display_name, total_points, avatar_url')
                .lt('total_points', myPoints)
                .order('total_points', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (runner) {
                setRival({
                    type: 'leading',
                    player: runner,
                    diff: myPoints - runner.total_points
                })
            }
        } else {
            // Show the player just above me
            const { data: above } = await supabase
                .from('profiles')
                .select('id, username, display_name, total_points, avatar_url')
                .gt('total_points', myPoints)
                .order('total_points', { ascending: true })
                .limit(1)
                .maybeSingle()

            if (above) {
                setRival({
                    type: 'chasing',
                    player: above,
                    diff: above.total_points - myPoints
                })
            }
        }
    }

    function formatBudget(amount) {
        if (!amount) return '$0'
        return '$' + (amount / 1000000).toFixed(1) + 'M'
    }

    function getRankStyle(rank) {
        if (rank === 1) return { color: '#FFD700', textShadow: '0 0 10px rgba(255, 215, 0, 0.4)' }
        if (rank === 2) return { color: '#C0C0C0', textShadow: '0 0 10px rgba(192, 192, 192, 0.3)' }
        if (rank === 3) return { color: '#CD7F32', textShadow: '0 0 10px rgba(205, 127, 50, 0.3)' }
        return {}
    }

    function getRankLabel(rank) {
        if (rank === 1) return { color: '#FFD700' }
        if (rank === 2) return { color: '#C0C0C0' }
        if (rank === 3) return { color: '#CD7F32' }
        return {}
    }

    if (loading) return <div className="loading"><div className="spinner"></div></div>

    return (
        <div className="page">
            <div className="container">
                <div className="page-header banner-dashboard">
                    <div className="page-header-content">
                        <h1>Dashboard</h1>
                        <p>Welkom terug, {profile?.display_name || profile?.username}!</p>
                    </div>
                </div>

                {/* Stats overview */}
                <div className="stats-row">
                    <div className="stat-card">
                        <div className="stat-value">{formatBudget(profile?.budget)}</div>
                        <div className="stat-label">Budget</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{profile?.total_points || 0}</div>
                        <div className="stat-label">Punten</div>
                    </div>
                    <Link to="/leagues?tab=global" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                        <div className="stat-value" style={getRankStyle(globalRank)}>P{globalRank || '—'}</div>
                        <div className="stat-label" style={getRankLabel(globalRank)}>Wereld</div>
                    </Link>
                    {leagueRanks.map(lr => (
                        <Link key={lr.id} to={`/leagues?tab=leagues&leagueId=${lr.id}`} className="stat-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                            <div className="stat-value" style={getRankStyle(lr.rank)}>P{lr.rank}</div>
                            <div className="stat-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px', ...getRankLabel(lr.rank) }} title={lr.name}>
                                {lr.name}
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Next race hero */}
                {nextRace && (
                    <div className="card card-glow" style={{ marginBottom: 24, textAlign: 'center' }}>
                        <h2>Volgende Race</h2>
                        <div style={{ fontSize: '2.5rem', marginBottom: 4 }}>
                            <Flag code={nextRace.circuits?.country_code} size={48} />
                        </div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>{nextRace.name}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 4 }}>
                            {nextRace.circuits?.name} — {nextRace.circuits?.city}
                        </p>
                        {nextRace.is_sprint_weekend && <span className="badge badge-sprint">⚡ Sprint Weekend</span>}
                        <div style={{ margin: '16px 0' }}>
                            <Countdown targetDate={nextRace.lock_datetime} />
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 16 }}>
                            Voorspellingen sluiten 5 minuten voor de kwalificatie
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {nextRaceScore && (
                                <Link to={`/results/${nextRace.id}`} className="btn btn-pulse-green" style={{ border: 'none' }}>
                                    📊 Bekijk Tussenstand
                                </Link>
                            )}
                            {new Date() < new Date(nextRace.lock_datetime) && (
                                <Link to={`/wizard/${nextRace.id}`} className="btn btn-primary">⚙️ Mijn Team & Voorspelling</Link>
                            )}
                            <Link to={`/race/${nextRace.id}`} className="btn btn-secondary">📋 Mijn Overzicht</Link>
                        </div>
                    </div>
                )}

                {/* Last race results summary with paging */}
                {allPastRaces.length > 0 && (
                    <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--green)', position: 'relative' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 250px' }}>
                                {allPastRaces.length > 1 && (
                                    <button
                                        onClick={() => setPastRaceIndex(prev => Math.min(prev + 1, allPastRaces.length - 1))}
                                        disabled={pastRaceIndex === allPastRaces.length - 1}
                                        className="btn-icon"
                                        style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pastRaceIndex === allPastRaces.length - 1 ? 'default' : 'pointer', opacity: pastRaceIndex === allPastRaces.length - 1 ? 0.3 : 1 }}
                                    >
                                        ◀
                                    </button>
                                )}
                                <div>
                                    <h2 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {pastRaceIndex === 0 ? 'Laatste Race Resultaat' : `Eerdere Race (${pastRaceIndex + 1}/${allPastRaces.length})`}
                                    </h2>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Flag code={allPastRaces[pastRaceIndex].circuits?.country_code} /> {allPastRaces[pastRaceIndex].name}
                                    </h3>
                                </div>
                            </div>

                            {/* Quick link middle */}
                            <div style={{ flex: '1 1 150px', display: 'flex', justifyContent: 'center' }}>
                                <Link to={`/results/${allPastRaces[pastRaceIndex].id}?tab=race`} className="btn btn-pulse-green btn-small" style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                                    🏁 Uitslag Race
                                </Link>
                            </div>

                            <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)' }}>
                                        {allPastRaces[pastRaceIndex].myScore?.total_points || 0}
                                        <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>PNT</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
                                        <Link to={`/results/${allPastRaces[pastRaceIndex].id}/player/${profile?.id}`} style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 700 }}>Mijn details →</Link>
                                    </div>
                                </div>
                                {allPastRaces.length > 1 && (
                                    <button
                                        onClick={() => setPastRaceIndex(prev => Math.max(prev - 1, 0))}
                                        disabled={pastRaceIndex === 0}
                                        className="btn-icon"
                                        style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pastRaceIndex === 0 ? 'default' : 'pointer', opacity: pastRaceIndex === 0 ? 0.3 : 1 }}
                                    >
                                        ▶
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* My Team */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <h2>Mijn Team {nextRace ? `— ${nextRace.name}` : ''}</h2>
                    {myTeam ? (
                        <div className="driver-grid-display" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 12
                        }}>
                            {[myTeam.driver1, myTeam.driver2, myTeam.driver3, myTeam.driver4].map((d, i) => d && (
                                <div key={i} className="driver-card" style={{ cursor: 'default' }}>
                                    <DriverAvatar abbreviation={d.abbreviation} name={`${d.first_name} ${d.last_name}`} src={d.avatar_url} size={80} />
                                    <div className="driver-info">
                                        <div className="driver-name" style={{ fontSize: '0.85rem' }}>{d.first_name} {d.last_name}</div>
                                        <div className="driver-team">{d.constructors?.name}</div>
                                        <div className="driver-price" style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600, marginTop: 4 }}>
                                            {formatBudget(d.current_value)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                            <p>Je hebt nog geen team gekozen voor het komende weekend.</p>
                            {nextRace && <Link to={`/wizard/${nextRace.id}`} className="btn btn-primary" style={{ marginTop: 12 }}>Team Kiezen</Link>}
                        </div>
                    )}
                </div>

                {/* ── Insights Section (secondary) ───────────────────── */}

                {/* Sparkline */}
                {sparklineData.length >= 2 && (
                    <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <h2 style={{ fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                                📈 Puntenverloop Per Race
                            </h2>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {sparklineData.length} races
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', padding: '8px 0' }}>
                            <Sparkline data={sparklineData} width={Math.max(200, sparklineData.length * 80)} height={60} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 4px 0', gap: 4 }}>
                            {sparklineLabels.map((label, i) => (
                                <div key={i} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Jouw Stats (Streaks + Accuracy + Best Prediction) */}
                {(streaks.length > 0 || accuracy || bestPrediction) && (
                    <div className="card" style={{ marginBottom: 24 }}>
                        <h2 style={{ fontSize: '0.85rem', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                            ⭐ Jouw Statistieken
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                            {/* Streaks */}
                            {streaks.map((s, i) => (
                                <div key={i} style={{
                                    background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.08), rgba(255, 69, 0, 0.04))',
                                    borderRadius: 12,
                                    padding: '12px 16px',
                                    border: '1px solid rgba(255, 140, 0, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10
                                }}>
                                    <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FF8C00' }}>{s.text}</span>
                                </div>
                            ))}

                            {/* Accuracy */}
                            {accuracy && (
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(0, 200, 150, 0.08), rgba(0, 150, 200, 0.04))',
                                    borderRadius: 12,
                                    padding: '12px 16px',
                                    border: '1px solid rgba(0, 200, 150, 0.15)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: '1.3rem' }}>🎯</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Voorspel Accuracy</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                                        <div>
                                            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)' }}>{accuracy.avgDiff}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>pos. ernaast</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            <span style={{ fontWeight: 700, color: '#FFD700' }}>{accuracy.exactPct}%</span> exact goed
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}> ({accuracy.exactCount}/{accuracy.totalPredictions})</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Best Prediction */}
                            {bestPrediction && (
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(160, 100, 255, 0.08), rgba(100, 50, 200, 0.04))',
                                    borderRadius: 12,
                                    padding: '12px 16px',
                                    border: '1px solid rgba(160, 100, 255, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10
                                }}>
                                    <span style={{ fontSize: '1.5rem' }}>🎰</span>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Beste Voorspelling</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                                            <span style={{ color: '#A064FF' }}>{bestPrediction.points} punten</span>
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> bij {bestPrediction.raceName}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Head-to-Head Rival */}
                {rival && (
                    <div className="card" style={{
                        marginBottom: 24,
                        background: rival.type === 'leading'
                            ? 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,215,0,0.02))'
                            : 'linear-gradient(135deg, rgba(255,60,60,0.06), rgba(255,60,60,0.02))',
                        border: rival.type === 'leading'
                            ? '1px solid rgba(255,215,0,0.15)'
                            : '1px solid rgba(255,60,60,0.15)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '2rem' }}>⚔️</span>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 4 }}>
                                    {rival.type === 'leading' ? 'Jij leidt!' : 'Jouw rivaal'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div className="nav-avatar" style={{
                                        width: 44, height: 44, fontSize: '1.1rem', overflow: 'hidden',
                                        border: '2px solid ' + (rival.type === 'leading' ? 'rgba(255,215,0,0.4)' : 'rgba(255,60,60,0.4)')
                                    }}>
                                        {rival.player.avatar_url ? (
                                            <img src={rival.player.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            (rival.player.display_name || rival.player.username || '?')[0].toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                                            {rival.player.display_name || rival.player.username}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {rival.player.total_points} punten
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                textAlign: 'center',
                                padding: '8px 20px',
                                borderRadius: 12,
                                background: rival.type === 'leading'
                                    ? 'rgba(255,215,0,0.1)'
                                    : 'rgba(255,60,60,0.1)',
                            }}>
                                <div style={{
                                    fontSize: '1.6rem',
                                    fontWeight: 800,
                                    color: rival.type === 'leading' ? '#FFD700' : '#FF4444'
                                }}>
                                    {rival.diff}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    {rival.type === 'leading' ? 'voorsprong' : 'achterstand'}
                                </div>
                            </div>
                        </div>
                        {rival.type === 'chasing' && (
                            <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                💪 Nog {rival.diff} {rival.diff === 1 ? 'punt' : 'punten'} en je haalt {rival.player.display_name || rival.player.username} in!
                            </div>
                        )}
                    </div>
                )}


            </div>
        </div>
    )
}
