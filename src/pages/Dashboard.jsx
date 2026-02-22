import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Countdown from '../components/Countdown'
import { DriverAvatar } from '../components/DriverAvatar'
import Flag from '../components/Flag'

export default function Dashboard() {
    const { profile } = useAuth()
    const [nextRace, setNextRace] = useState(null)
    const [allPastRaces, setAllPastRaces] = useState([])
    const [pastRaceIndex, setPastRaceIndex] = useState(0)
    const [myTeam, setMyTeam] = useState(null)
    const [globalRank, setGlobalRank] = useState(null)
    const [leagueRanks, setLeagueRanks] = useState([])
    const [loading, setLoading] = useState(true)

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
                    name: member.leagues.name,
                    rank: (higherInLeague || 0) + 1
                })
            }
            // Sort by rank ascending
            lRanks.sort((a, b) => a.rank - b.rank)
            setLeagueRanks(lRanks)
        }

        setLoading(false)
    }

    function formatBudget(amount) {
        if (!amount) return '$0'
        return '$' + (amount / 1000000).toFixed(1) + 'M'
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
                    <div className="stat-card">
                        <div className="stat-value">P{globalRank || '—'}</div>
                        <div className="stat-label">Wereld</div>
                    </div>
                    {leagueRanks.map(lr => (
                        <div key={lr.name} className="stat-card">
                            <div className="stat-value">P{lr.rank}</div>
                            <div className="stat-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }} title={lr.name}>
                                {lr.name}
                            </div>
                        </div>
                    ))}
                </div>

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
                                <Link to={`/results/${allPastRaces[pastRaceIndex].id}?tab=race`} className="btn btn-secondary btn-small" style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>
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
                                        <Link to={`/results/${allPastRaces[pastRaceIndex].id}?tab=leaderboard`} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tussenstand →</Link>
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
                            <Link to={`/team/${nextRace.id}`} className="btn btn-primary">🏎️ Team Kiezen</Link>
                            <Link to={`/predictions/${nextRace.id}`} className="btn btn-secondary">🏆 Voorspellen</Link>
                            <Link to={`/race/${nextRace.id}`} className="btn btn-secondary">📋 Overzicht</Link>
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
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                            <p>Je hebt nog geen team gekozen voor het komende weekend.</p>
                            {nextRace && <Link to={`/team/${nextRace.id}`} className="btn btn-primary" style={{ marginTop: 12 }}>Team Kiezen</Link>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
