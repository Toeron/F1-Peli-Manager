import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DriverAvatar } from '../components/DriverAvatar'
import Flag from '../components/Flag'

export default function RaceOverview() {
    const { raceId } = useParams()
    const { profile } = useAuth()
    const [race, setRace] = useState(null)
    const [team, setTeam] = useState(null)
    const [predictions, setPredictions] = useState({})
    const [drivers, setDrivers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { if (profile) loadData() }, [raceId, profile])

    async function loadData() {
        const [raceRes, driverRes, teamRes, predRes] = await Promise.all([
            supabase.from('races').select('*, circuits(*)').eq('id', raceId).single(),
            supabase.from('drivers').select('*, constructors(*)').eq('active', true),
            supabase.from('team_selections')
                .select('*, driver1:drivers!team_selections_driver1_id_fkey(*, constructors(*)), driver2:drivers!team_selections_driver2_id_fkey(*, constructors(*)), driver3:drivers!team_selections_driver3_id_fkey(*, constructors(*)), driver4:drivers!team_selections_driver4_id_fkey(*, constructors(*))')
                .eq('user_id', profile.id).eq('race_id', raceId).single(),
            supabase.from('predictions').select('*').eq('user_id', profile.id).eq('race_id', raceId)
        ])

        setRace(raceRes.data)
        setDrivers(driverRes.data || [])
        setTeam(teamRes.data)

        const predMap = {}
        predRes.data?.forEach(p => { predMap[p.session_type] = p })
        setPredictions(predMap)
        setLoading(false)
    }

    function getDriver(id) {
        return drivers.find(d => d.id === id)
    }

    function formatPrice(val) {
        return '$' + (Number(val) / 1000000).toFixed(1) + 'M'
    }



    if (loading) return <div className="loading"><div className="spinner"></div></div>

    const sessions = [
        { key: 'qualifying', label: '🏁 Kwalificatie', icon: '🏁' },
        ...(race?.is_sprint_weekend ? [{ key: 'sprint', label: '⚡ Sprint', icon: '⚡' }] : []),
        { key: 'race', label: '🏆 Hoofdrace', icon: '🏆' },
    ]

    const teamDrivers = team ? [team.driver1, team.driver2, team.driver3, team.driver4].filter(Boolean) : []
    const totalCost = teamDrivers.reduce((s, d) => s + Number(d.current_value), 0)

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 800 }}>
                {/* Header */}
                <div className="page-header banner-calendar">
                    <div className="page-header-content">
                        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Dashboard</Link>
                        <h1 style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Flag code={race?.circuits?.country_code} size={36} /> {race?.name}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Ronde {race?.round} — {race?.circuits?.name}, {race?.circuits?.city}
                            {race?.is_sprint_weekend && <span className="badge badge-sprint" style={{ marginLeft: 8 }}>⚡ Sprint</span>}
                        </p>
                    </div>
                </div>

                {/* Team Section */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ margin: 0 }}>🏎️ Mijn Team</h2>
                        <Link to={`/wizard/${raceId}`} className="btn btn-secondary btn-small">Wijzigen</Link>
                    </div>

                    {teamDrivers.length > 0 ? (
                        <>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                gap: 10
                            }}>
                                {teamDrivers.map((d, i) => (
                                    <div key={i} className="driver-card" style={{ cursor: 'default' }}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: d.constructors?.color }} />
                                        <DriverAvatar abbreviation={d.abbreviation} name={`${d.first_name} ${d.last_name}`} src={d.avatar_url} size={84} />
                                        <div className="driver-info">
                                            <div className="driver-name">{d.first_name} {d.last_name}</div>
                                            <div className="driver-team">{d.constructors?.name}</div>
                                            <div className="driver-price" style={{ marginTop: 4 }}>{formatPrice(d.current_value)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <span>Teamkosten: <strong style={{ color: 'var(--text-primary)' }}>{formatPrice(totalCost)}</strong></span>
                                <span>Budget: <strong style={{ color: 'var(--green)' }}>{formatPrice(profile?.budget)}</strong></span>
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                            <p>Nog geen team gekozen</p>
                            <Link to={`/wizard/${raceId}`} className="btn btn-primary" style={{ marginTop: 8 }}>Team Kiezen</Link>
                        </div>
                    )}
                </div>

                {/* Predictions Section */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ margin: 0 }}>🎯 Voorspellingen</h2>
                        <Link to={`/wizard/${raceId}`} className="btn btn-secondary btn-small">Wijzigen</Link>
                    </div>

                    {sessions.map(sess => {
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
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <DriverAvatar abbreviation={p2?.abbreviation} name={p2?.last_name} src={p2?.avatar_url} size={88} />
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: 4 }}>{p2?.last_name}</div>
                                            <div style={{
                                                background: 'rgba(192,192,192,0.15)', border: '1px solid rgba(192,192,192,0.3)',
                                                borderRadius: 6, padding: '4px 0', marginTop: 4, fontSize: '0.75rem', fontWeight: 700
                                            }}>P2</div>
                                        </div>

                                        {/* P1 */}
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <DriverAvatar abbreviation={p1?.abbreviation} name={p1?.last_name} src={p1?.avatar_url} size={104} />
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 4 }}>{p1?.last_name}</div>
                                            <div style={{
                                                background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)',
                                                borderRadius: 6, padding: '6px 0', marginTop: 4, fontSize: '0.8rem', fontWeight: 700,
                                                color: 'gold'
                                            }}>🥇 P1</div>
                                        </div>

                                        {/* P3 */}
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <DriverAvatar abbreviation={p3?.abbreviation} name={p3?.last_name} src={p3?.avatar_url} size={80} />
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: 4 }}>{p3?.last_name}</div>
                                            <div style={{
                                                background: 'rgba(205,127,50,0.15)', border: '1px solid rgba(205,127,50,0.3)',
                                                borderRadius: 6, padding: '4px 0', marginTop: 4, fontSize: '0.75rem', fontWeight: 700,
                                                color: '#cd7f32'
                                            }}>P3</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', background: 'var(--bg-input)', borderRadius: 8 }}>
                                        Nog geen voorspelling
                                    </div>
                                )}
                            </div>
                        )
                    })}
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
