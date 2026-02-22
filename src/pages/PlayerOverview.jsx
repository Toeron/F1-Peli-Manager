import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DriverAvatar } from '../components/DriverAvatar'
import Flag from '../components/Flag'
import { getTeamPointsForDriver, getPredictionPoints, getPredictionMatch } from '../utils/scoring'

export default function PlayerOverview() {
    const { raceId, userId } = useParams()
    const { profile: currentUserProfile } = useAuth()
    const [playerProfile, setPlayerProfile] = useState(null)
    const [race, setRace] = useState(null)
    const [team, setTeam] = useState(null)
    const [predictions, setPredictions] = useState({})
    const [raceResults, setRaceResults] = useState({})
    const [drivers, setDrivers] = useState([])
    const [loading, setLoading] = useState(true)
    const [adminSight, setAdminSight] = useState(true)

    useEffect(() => { if (currentUserProfile) loadData() }, [raceId, userId, currentUserProfile])

    async function loadData() {
        const [raceRes, driverRes, teamRes, predRes, profileRes, resultsRes] = await Promise.all([
            supabase.from('races').select('*, circuits(*)').eq('id', raceId).single(),
            supabase.from('drivers').select('*, constructors(*)').eq('active', true),
            supabase.from('team_selections')
                .select('*, driver1:drivers!team_selections_driver1_id_fkey(*, constructors(*)), driver2:drivers!team_selections_driver2_id_fkey(*, constructors(*)), driver3:drivers!team_selections_driver3_id_fkey(*, constructors(*)), driver4:drivers!team_selections_driver4_id_fkey(*, constructors(*))')
                .eq('user_id', userId).eq('race_id', raceId).maybeSingle(),
            supabase.from('predictions').select('*').eq('user_id', userId).eq('race_id', raceId),
            supabase.from('profiles').select('*').eq('id', userId).single(),
            supabase.from('race_results').select('*').eq('race_id', raceId)
        ])

        setRace(raceRes.data)
        setDrivers(driverRes.data || [])
        setTeam(teamRes.data)
        setPlayerProfile(profileRes.data)

        const predMap = {}
        predRes.data?.forEach(p => { predMap[p.session_type] = p })
        setPredictions(predMap)

        const resMap = {}
        resultsRes.data?.forEach(r => {
            if (!resMap[r.session_type]) resMap[r.session_type] = []
            resMap[r.session_type].push(r)
        })
        setRaceResults(resMap)

        setLoading(false)
    }

    function getDriver(id) {
        return drivers.find(d => d.id === id)
    }

    function getDriverPosition(session, driverId) {
        if (!raceResults[session]) return null
        const res = raceResults[session].find(r => r.driver_id === driverId)
        return res ? res.position : null
    }

    function getDriverTotalTeamPoints(driverId) {
        if (!isCompleted || !teamDrivers) return null
        let total = 0
        const tDrivers = teamDrivers.map(d => d.id)
        if (raceResults['qualifying']) {
            const pos = getDriverPosition('qualifying', driverId)
            if (pos) total += getTeamPointsForDriver('qualifying', pos, driverId, tDrivers, predictions)
        }
        if (raceResults['sprint_qualifying']) {
            const pos = getDriverPosition('sprint_qualifying', driverId)
            if (pos) total += getTeamPointsForDriver('sprint_qualifying', pos, driverId, tDrivers, predictions)
        }
        if (raceResults['sprint']) {
            const pos = getDriverPosition('sprint', driverId)
            if (pos) total += getTeamPointsForDriver('sprint', pos, driverId, tDrivers, predictions)
        }
        if (raceResults['race']) {
            const pos = getDriverPosition('race', driverId)
            if (pos) total += getTeamPointsForDriver('race', pos, driverId, tDrivers, predictions)
        }
        return total
    }

    function getPredictionPointsDisplay(session, driverId) {
        if (!isCompleted || !raceResults[session]) return null
        const pos = getDriverPosition(session, driverId)
        if (!pos) return { pts: 0, label: null }
        return {
            pts: getPredictionPoints(session, pos, driverId, predictions),
            match: getPredictionMatch(session, pos, driverId, predictions)
        }
    }

    function formatPrice(val) {
        return '$' + (Number(val) / 1000000).toFixed(1) + 'M'
    }



    if (loading) return <div className="loading"><div className="spinner"></div></div>

    const sessions = [
        ...(race?.is_sprint_weekend ? [{ key: 'sprint_qualifying', label: '🏁 Kwalificatie Sprint', icon: '🏁' }] : []),
        ...(race?.is_sprint_weekend ? [{ key: 'sprint', label: '⚡ Sprintrace', icon: '⚡' }] : []),
        { key: 'qualifying', label: '🏁 Kwalificatie Hoofdrace', icon: '🏁' },
        { key: 'race', label: '🏆 Hoofdrace', icon: '🏆' },
    ]

    const teamDrivers = team ? [team.driver1, team.driver2, team.driver3, team.driver4].filter(Boolean) : []
    const totalCost = teamDrivers.reduce((s, d) => s + Number(d.current_value), 0)

    function isLocked() {
        if (!race?.lock_datetime) return false
        return new Date(race.lock_datetime) <= new Date()
    }

    const isOwner = currentUserProfile?.id === userId
    const isAdmin = currentUserProfile?.is_admin
    const locked = isLocked()
    const isCompleted = race?.status === 'completed'

    // Admin can toggle their "sight" for simulation
    const effectiveAdminSight = isAdmin && adminSight
    const canSeeDetails = isOwner || effectiveAdminSight || locked || isCompleted

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 800 }}>
                {/* Header */}
                <div className="page-header">
                    <div className="page-header-content">
                        <Link to={`/results/${raceId}`} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Terug naar Uitslag</Link>
                        <h1 style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <Flag code={race?.circuits?.country_code} size={36} /> {race?.name}
                            {isAdmin && !isOwner && (
                                <button
                                    onClick={() => setAdminSight(!adminSight)}
                                    style={{
                                        fontSize: '0.7rem',
                                        background: adminSight ? 'var(--amber)' : 'var(--text-muted)',
                                        color: '#000',
                                        padding: '4px 10px',
                                        borderRadius: 6,
                                        fontWeight: 800,
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    {adminSight ? '👁️ ADMIN ZICHT AAN' : '👓 BEKIJK ALS SPELER'}
                                </button>
                            )}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Overzicht van {playerProfile?.display_name || playerProfile?.username}
                        </p>
                    </div>
                </div>

                {/* Team Section */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ margin: 0 }}>🏎️ Gekozen Team</h2>
                    </div>

                    {!canSeeDetails ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
                            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Team is nog geheim</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Je kunt het team van deze speler pas bekijken nadat de race is vergrendeld.
                            </p>
                        </div>
                    ) : teamDrivers.length > 0 ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                                {teamDrivers.map((d, i) => {
                                    const pts = getDriverTotalTeamPoints(d.id)
                                    return (
                                        <div key={i} className="driver-card" style={{ cursor: 'default', position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: d.constructors?.color }} />
                                            <DriverAvatar abbreviation={d.abbreviation} name={`${d.first_name} ${d.last_name}`} src={d.avatar_url} size={84} />
                                            <div className="driver-info">
                                                <div className="driver-name">{d.first_name} {d.last_name}</div>
                                                <div className="driver-team">{d.constructors?.name}</div>
                                            </div>
                                            <div className="driver-price" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                                <div>{formatPrice(d.current_value)}</div>
                                                {pts !== null && (
                                                    <div style={{ background: 'var(--green)', color: '#000', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800 }}>
                                                        +{pts} PNT
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <span>Teamkosten: <strong style={{ color: 'var(--text-primary)' }}>{formatPrice(totalCost)}</strong></span>
                                <span>Budget: <strong style={{ color: 'var(--green)' }}>{formatPrice(playerProfile?.budget)}</strong></span>
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                            <p>Nog geen team gekozen</p>
                            {isOwner && <Link to={`/team/${raceId}`} className="btn btn-primary" style={{ marginTop: 8 }}>Team Kiezen</Link>}
                        </div>
                    )}
                </div>

                {/* Predictions Section */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ margin: 0 }}>🎯 Voorspellingen</h2>
                        {isOwner && <Link to={`/predictions/${raceId}`} className="btn btn-secondary btn-small">Wijzigen</Link>}
                    </div>

                    {!canSeeDetails ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🕵️</div>
                            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Nog even geduld...</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                De voorspellingen worden onthuld zodra de deadline is verstreken.
                            </p>
                        </div>
                    ) : (
                        sessions.map(sess => {
                            const pred = predictions[sess.key]
                            const p1 = pred ? getDriver(pred.p1_driver_id) : null
                            const p2 = pred ? getDriver(pred.p2_driver_id) : null
                            const p3 = pred ? getDriver(pred.p3_driver_id) : null

                            return (
                                <div key={sess.key} style={{ marginBottom: 16 }}>
                                    <h3 style={{ fontSize: '0.95rem', marginBottom: 8, color: 'var(--text-secondary)' }}>
                                        {sess.label}
                                    </h3>

                                    {pred ? (
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'center' }}>
                                            {/* P2 */}
                                            <div style={{ textAlign: 'center', flex: 1, position: 'relative' }}>
                                                <DriverAvatar abbreviation={p2?.abbreviation} name={p2?.last_name} src={p2?.avatar_url} size={88} />
                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: 4 }}>{p2?.last_name}</div>
                                                <div style={{
                                                    background: 'rgba(192,192,192,0.15)', border: '1px solid rgba(192,192,192,0.3)',
                                                    borderRadius: 6, padding: '4px 0', marginTop: 4, fontSize: '0.75rem', fontWeight: 700
                                                }}>P2</div>
                                                {(() => {
                                                    const res = getPredictionPointsDisplay(sess.key, p2?.id)
                                                    if (!res) return null
                                                    return (
                                                        <div style={{ marginTop: 4 }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: res.pts > 0 ? '#00d26a' : 'var(--text-muted)' }}>+{res.pts}</div>
                                                            {res.match === 'exact' && <div style={{ fontSize: '0.6rem', color: '#00d26a' }}>🎯 Exact</div>}
                                                            {res.match === 'close' && <div style={{ fontSize: '0.6rem', color: '#f5a623' }}>≈ Bijna</div>}
                                                        </div>
                                                    )
                                                })()}
                                            </div>

                                            {/* P1 */}
                                            <div style={{ textAlign: 'center', flex: 1, position: 'relative' }}>
                                                <DriverAvatar abbreviation={p1?.abbreviation} name={p1?.last_name} src={p1?.avatar_url} size={104} />
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 4 }}>{p1?.last_name}</div>
                                                <div style={{
                                                    background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)',
                                                    borderRadius: 6, padding: '6px 0', marginTop: 4, fontSize: '0.8rem', fontWeight: 700,
                                                    color: 'gold'
                                                }}>🥇 P1</div>
                                                {(() => {
                                                    const res = getPredictionPointsDisplay(sess.key, p1?.id)
                                                    if (!res) return null
                                                    return (
                                                        <div style={{ marginTop: 4 }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: res.pts > 0 ? '#00d26a' : 'var(--text-muted)' }}>+{res.pts}</div>
                                                            {res.match === 'exact' && <div style={{ fontSize: '0.6rem', color: '#00d26a' }}>🎯 Exact</div>}
                                                            {res.match === 'close' && <div style={{ fontSize: '0.6rem', color: '#f5a623' }}>≈ Bijna</div>}
                                                        </div>
                                                    )
                                                })()}
                                            </div>

                                            {/* P3 */}
                                            <div style={{ textAlign: 'center', flex: 1, position: 'relative' }}>
                                                <DriverAvatar abbreviation={p3?.abbreviation} name={p3?.last_name} src={p3?.avatar_url} size={80} />
                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: 4 }}>{p3?.last_name}</div>
                                                <div style={{
                                                    background: 'rgba(205,127,50,0.15)', border: '1px solid rgba(205,127,50,0.3)',
                                                    borderRadius: 6, padding: '4px 0', marginTop: 4, fontSize: '0.75rem', fontWeight: 700,
                                                    color: '#cd7f32'
                                                }}>P3</div>
                                                {(() => {
                                                    const res = getPredictionPointsDisplay(sess.key, p3?.id)
                                                    if (!res) return null
                                                    return (
                                                        <div style={{ marginTop: 4 }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: res.pts > 0 ? '#00d26a' : 'var(--text-muted)' }}>+{res.pts}</div>
                                                            {res.match === 'exact' && <div style={{ fontSize: '0.6rem', color: '#00d26a' }}>🎯 Exact</div>}
                                                            {res.match === 'close' && <div style={{ fontSize: '0.6rem', color: '#f5a623' }}>≈ Bijna</div>}
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', background: 'var(--bg-input)', borderRadius: 8 }}>
                                            Nog geen voorspelling
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Status bar */}
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <div>
                            {team ? <span style={{ color: 'var(--green)' }}>✅ Team gekozen</span> : <span style={{ color: 'var(--amber)' }}>⏳ Team niet gekozen</span>}
                        </div>
                        {sessions.map(s => (
                            <div key={s.key}>
                                {predictions[s.key]
                                    ? <span style={{ color: 'var(--green)' }}>✅ {s.label}</span>
                                    : <span style={{ color: 'var(--amber)' }}>⏳ {s.label}</span>
                                }
                            </div>
                        ))}
                    </div>
                    {race?.status === 'completed' && (
                        <div style={{ marginTop: 12 }}>
                            <Link to={`/results/${raceId}`} className="btn btn-primary">🏁 Uitslag Bekijken</Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
