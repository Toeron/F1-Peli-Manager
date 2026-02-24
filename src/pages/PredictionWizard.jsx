import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DriverAvatar } from '../components/DriverAvatar'

export default function PredictionWizard() {
    const { raceId } = useParams()
    const { profile } = useAuth()
    const navigate = useNavigate()

    const [race, setRace] = useState(null)
    const [drivers, setDrivers] = useState([])

    // Team state
    const [selectedTeam, setSelectedTeam] = useState([])
    const [existingTeamId, setExistingTeamId] = useState(null)
    const [teamLocked, setTeamLocked] = useState(false)

    // Predictions state
    const [preds, setPreds] = useState({ qualifying: {}, sprint_qualifying: {}, sprint: {}, race: {} })
    const [existingPredsId, setExistingPredsId] = useState({})
    const [pickerPos, setPickerPos] = useState(null)

    // Wizard state
    const [activeTabIdx, setActiveTabIdx] = useState(0)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [raceId, profile])

    async function loadData() {
        if (!profile) return

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

        // Load existing team
        const { data: team } = await supabase
            .from('team_selections')
            .select('*')
            .eq('user_id', profile.id)
            .eq('race_id', raceId)
            .single()

        if (team) {
            setExistingTeamId(team.id)
            setSelectedTeam([team.driver1_id, team.driver2_id, team.driver3_id, team.driver4_id].filter(Boolean))
            setTeamLocked(team.locked)
        }

        // Load existing predictions
        const { data: existingPreds } = await supabase
            .from('predictions').select('*')
            .eq('user_id', profile.id).eq('race_id', raceId)

        if (existingPreds?.length) {
            const loaded = {}
            const existMap = {}
            existingPreds.forEach(p => {
                loaded[p.session_type] = { p1: p.p1_driver_id, p2: p.p2_driver_id, p3: p.p3_driver_id }
                existMap[p.session_type] = p.id
            })
            setPreds(prev => ({ ...prev, ...loaded }))
            setExistingPredsId(existMap)
        }

        setLoading(false)
    }

    function isRaceLocked() {
        if (!race?.lock_datetime) return false
        return new Date(race.lock_datetime) <= new Date()
    }

    const locked = isRaceLocked()

    // Tab definitions
    const tabs = [
        { id: 'team', label: '🏎️ Team' },
        ...(race?.is_sprint_weekend ? [
            { id: 'sprint_qualifying', label: '🏁 Kwali Sprint' },
            { id: 'sprint', label: '⚡ Sprint' }
        ] : []),
        { id: 'qualifying', label: '🏁 Kwalificatie' },
        { id: 'race', label: '🏆 Hoofdrace' }
    ]

    const activeTabObj = tabs[activeTabIdx]

    // === TEAM LOGIC ===
    function totalCost() {
        return drivers.filter(d => selectedTeam.includes(d.id))
            .reduce((sum, d) => sum + Number(d.current_value), 0)
    }

    function canAfford() {
        return totalCost() <= Number(profile?.budget || 0)
    }

    function usedConstructors() {
        return drivers.filter(d => selectedTeam.includes(d.id)).map(d => d.constructor_id)
    }

    function toggleDriver(driverId) {
        if (teamLocked || locked) return
        if (selectedTeam.includes(driverId)) {
            setSelectedTeam(selectedTeam.filter(id => id !== driverId))
        } else {
            if (selectedTeam.length >= 4) return
            const driver = drivers.find(d => d.id === driverId)
            const used = usedConstructors()
            if (used.includes(driver.constructor_id)) return
            setSelectedTeam([...selectedTeam, driverId])
        }
        setError('')
        setSuccessMsg('')
    }

    async function saveTeam() {
        if (selectedTeam.length !== 4) { setError('Kies precies 4 coureurs'); return false }
        if (!canAfford()) { setError('Te weinig budget!'); return false }
        if (locked) { setError('Voorspellingen zijn gesloten'); return false }

        setSaving(true)
        setError('')

        const payload = {
            user_id: profile.id,
            race_id: raceId,
            driver1_id: selectedTeam[0],
            driver2_id: selectedTeam[1],
            driver3_id: selectedTeam[2],
            driver4_id: selectedTeam[3],
            total_cost: totalCost(),
            locked: false
        }

        let result
        if (existingTeamId) {
            result = await supabase.from('team_selections').update(payload).eq('id', existingTeamId)
        } else {
            result = await supabase.from('team_selections').insert(payload).select().single()
            if (result.data) setExistingTeamId(result.data.id)
        }

        setSaving(false)
        if (result.error) {
            setError(result.error.message)
            return false
        }
        return true
    }

    function formatPrice(val) {
        return '$' + (Number(val) / 1000000).toFixed(1) + 'M'
    }

    // === PREDICTIONS LOGIC ===
    function selectPredDriver(driverId) {
        if (!pickerPos) return
        const { session: sess, position } = pickerPos

        const current = { ...preds[sess] }
        Object.keys(current).forEach(pos => {
            if (current[pos] === driverId) delete current[pos]
        })
        current[position] = driverId

        setPreds(prev => ({ ...prev, [sess]: current }))
        setPickerPos(null)
        setSuccessMsg('')
        setError('')
    }

    function getDriver(id) {
        return drivers.find(d => d.id === id)
    }

    function sessionComplete(sess) {
        return preds[sess]?.p1 && preds[sess]?.p2 && preds[sess]?.p3
    }

    async function savePrediction() {
        const sess = activeTabObj.id
        if (!sessionComplete(sess)) {
            setError('Kies alle coureurs voor deze sessie (P1, P2, P3)')
            return false
        }
        if (locked) { setError('Voorspellingen zijn gesloten'); return false }

        setSaving(true)
        setError('')

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
        if (existingPredsId[sess]) {
            result = await supabase.from('predictions').update(payload).eq('id', existingPredsId[sess])
        } else {
            result = await supabase.from('predictions').insert(payload).select().single()
            if (result.data) {
                setExistingPredsId(prev => ({ ...prev, [sess]: result.data.id }))
            }
        }

        setSaving(false)
        if (result.error) {
            setError(`Fout bij opslaan: ${result.error.message}`)
            return false
        }
        return true
    }

    // === WIZARD NAVIGATION ===
    async function handleNext() {
        let success = false
        if (activeTabObj.id === 'team') {
            success = await saveTeam()
        } else {
            success = await savePrediction()
        }

        if (success) {
            if (activeTabIdx < tabs.length - 1) {
                setActiveTabIdx(activeTabIdx + 1)
                setSuccessMsg('')
            } else {
                navigate(`/race/${raceId}`)
            }
        }
    }

    function handleTabClick(index) {
        setActiveTabIdx(index)
        setError('')
        setSuccessMsg('')
    }

    if (loading) return <div className="loading"><div className="spinner"></div></div>

    // Render logic for content based on active tab
    return (
        <div className="page">
            <div className="container">
                <div className="page-header banner-predictions">
                    <div className="page-header-content">
                        <Link to={`/race/${raceId}`} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Terug naar race</Link>
                        <h1 style={{ marginTop: 8 }}>Mijn Team & Voorspelling</h1>
                        {race && <p>{race.name} — Ronde {race.round}</p>}
                    </div>
                </div>

                {locked && (
                    <div className="card" style={{ marginBottom: 16, textAlign: 'center', borderColor: 'var(--amber)' }}>
                        <p style={{ color: 'var(--amber)' }}>🔒 Selectie is gesloten voor dit weekend</p>
                    </div>
                )}

                {/* Tabs */}
                <div className="session-tabs" style={{ marginBottom: 20 }}>
                    {tabs.map((t, i) => {
                        let isComplete = false
                        if (t.id === 'team') isComplete = selectedTeam.length === 4
                        else isComplete = sessionComplete(t.id)

                        return (
                            <button
                                key={t.id}
                                className={`session-tab ${activeTabIdx === i ? 'active' : ''}`}
                                onClick={() => handleTabClick(i)}
                            >
                                {t.label}
                                {isComplete && <span style={{ marginLeft: 6, color: 'var(--green)' }}>✓</span>}
                            </button>
                        )
                    })}
                </div>

                {error && <div className="form-error" style={{ textAlign: 'center', marginBottom: 16 }}>{error}</div>}
                {successMsg && <div style={{ textAlign: 'center', margin: 16, color: 'var(--green)' }}>{successMsg}</div>}

                {/* --- TEAM TAB CONTENT --- */}
                {activeTabObj.id === 'team' && (
                    <>
                        {/* Sticky Budget & selection info */}
                        <div className="sticky-stats" style={{ top: 60 }}>
                            <div className="stats-row" style={{ marginBottom: 0 }}>
                                <div className="stat-card">
                                    <div className="stat-value" style={{ color: 'var(--green)' }}>
                                        {formatPrice(Number(profile?.budget || 0) - totalCost())}
                                    </div>
                                    <div className="stat-label">Resterend</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value" style={{ color: canAfford() ? 'var(--text-primary)' : 'var(--red)' }}>
                                        {formatPrice(totalCost())}
                                    </div>
                                    <div className="stat-label">Kosten</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{selectedTeam.length}/4</div>
                                    <div className="stat-label">Gekozen</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 24 }}>
                            {drivers.map(d => {
                                const isSelected = selectedTeam.includes(d.id)
                                const constructorUsed = !isSelected && usedConstructors().includes(d.constructor_id)
                                const teamFull = !isSelected && selectedTeam.length >= 4
                                const tooExpensive = !isSelected && (totalCost() + Number(d.current_value) > Number(profile?.budget || 0))
                                const disabled = constructorUsed || teamFull || tooExpensive || locked || teamLocked

                                return (
                                    <div key={d.id}
                                        className={`driver-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${tooExpensive ? 'insufficient-budget' : ''}`}
                                        style={{ '--team-color': d.constructors?.color || '#444' }}
                                        onClick={() => !disabled && toggleDriver(d.id)}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: d.constructors?.color }} />
                                        <DriverAvatar abbreviation={d.abbreviation} name={`${d.first_name} ${d.last_name}`} src={d.avatar_url} size={80} />
                                        <div className="driver-info">
                                            <div className="driver-name">{d.first_name} {d.last_name}</div>
                                            <div className="driver-team">{d.constructors?.name} #{d.number}</div>
                                        </div>
                                        <div className="driver-price" style={{ color: tooExpensive && !isSelected ? 'var(--red)' : '' }}>
                                            {formatPrice(d.current_value)}
                                        </div>
                                        {isSelected && <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>}
                                        {tooExpensive && !isSelected && <span style={{ fontSize: '0.65rem', color: 'var(--red)', fontWeight: 600 }}>Geen budget</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* --- PREDICTION TABS CONTENT --- */}
                {activeTabObj.id !== 'team' && (
                    <>
                        <div className="card" style={{ marginBottom: 16 }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                🎯 <strong>Exact goed = 2× punten</strong> &nbsp;|&nbsp;
                                1 plek ernaast = 50% &nbsp;|&nbsp;
                                2 plekken ernaast = 25%
                            </p>
                        </div>

                        {/* Podium */}
                        <div className="podium-container" style={{ padding: '40px 0' }}>
                            {/* P2 */}
                            <div className="podium-slot" onClick={() => !locked && setPickerPos({ session: activeTabObj.id, position: 'p2' })}>
                                <div className={`podium-block p2 ${preds[activeTabObj.id]?.p2 ? 'filled' : ''}`}>
                                    {preds[activeTabObj.id]?.p2 ? (
                                        <>
                                            <DriverAvatar abbreviation={getDriver(preds[activeTabObj.id].p2)?.abbreviation} name={getDriver(preds[activeTabObj.id].p2)?.last_name} src={getDriver(preds[activeTabObj.id].p2)?.avatar_url} size={80} />
                                            <div className="podium-driver-name">
                                                {getDriver(preds[activeTabObj.id].p2)?.last_name}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="podium-placeholder">Kies P2</div>
                                    )}
                                </div>
                                <div className="podium-base p2">2</div>
                            </div>

                            {/* P1 */}
                            <div className="podium-slot" onClick={() => !locked && setPickerPos({ session: activeTabObj.id, position: 'p1' })}>
                                <div className={`podium-block p1 ${preds[activeTabObj.id]?.p1 ? 'filled' : ''}`}>
                                    {preds[activeTabObj.id]?.p1 ? (
                                        <>
                                            <DriverAvatar abbreviation={getDriver(preds[activeTabObj.id].p1)?.abbreviation} name={getDriver(preds[activeTabObj.id].p1)?.last_name} src={getDriver(preds[activeTabObj.id].p1)?.avatar_url} size={96} />
                                            <div className="podium-driver-name">
                                                {getDriver(preds[activeTabObj.id].p1)?.last_name}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="podium-placeholder">Kies P1</div>
                                    )}
                                </div>
                                <div className="podium-base p1">1</div>
                            </div>

                            {/* P3 */}
                            <div className="podium-slot" onClick={() => !locked && setPickerPos({ session: activeTabObj.id, position: 'p3' })}>
                                <div className={`podium-block p3 ${preds[activeTabObj.id]?.p3 ? 'filled' : ''}`}>
                                    {preds[activeTabObj.id]?.p3 ? (
                                        <>
                                            <DriverAvatar abbreviation={getDriver(preds[activeTabObj.id].p3)?.abbreviation} name={getDriver(preds[activeTabObj.id].p3)?.last_name} src={getDriver(preds[activeTabObj.id].p3)?.avatar_url} size={72} />
                                            <div className="podium-driver-name">
                                                {getDriver(preds[activeTabObj.id].p3)?.last_name}
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
                        {pickerPos && pickerPos.session === activeTabObj.id && (
                            <div className="modal-overlay" onClick={() => setPickerPos(null)}>
                                <div className="modal" onClick={e => e.stopPropagation()}>
                                    <h3>Kies coureur voor P{pickerPos.position.replace('p', '')}</h3>
                                    {drivers.map(d => {
                                        const usedInSession = Object.values(preds[activeTabObj.id] || {}).includes(d.id)
                                        return (
                                            <div key={d.id} className="modal-driver"
                                                style={{ opacity: usedInSession ? 0.3 : 1 }}
                                                onClick={() => !usedInSession && selectPredDriver(d.id)}>
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
                    </>
                )}

                {/* BOTTOM NAVIGATION ACTIONS */}
                {!locked && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                        <button
                            className="btn btn-primary btn-large"
                            style={{ flex: 1 }}
                            onClick={handleNext}
                            disabled={saving}
                        >
                            {saving ? 'Opslaan...' : (activeTabIdx === tabs.length - 1 ? '🏁 Opslaan & Afronden' : '💾 Opslaan & Volgende →')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
