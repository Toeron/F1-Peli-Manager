import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DriverAvatar } from '../components/DriverAvatar'
import Flag from '../components/Flag'

export default function RaceResults() {
    const { raceId } = useParams()
    const { profile } = useAuth()
    const [race, setRace] = useState(null)
    const [results, setResults] = useState({ qualifying: [], sprint: [], race: [] })
    const [predictions, setPredictions] = useState({})
    const [team, setTeam] = useState(null)
    const [scores, setScores] = useState(null)
    const [drivers, setDrivers] = useState([])
    const [leaderboard, setLeaderboard] = useState([])
    const [activeTab, setActiveTab] = useState('race')
    const [loading, setLoading] = useState(true)
    const [myLeagues, setMyLeagues] = useState([])
    const [selectedLeagueId, setSelectedLeagueId] = useState('global')
    const [leagueMembers, setLeagueMembers] = useState(null)

    useEffect(() => { if (profile) loadData() }, [raceId, profile])

    useEffect(() => {
        if (selectedLeagueId === 'global') {
            setLeagueMembers(null)
            return
        }
        async function fetchMembers() {
            const { data } = await supabase.from('league_members').select('user_id').eq('league_id', selectedLeagueId)
            if (data) setLeagueMembers(data.map(m => m.user_id))
        }
        if (selectedLeagueId) fetchMembers()
    }, [selectedLeagueId])

    async function loadData() {
        const [raceRes, driverRes, resultRes, predRes, teamRes, scoreRes, leaderRes, leaguesRes] = await Promise.all([
            supabase.from('races').select('*, circuits(*)').eq('id', raceId).single(),
            supabase.from('drivers').select('*, constructors(*)').eq('active', true),
            supabase.from('race_results').select('*, drivers(*, constructors(*))').eq('race_id', raceId).eq('verified', true).order('position'),
            supabase.from('predictions').select('*').eq('user_id', profile.id).eq('race_id', raceId),
            supabase.from('team_selections')
                .select('driver1_id, driver2_id, driver3_id, driver4_id')
                .eq('user_id', profile.id).eq('race_id', raceId).maybeSingle(),
            supabase.from('user_race_scores').select('*').eq('user_id', profile.id).eq('race_id', raceId).maybeSingle(),
            supabase.from('user_race_scores')
                .select('*, profiles(username, display_name, avatar_url)')
                .eq('race_id', raceId)
                .order('total_points', { ascending: false }),
            supabase.from('league_members')
                .select('league_id, leagues(id, name, is_global)')
                .eq('user_id', profile.id)
        ])

        const raceData = raceRes.data
        setRace(raceData)
        setDrivers(driverRes.data || [])

        // Group results by session
        const grouped = { qualifying: [], sprint: [], race: [] }
        resultRes.data?.forEach(r => { if (grouped[r.session_type]) grouped[r.session_type].push(r) })
        setResults(grouped)

        // Map predictions
        const predMap = {}
        predRes.data?.forEach(p => { predMap[p.session_type] = p })
        setPredictions(predMap)

        setTeam(teamRes.data)
        setScores(scoreRes.data)
        setLeaderboard(leaderRes.data || [])

        const leaguesList = leaguesRes.data
            ?.map(m => m.leagues)
            .filter(l => l && !l.is_global) || []
        setMyLeagues(leaguesList)

        // Default to leaderboard if race is completed and leaderboard has data
        if (raceData?.status === 'completed' && leaderRes.data?.length > 0) {
            setActiveTab('leaderboard')
        }

        setLoading(false)
    }

    function isMyTeamDriver(driverId) {
        if (!team) return false
        return [team.driver1_id, team.driver2_id, team.driver3_id, team.driver4_id].includes(driverId)
    }

    function getPredictionPoints(session, position, driverId) {
        const pred = predictions[session]
        if (!pred) return 0

        let predPos = null
        if (pred.p1_driver_id === driverId) predPos = 1
        else if (pred.p2_driver_id === driverId) predPos = 2
        else if (pred.p3_driver_id === driverId) predPos = 3

        if (!predPos) return 0

        let base = 0
        if (session === 'race') {
            const ptsArr = [25, 18, 15]
            base = ptsArr[predPos - 1]
        } else {
            const ptsArr = [8, 7, 6]
            base = ptsArr[predPos - 1]
        }

        const dist = Math.abs(position - predPos)
        const mult = dist === 0 ? 1.0 : (dist === 1 ? 0.5 : (dist === 2 ? 0.25 : 0))
        return Math.round(base * mult)
    }

    function getTeamPointsForDriver(session, position, driverId) {
        if (!isMyTeamDriver(driverId)) return 0

        let base = 0
        if (session === 'race') {
            const ptsArr = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
            base = position <= 10 ? ptsArr[position - 1] : 0
        } else if (session === 'qualifying') {
            base = position <= 8 ? (9 - position) : 0
        } else if (session === 'sprint') {
            const ptsArr = [8, 7, 6, 5, 4, 3, 2, 1]
            base = position <= 8 ? Math.round(ptsArr[position - 1] * 0.25) : 0
        }

        const multiplier = getSynergyMultiplier(session, position, driverId) || 1.0
        return Math.round(base * multiplier)
    }

    function getPredictionMatch(session, position, driverId) {
        const pred = predictions[session]
        if (!pred) return null
        if (position === 1 && pred.p1_driver_id === driverId) return 'exact'
        if (position === 2 && pred.p2_driver_id === driverId) return 'exact'
        if (position === 3 && pred.p3_driver_id === driverId) return 'exact'
        const predDrivers = [pred.p1_driver_id, pred.p2_driver_id, pred.p3_driver_id]
        if (position <= 3 && predDrivers.includes(driverId)) return 'close'
        return null
    }

    function getSynergyMultiplier(session, position, driverId) {
        if (!isMyTeamDriver(driverId) || position > 3) return null
        const pred = predictions[activeTab]
        if (!pred) return null

        let predPos = null
        if (pred.p1_driver_id === driverId) predPos = 1
        else if (pred.p2_driver_id === driverId) predPos = 2
        else if (pred.p3_driver_id === driverId) predPos = 3

        if (!predPos) return null

        const dist = Math.abs(position - predPos)
        if (dist === 0) return 2.0
        if (dist === 1) return 1.5
        if (dist === 2) return 1.25
        return null
    }

    function getPredictionLabel(match) {
        if (match === 'exact') return { text: '🎯 Exact!', color: '#00d26a' }
        if (match === 'close') return { text: '≈ Bijna', color: '#f5a623' }
        return null
    }



    if (loading) return <div className="loading"><div className="spinner"></div></div>

    const sessionResults = results[activeTab] || []
    const sessionLabels = { qualifying: '🏁 Kwalificatie', sprint: '⚡ Sprint', race: '🏆 Hoofdrace', leaderboard: '📊 Ranglijst' }
    const sessions = ['qualifying', ...(race?.is_sprint_weekend ? ['sprint'] : []), 'race', 'leaderboard']
    const breakdown = scores?.breakdown || {}

    const filteredLeaderboard = selectedLeagueId === 'global' || !leagueMembers
        ? leaderboard
        : leaderboard.filter(entry => leagueMembers.includes(entry.user_id))

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 900 }}>
                {/* Header */}
                <div className="page-header" style={{ textAlign: 'center' }}>
                    <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Dashboard</Link>
                    <div style={{ fontSize: '2.5rem', marginTop: 8 }}>
                        <Flag code={race?.circuits?.country_code} size={48} />
                    </div>
                    <h1 style={{ marginTop: 4 }}>{race?.name}</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Ronde {race?.round} — {race?.circuits?.name}
                    </p>
                </div>

                {/* Points summary (Session-based) */}
                <div className="card card-glow" style={{ marginBottom: 20, textAlign: 'center' }}>
                    <h2 style={{ margin: '0 0 12px', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                        Weekend Resultaten {race?.status === 'completed' ? '🏁' : '⏳'}
                    </h2>

                    {scores ? (
                        <>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--green)', marginBottom: 12 }}>
                                {scores.total_points} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>punten</span>
                            </div>
                            <div className="stats-row" style={{ gap: 6 }}>
                                <div className="stat-card" style={{ padding: '8px 12px', flex: 1 }}>
                                    <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--green)' }}>
                                        {(breakdown.team_qualifying || 0) + (breakdown.pred_qualifying || 0)}
                                    </div>
                                    <div className="stat-label" style={{ fontSize: '0.7rem' }}>Kwalificatie</div>
                                </div>
                                {race?.is_sprint_weekend && (
                                    <div className="stat-card" style={{ padding: '8px 12px', flex: 1 }}>
                                        <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--green)' }}>
                                            {(breakdown.team_sprint || 0) + (breakdown.pred_sprint || 0)}
                                        </div>
                                        <div className="stat-label" style={{ fontSize: '0.7rem' }}>Sprint</div>
                                    </div>
                                )}
                                <div className="stat-card" style={{ padding: '8px 12px', flex: 1 }}>
                                    <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--green)' }}>
                                        {(breakdown.team_race || 0) + (breakdown.pred_race || 0)}
                                    </div>
                                    <div className="stat-label" style={{ fontSize: '0.7rem' }}>Hoofdrace</div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: 20 }}>
                            <p style={{ color: 'var(--text-muted)' }}>
                                {race?.status === 'completed'
                                    ? "Resultaten zijn opgeslagen, maar de scores voor de spelers moeten nog worden berekend door de admin."
                                    : "Zodra de admin de uitslagen heeft ingevoerd en berekend, verschijnen hier jouw behaalde punten."}
                            </p>
                        </div>
                    )}
                </div>

                {/* Session tabs */}
                <div className="session-tabs" style={{ marginBottom: 4 }}>
                    {sessions.map(s => (
                        <button key={s} className={`session-tab ${activeTab === s ? 'active' : ''}`}
                            onClick={() => setActiveTab(s)}>
                            {sessionLabels[s]}
                        </button>
                    ))}
                </div>

                {/* Leaderboard Tab Content */}
                {activeTab === 'leaderboard' ? (
                    <div className="card">
                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>🏆 Weekend Ranglijst</h2>
                                {myLeagues.length > 0 && (
                                    <select
                                        value={selectedLeagueId}
                                        onChange={(e) => setSelectedLeagueId(e.target.value)}
                                        className="form-input"
                                        style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.85rem', width: 'auto', minWidth: 160 }}
                                    >
                                        <option value="global">🌍 Wereldranglijst</option>
                                        {myLeagues.map(l => (
                                            <option key={l.id} value={l.id}>🏆 {l.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <span className="badge" style={{ background: 'var(--green)', color: '#000' }}>Ronde {race?.round}</span>
                        </div>
                        <div className="table-container">
                            <table style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}>Pos</th>
                                        <th>Gebruiker</th>
                                        <th style={{ textAlign: 'right' }}>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeaderboard.map((entry, idx) => (
                                        <tr key={entry.id} style={{
                                            opacity: entry.user_id === profile.id ? 1 : 0.8,
                                            background: entry.user_id === profile.id ? 'rgba(0, 210, 106, 0.05)' : 'transparent',
                                            borderLeft: entry.user_id === profile.id ? '3px solid var(--green)' : 'none'
                                        }}>
                                            <td style={{ fontWeight: 800 }}>
                                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                            </td>
                                            <td>
                                                <Link
                                                    to={`/results/${raceId}/player/${entry.user_id}`}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit', transition: 'opacity 0.2s' }}
                                                    className="hover-opacity"
                                                >
                                                    <div className="nav-avatar" style={{ width: 64, height: 64, fontSize: '1.6rem', overflow: 'hidden' }}>
                                                        {entry.profiles?.avatar_url ? (
                                                            <img src={entry.profiles.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            (entry.profiles?.username || '?')[0].toUpperCase()
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{entry.profiles?.display_name || entry.profiles?.username}</div>
                                                        {entry.user_id === profile.id && <div style={{ fontSize: '0.65rem', color: 'var(--green)' }}>Jijzelf</div>}
                                                    </div>
                                                </Link>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)', fontSize: '1.1rem' }}>
                                                {entry.total_points}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredLeaderboard.length === 0 && (
                                        <tr>
                                            <td colSpan="3" style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                                                Nog geen scores berekend voor deze race.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: 20, textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                Benieuwd naar de totale tussenstand?
                            </p>
                            <Link to="/leagues" className="btn btn-primary" style={{ width: '100%' }}>
                                🏆 Bekijk Algemeen Klassement
                            </Link>
                        </div>
                    </div>
                ) : (
                    /* Existing Results / Podium Content */
                    sessionResults.length > 0 ? (
                        <div className="results-grid">
                            <div className="results-podium">
                                {sessionResults.slice(0, 3).map((r, i) => {
                                    const match = getPredictionMatch(activeTab, r.position, r.driver_id)
                                    const matchLabel = getPredictionLabel(match)
                                    const isTeam = isMyTeamDriver(r.driver_id)
                                    const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32']
                                    const podiumHeights = [140, 110, 90]

                                    return (
                                        <div key={r.id} className="results-podium-slot" style={{ order: [1, 0, 2][i] }}>
                                            <div style={{ position: 'relative' }}>
                                                <DriverAvatar abbreviation={r.drivers?.abbreviation} name={r.drivers?.last_name} src={r.drivers?.avatar_url} size={i === 0 ? 128 : 104} />
                                                {isTeam && (
                                                    <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--green)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>🏎️</div>
                                                )}
                                            </div>
                                            <div style={{ fontWeight: 700, marginTop: 6, fontSize: i === 0 ? '0.95rem' : '0.85rem' }}>
                                                {r.drivers?.last_name}
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '4px 10px', marginTop: 6, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                <div style={{ fontWeight: 800, color: 'var(--green)', fontSize: '1rem' }}>
                                                    {getTeamPointsForDriver(activeTab, r.position, r.driver_id) + getPredictionPoints(activeTab, r.position, r.driver_id)}
                                                    <span style={{ fontSize: '0.6rem', marginLeft: 2, verticalAlign: 'middle', opacity: 0.8 }}>PNT</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, fontSize: '0.7rem', opacity: 0.8 }}>
                                                    {isTeam && <span>🏎️ {getTeamPointsForDriver(activeTab, r.position, r.driver_id)}</span>}
                                                    {getPredictionPoints(activeTab, r.position, r.driver_id) > 0 && <span>🎯 {getPredictionPoints(activeTab, r.position, r.driver_id)}</span>}
                                                </div>
                                            </div>
                                            {matchLabel && <div style={{ fontSize: '0.7rem', color: matchLabel.color, fontWeight: 700, marginTop: 4 }}>{matchLabel.text}</div>}
                                            {getSynergyMultiplier(activeTab, r.position, r.driver_id) && (
                                                <div style={{ fontSize: '0.65rem', background: 'gold', color: '#000', borderRadius: 4, padding: '1px 6px', fontWeight: 800, marginTop: 4 }}>
                                                    ⚡ SYNERGY {getSynergyMultiplier(activeTab, r.position, r.driver_id)}x
                                                </div>
                                            )}
                                            <div style={{
                                                width: '100%', height: podiumHeights[i], marginTop: 12,
                                                background: `linear-gradient(180deg, ${podiumColors[i]}33, ${podiumColors[i]}11)`,
                                                border: `2px solid ${podiumColors[i]}55`, borderRadius: '8px 8px 0 0',
                                                display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10, fontSize: '1.5rem', fontWeight: 800, color: podiumColors[i]
                                            }}>P{r.position}</div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="results-list" style={{ marginTop: 20 }}>
                                {sessionResults.slice(3).map(r => {
                                    const match = getPredictionMatch(activeTab, r.position, r.driver_id)
                                    const matchLabel = getPredictionLabel(match)
                                    const isTeam = isMyTeamDriver(r.driver_id)

                                    return (
                                        <div key={r.id} className={`results-row ${isTeam ? 'results-row-team' : ''}`}>
                                            <div className="results-pos" style={{ fontWeight: 800, width: 36, textAlign: 'center', fontSize: '0.9rem' }}>
                                                {r.is_dnf ? 'DNF' : `P${r.position}`}
                                            </div>
                                            <DriverAvatar abbreviation={r.drivers?.abbreviation} name={r.drivers?.last_name} src={r.drivers?.avatar_url} size={72} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                    {r.drivers?.first_name} {r.drivers?.last_name}
                                                    {isTeam && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--green)' }}>🏎️ Mijn team</span>}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: r.drivers?.constructors?.color, marginRight: 4 }}></span>
                                                    {r.drivers?.constructors?.name}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                                <div style={{ fontWeight: 800, color: (isTeam || getPredictionPoints(activeTab, r.position, r.driver_id) > 0) ? 'var(--green)' : 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1 }}>
                                                    {getTeamPointsForDriver(activeTab, r.position, r.driver_id) + getPredictionPoints(activeTab, r.position, r.driver_id)}
                                                    <span style={{ fontSize: '0.6rem', marginLeft: 2, fontWeight: 400, opacity: 0.7 }}>PNT</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    {isTeam && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            🏎️ {getTeamPointsForDriver(activeTab, r.position, r.driver_id)}
                                                            {getSynergyMultiplier(activeTab, r.position, r.driver_id) && <span style={{ color: 'gold', fontSize: '0.65rem', fontWeight: 800 }}>⚡{getSynergyMultiplier(activeTab, r.position, r.driver_id)}x</span>}
                                                        </span>
                                                    )}
                                                    {getPredictionPoints(activeTab, r.position, r.driver_id) > 0 && <span style={{ fontSize: '0.75rem', color: '#00d26a', display: 'flex', alignItems: 'center', gap: 2 }}>🎯 {getPredictionPoints(activeTab, r.position, r.driver_id)}</span>}
                                                </div>
                                                {matchLabel && <div style={{ fontSize: '0.65rem', color: matchLabel.color, fontWeight: 700, marginTop: 1 }}>{matchLabel.text}</div>}
                                                {r.is_fastest_lap && <div style={{ fontSize: '0.65rem', color: '#a855f7' }}>⏱️ Snelste ronde</div>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: '1.2rem' }}>🏁</p>
                            <p>Nog geen uitslagen voor deze sessie</p>
                        </div>
                    )
                )}

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <Link to="/history" className="btn btn-secondary btn-small">🕒 Terug naar Historie</Link>
                </div>
            </div>
        </div>
    )
}
