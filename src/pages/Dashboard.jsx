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
    const [lastRace, setLastRace] = useState(null)
    const [myTeam, setMyTeam] = useState(null)
    const [leaderboard, setLeaderboard] = useState([])
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

        // Get last completed race with results
        const { data: pastRaces } = await supabase
            .from('races')
            .select('*, circuits(*)')
            .eq('status', 'completed')
            .order('race_date', { ascending: false })
            .limit(1)

        if (pastRaces?.length) {
            const { data: lastScore } = await supabase
                .from('user_race_scores')
                .select('*')
                .eq('race_id', pastRaces[0].id)
                .eq('user_id', profile?.id)
                .maybeSingle()

            setLastRace({ ...pastRaces[0], myScore: lastScore })
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

        // Top 5 leaderboard
        const { data: top } = await supabase
            .from('profiles')
            .select('username, display_name, total_points')
            .order('total_points', { ascending: false })
            .limit(5)
        setLeaderboard(top || [])

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
                        <div className="stat-value">—</div>
                        <div className="stat-label">Ranglijst</div>
                    </div>
                </div>

                {/* Last race results summary */}
                {lastRace && (
                    <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--green)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Laatste Race Resultaat</h2>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Flag code={lastRace.circuits?.country_code} /> {lastRace.name}
                                </h3>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)' }}>
                                    {lastRace.myScore?.total_points || 0}
                                    <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>PNT</span>
                                </div>
                                <Link to={`/results/${lastRace.id}`} style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600 }}>Bekijk details →</Link>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
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

                {/* Mini Leaderboard */}
                <div className="card">
                    <h2>Top 5 — Wereldranglijst</h2>
                    {leaderboard.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead><tr><th>#</th><th>Speler</th><th>Punten</th></tr></thead>
                                <tbody>
                                    {leaderboard.map((p, i) => (
                                        <tr key={i} className={p.username === profile?.username ? 'highlight' : ''}>
                                            <td style={{ fontWeight: 700 }}>{i + 1}</td>
                                            <td>
                                                {lastRace ? (
                                                    <Link to={`/results/${lastRace.id}/player/${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover-opacity">
                                                        {p.display_name || p.username}
                                                    </Link>
                                                ) : (
                                                    p.display_name || p.username
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{p.total_points}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                            Het seizoen is nog niet begonnen — sta jij straks bovenaan?
                        </p>
                    )}
                    <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <Link to="/leagues" className="btn btn-secondary btn-small">Wereldranglijst →</Link>
                        <Link to="/history" className="btn btn-secondary btn-small">Uitslagen Historie →</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
