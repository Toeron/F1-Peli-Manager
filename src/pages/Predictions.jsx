import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DriverAvatar } from '../components/DriverAvatar'

export default function Predictions() {
    const { raceId } = useParams()
    const { profile } = useAuth()
    const [race, setRace] = useState(null)
    const [drivers, setDrivers] = useState([])
    const [session, setSession] = useState('qualifying') // qualifying, sprint_qualifying, sprint, race
    const [preds, setPreds] = useState({ qualifying: {}, sprint_qualifying: {}, sprint: {}, race: {} })
    const [existingPreds, setExistingPreds] = useState({})
    const [pickerPos, setPickerPos] = useState(null)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [raceId, profile])

    async function loadData() {
        const { data: raceData } = await supabase
            .from('races').select('*, circuits(*)').eq('id', raceId).single()
        setRace(raceData)

        const { data: driverData } = await supabase
            .from('drivers')
            .select('*, constructors(*)')
            .eq('active', true)

        const sorted = (driverData || []).sort((a, b) => {
            const orderA = a.constructors?.sort_order || 99
            const orderB = b.constructors?.sort_order || 99
            if (orderA !== orderB) return orderA - orderB
            return a.last_name.localeCompare(b.last_name)
        })
        setDrivers(sorted)

        if (profile) {
            const { data: existing } = await supabase
                .from('predictions').select('*')
                .eq('user_id', profile.id).eq('race_id', raceId)

            if (existing?.length) {
                const loaded = {}
                const existMap = {}
                existing.forEach(p => {
                    loaded[p.session_type] = { p1: p.p1_driver_id, p2: p.p2_driver_id, p3: p.p3_driver_id }
                    existMap[p.session_type] = p.id
                })
                setPreds(prev => ({ ...prev, ...loaded }))
                setExistingPreds(existMap)
            }
        }
        setLoading(false)
    }

    function isLocked() {
        if (!race?.lock_datetime) return false
        return new Date(race.lock_datetime) <= new Date()
    }

    function selectDriver(driverId) {
        if (!pickerPos) return
        const { session: sess, position } = pickerPos

        // Remove driver if already placed somewhere in this session
        const current = { ...preds[sess] }
        Object.keys(current).forEach(pos => {
            if (current[pos] === driverId) delete current[pos]
        })
        current[position] = driverId

        setPreds(prev => ({ ...prev, [sess]: current }))
        setPickerPos(null)
        setSaved(false)
    }

    function getDriver(id) {
        return drivers.find(d => d.id === id)
    }

    function sessionComplete(sess) {
        return preds[sess]?.p1 && preds[sess]?.p2 && preds[sess]?.p3
    }

    async function savePredictions() {
        setSaving(true)
        setError('')
        setSaved(false)

        const sessions = ['qualifying', 'race']
        if (race?.is_sprint_weekend) {
            sessions.splice(0, 1, 'sprint_qualifying', 'sprint', 'qualifying')
        }

        for (const sess of sessions) {
            if (!sessionComplete(sess)) continue

            const payload = {
                user_id: profile.id,
                race_id: raceId,
                session_type: sess,
                p1_driver_id: preds[sess].p1,
                p2_driver_id: preds[sess].p2,
                p3_driver_id: preds[sess].p3,
                locked: false
            }

            let result
            if (existingPreds[sess]) {
                result = await supabase.from('predictions').update(payload).eq('id', existingPreds[sess])
            } else {
                result = await supabase.from('predictions').insert(payload)
            }

            if (result.error) {
                setError(`Fout bij ${sess}: ${result.error.message}`)
                setSaving(false)
                return
            }
        }

        setSaved(true)
        setSaving(false)
        await loadData()
    }

    if (loading) return <div className="loading"><div className="spinner"></div></div>

    const locked = isLocked()
    let sessions = ['qualifying', 'race']
    if (race?.is_sprint_weekend) {
        sessions = ['sprint_qualifying', 'sprint', 'qualifying', 'race']
    }

    const sessionLabels = { sprint_qualifying: '🏁 Kwalificatie Sprint', sprint: '⚡ Sprint', qualifying: '🏁 Kwalificatie Hoofdrace', race: '🏆 Hoofdrace' }
    const sessionPoints = { sprint_qualifying: '10% van racepunten', sprint: '25% van racepunten', qualifying: '10% van racepunten', race: 'Volledige WK-punten' }

    return (
        <div className="page">
            <div className="container">
                <div className="page-header banner-predictions">
                    <div className="page-header-content">
                        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Terug</Link>
                        <h1 style={{ marginTop: 8 }}>Voorspellingen</h1>
                        {race && <p>{race.name} — Ronde {race.round}</p>}
                    </div>
                </div>

                {locked && (
                    <div className="card" style={{ marginBottom: 16, textAlign: 'center', borderColor: 'var(--amber)' }}>
                        <p style={{ color: 'var(--amber)' }}>🔒 Voorspellingen zijn gesloten voor dit weekend</p>
                    </div>
                )}

                {/* Points info */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        🎯 <strong>Exact goed = 2× punten</strong> &nbsp;|&nbsp;
                        1 plek ernaast = 50% &nbsp;|&nbsp;
                        2 plekken ernaast = 25%
                    </p>
                </div>

                {/* Session tabs */}
                <div className="session-tabs">
                    {sessions.map(s => (
                        <button key={s} className={`session-tab ${session === s ? 'active' : ''}`} onClick={() => setSession(s)}>
                            {sessionLabels[s]}
                            {sessionComplete(s) && <span style={{ marginLeft: 6, color: 'var(--green)' }}>✓</span>}
                        </button>
                    ))}
                </div>

                {/* Points description */}
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
                    {sessionPoints[session]}
                </p>

                {/* Podium */}
                <div className="podium-container">
                    {/* P2 */}
                    <div className="podium-slot" onClick={() => !locked && setPickerPos({ session, position: 'p2' })}>
                        <div className={`podium-block p2 ${preds[session]?.p2 ? 'filled' : ''}`}>
                            {preds[session]?.p2 ? (
                                <>
                                    <DriverAvatar abbreviation={getDriver(preds[session].p2)?.abbreviation} name={getDriver(preds[session].p2)?.last_name} src={getDriver(preds[session].p2)?.avatar_url} size={80} />
                                    <div className="podium-driver-name">
                                        {getDriver(preds[session].p2)?.last_name}
                                    </div>
                                </>
                            ) : (
                                <div className="podium-placeholder">Kies P2</div>
                            )}
                        </div>
                        <div className="podium-base p2">2</div>
                    </div>

                    {/* P1 */}
                    <div className="podium-slot" onClick={() => !locked && setPickerPos({ session, position: 'p1' })}>
                        <div className={`podium-block p1 ${preds[session]?.p1 ? 'filled' : ''}`}>
                            {preds[session]?.p1 ? (
                                <>
                                    <DriverAvatar abbreviation={getDriver(preds[session].p1)?.abbreviation} name={getDriver(preds[session].p1)?.last_name} src={getDriver(preds[session].p1)?.avatar_url} size={96} />
                                    <div className="podium-driver-name">
                                        {getDriver(preds[session].p1)?.last_name}
                                    </div>
                                </>
                            ) : (
                                <div className="podium-placeholder">Kies P1</div>
                            )}
                        </div>
                        <div className="podium-base p1">1</div>
                    </div>

                    {/* P3 */}
                    <div className="podium-slot" onClick={() => !locked && setPickerPos({ session, position: 'p3' })}>
                        <div className={`podium-block p3 ${preds[session]?.p3 ? 'filled' : ''}`}>
                            {preds[session]?.p3 ? (
                                <>
                                    <DriverAvatar abbreviation={getDriver(preds[session].p3)?.abbreviation} name={getDriver(preds[session].p3)?.last_name} src={getDriver(preds[session].p3)?.avatar_url} size={72} />
                                    <div className="podium-driver-name">
                                        {getDriver(preds[session].p3)?.last_name}
                                    </div>
                                </>
                            ) : (
                                <div className="podium-placeholder">Kies P3</div>
                            )}
                        </div>
                        <div className="podium-base p3">3</div>
                    </div>
                </div>

                {/* Driver picker modal */}
                {pickerPos && (
                    <div className="modal-overlay" onClick={() => setPickerPos(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <h3>Kies coureur voor P{pickerPos.position.replace('p', '')}</h3>
                            {drivers.map(d => {
                                const usedInSession = Object.values(preds[pickerPos.session] || {}).includes(d.id)
                                return (
                                    <div key={d.id} className="modal-driver"
                                        style={{ opacity: usedInSession ? 0.3 : 1 }}
                                        onClick={() => !usedInSession && selectDriver(d.id)}>
                                        <DriverAvatar abbreviation={d.abbreviation} name={`${d.first_name} ${d.last_name}`} src={d.avatar_url} size={72} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>{d.first_name} {d.last_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{d.constructors?.name}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {error && <div className="form-error" style={{ textAlign: 'center', margin: 16 }}>{error}</div>}
                {saved && <div style={{ textAlign: 'center', margin: 16, color: 'var(--green)' }}>✅ Voorspellingen opgeslagen!</div>}

                {!locked && (
                    <button className="btn btn-primary btn-large" style={{ marginTop: 16 }}
                        onClick={savePredictions} disabled={saving}>
                        {saving ? 'Opslaan...' : '🏆 Voorspellingen Opslaan'}
                    </button>
                )}
            </div>
        </div>
    )
}
