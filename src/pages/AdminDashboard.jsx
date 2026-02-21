import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

export default function AdminDashboard() {
    const { profile } = useAuth()
    const [races, setRaces] = useState([])
    const [drivers, setDrivers] = useState([])
    const [constructors, setConstructors] = useState([])
    const [selectedRace, setSelectedRace] = useState('')
    const [selectedSession, setSelectedSession] = useState('qualifying')
    const [results, setResults] = useState([])
    const [tab, setTab] = useState('results')
    const [log, setLog] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => { loadData() }, [])

    if (profile && !profile.is_admin) return <Navigate to="/" />

    async function loadData() {
        const { data: raceData } = await supabase
            .from('races').select('*, circuits(*)').order('round')
        setRaces(raceData || [])
        if (raceData?.length && !selectedRace) setSelectedRace(raceData[0].id)

        const { data: driverData } = await supabase
            .from('drivers').select('*, constructors(*)').order('last_name')
        setDrivers(driverData || [])

        const { data: constructorData } = await supabase
            .from('constructors').select('*').order('name')
        setConstructors(constructorData || [])

        setLoading(false)
    }

    useEffect(() => {
        if (selectedRace && selectedSession) loadResults()
    }, [selectedRace, selectedSession])

    async function loadResults() {
        const { data } = await supabase
            .from('race_results')
            .select('*, drivers(first_name, last_name, abbreviation)')
            .eq('race_id', selectedRace)
            .eq('session_type', selectedSession)
            .order('position')
        setResults(data || [])
    }

    function addLog(msg) {
        setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    }

    // Build empty result rows for all 20 positions
    function getPositionRows() {
        const maxPos = selectedSession === 'sprint' ? 8 : 20
        const rows = []
        for (let i = 1; i <= maxPos; i++) {
            const existing = results.find(r => r.position === i)
            rows.push({
                position: i,
                driver_id: existing?.driver_id || '',
                points_awarded: existing?.points_awarded || 0,
                is_dnf: existing?.is_dnf || false,
                is_fastest_lap: existing?.is_fastest_lap || false,
                id: existing?.id || null
            })
        }
        return rows
    }

    const [positionRows, setPositionRows] = useState([])
    useEffect(() => {
        setPositionRows(getPositionRows())
    }, [results, selectedSession])

    function updateRow(position, field, value) {
        setPositionRows(prev => prev.map(r =>
            r.position === position ? { ...r, [field]: value } : r
        ))
    }

    // Auto-calculate points based on position
    function autoCalcPoints(position, session) {
        const racePoints = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
        const sprintPoints = [8, 7, 6, 5, 4, 3, 2, 1]
        if (session === 'sprint') return position <= 8 ? sprintPoints[position - 1] : 0
        if (session === 'qualifying') return 0
        return position <= 10 ? racePoints[position - 1] : 0
    }

    function setDriverForPosition(position, driverId) {
        const pts = driverId ? autoCalcPoints(position, selectedSession) : 0
        setPositionRows(prev => prev.map(r =>
            r.position === position ? { ...r, driver_id: driverId, points_awarded: pts } : r
        ))
    }

    async function saveResults() {
        setSaving(true)
        addLog(`Opslaan ${selectedSession} resultaten...`)

        // Delete existing results for this race/session
        await supabase.from('race_results')
            .delete()
            .eq('race_id', selectedRace)
            .eq('session_type', selectedSession)

        // Insert new rows (only those with a driver selected)
        const rowsToInsert = positionRows
            .filter(r => r.driver_id)
            .map(r => ({
                race_id: selectedRace,
                session_type: selectedSession,
                driver_id: r.driver_id,
                position: r.position,
                points_awarded: r.points_awarded,
                is_dnf: r.is_dnf,
                is_fastest_lap: r.is_fastest_lap,
                verified: true
            }))

        const { error } = await supabase.from('race_results').insert(rowsToInsert)
        if (error) {
            addLog(`❌ Fout: ${error.message}`)
        } else {
            addLog(`✅ ${rowsToInsert.length} resultaten opgeslagen voor ${selectedSession}`)
        }
        await loadResults()
        setSaving(false)
    }

    async function deleteResults() {
        if (!window.confirm(`Weet je zeker dat je ALLE resultaten voor de ${selectedSession} van race ${selectedRaceObj?.name} wilt wissen?`)) return

        setSaving(true)
        addLog(`🗑️ Wissen van ${selectedSession} resultaten...`)

        const { error } = await supabase.from('race_results')
            .delete()
            .eq('race_id', selectedRace)
            .eq('session_type', selectedSession)

        if (error) {
            addLog(`❌ Fout bij wissen: ${error.message}`)
        } else {
            addLog(`✅ Uitslag gewist voor ${selectedSession}`)
        }
        await loadResults()
        setSaving(false)
    }

    async function resetSeason() {
        const confirmText = window.prompt("LET OP: DIT VERWIJDERT ALLE VOORTGANG VAN ALLE SPELERS!\n\nDit wist alle uitslagen, punten, voorspellingen en teams, en reset alle budgetten naar $100M.\n\nType 'RESET' in hoofdletters om te bevestigen:")
        if (confirmText !== 'RESET') {
            if (confirmText !== null) addLog("❌ Reset geannuleerd: onjuiste bevestiging.")
            return
        }

        setSaving(true)
        addLog("🚨 STARTING FULL SEASON RESET...")

        const { data, error } = await supabase.rpc('reset_season_data')

        if (error) {
            addLog(`❌ Fout bij resetten: ${error.message}`)
        } else {
            addLog(`✅ Reset voltooid: ${data}`)
        }

        await loadData()
        setSaving(false)
    }

    async function calculatePoints() {
        setSaving(true)
        addLog('🔄 Punten berekenen...')

        const { data, error } = await supabase.rpc('apply_race_scores', { p_race_id: selectedRace })
        if (error) {
            addLog(`❌ Fout: ${error.message}`)
        } else {
            addLog(`✅ ${data}`)
        }

        // Mark race as completed
        await supabase.from('races').update({ status: 'completed' }).eq('id', selectedRace)
        addLog('✅ Race status → completed')

        setSaving(false)
    }

    async function updatePrices() {
        setSaving(true)
        addLog('💰 Coureurprijzen bijwerken...')

        const { data, error } = await supabase.rpc('update_driver_prices', { p_race_id: selectedRace })
        if (error) {
            addLog(`❌ Fout: ${error.message}`)
        } else {
            addLog(`✅ ${data}`)
        }
        await loadData()
        setSaving(false)
    }

    async function updateDriver(driverId, updates) {
        setSaving(true)
        const { error } = await supabase
            .from('drivers')
            .update(updates)
            .eq('id', driverId)

        if (error) {
            addLog(`❌ Fout bij bijwerken coureur: ${error.message}`)
        } else {
            addLog(`✅ Coureur ${driverId.split('-')[0]}... bijgewerkt`)
            await loadData()
        }
        setSaving(false)
    }

    function getDriverName(id) {
        const d = drivers.find(d => d.id === id)
        return d ? `${d.first_name} ${d.last_name}` : ''
    }

    function formatPrice(val) {
        return '$' + (Number(val) / 1000000).toFixed(1) + 'M'
    }

    const selectedRaceObj = races.find(r => r.id === selectedRace)

    const [showAddForm, setShowAddForm] = useState(false)
    const [newDriver, setNewDriver] = useState({
        first_name: '',
        last_name: '',
        abbreviation: '',
        number: '',
        constructor_id: '',
        current_value: 10000000,
        active: true
    })

    async function handleAddDriver(e) {
        e.preventDefault()
        setSaving(true)
        const { error } = await supabase
            .from('drivers')
            .insert([{
                ...newDriver,
                base_value: newDriver.current_value,
                number: parseInt(newDriver.number)
            }])

        if (error) {
            addLog(`❌ Fout bij toevoegen coureur: ${error.message}`)
        } else {
            addLog(`✅ Coureur ${newDriver.last_name} toegevoegd!`)
            setShowAddForm(false)
            setNewDriver({ first_name: '', last_name: '', abbreviation: '', number: '', constructor_id: '', current_value: 10000000, active: true })
            await loadData()
        }
        setSaving(false)
    }

    if (loading) return <div className="loading"><div className="spinner"></div></div>

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>⚙️ Admin Dashboard</h1>
                </div>

                {/* Tabs */}
                <div className="session-tabs" style={{ marginBottom: 16 }}>
                    <button className={`session-tab ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>
                        🏁 Uitslagen Invoeren
                    </button>
                    <button className={`session-tab ${tab === 'drivers' ? 'active' : ''}`} onClick={() => setTab('drivers')}>
                        👤 Beheer Coureurs
                    </button>
                    <button className={`session-tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>
                        📋 Log ({log.length})
                    </button>
                </div>

                {/* ============= RESULTS TAB ============= */}
                {tab === 'results' && (
                    <>
                        {/* Race selector */}
                        <div className="grid-2" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label>Race</label>
                                <select className="form-input" value={selectedRace} onChange={e => setSelectedRace(e.target.value)}>
                                    {races.map(r => (
                                        <option key={r.id} value={r.id}>
                                            R{r.round} — {r.name} {r.status === 'completed' ? '✓' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Sessie</label>
                                <select className="form-input" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                                    <option value="qualifying">Kwalificatie</option>
                                    {selectedRaceObj?.is_sprint_weekend && <option value="sprint">Sprint</option>}
                                    <option value="race">Hoofdrace</option>
                                </select>
                            </div>
                        </div>

                        {/* Results table */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Pos</th>
                                            <th>Coureur</th>
                                            <th>Punten</th>
                                            <th>DNF</th>
                                            <th>FL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {positionRows.map(row => (
                                            <tr key={row.position}>
                                                <td style={{ fontWeight: 700 }}>P{row.position}</td>
                                                <td>
                                                    <select className="form-input" style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                                                        value={row.driver_id} onChange={e => setDriverForPosition(row.position, e.target.value)}>
                                                        <option value="">— Kies coureur —</option>
                                                        {drivers.map(d => (
                                                            <option key={d.id} value={d.id}>{d.abbreviation} — {d.first_name} {d.last_name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input className="form-input" type="number" style={{ width: 60, padding: '6px 8px', fontSize: '0.85rem' }}
                                                        value={row.points_awarded}
                                                        onChange={e => updateRow(row.position, 'points_awarded', Number(e.target.value))} />
                                                </td>
                                                <td>
                                                    <input type="checkbox" checked={row.is_dnf}
                                                        onChange={e => updateRow(row.position, 'is_dnf', e.target.checked)} />
                                                </td>
                                                <td>
                                                    <input type="checkbox" checked={row.is_fastest_lap}
                                                        onChange={e => updateRow(row.position, 'is_fastest_lap', e.target.checked)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" onClick={saveResults} disabled={saving}>
                                💾 Uitslag Opslaan
                            </button>
                            <button className="btn btn-secondary" onClick={calculatePoints} disabled={saving}
                                style={{ background: 'rgba(0,210,106,0.15)', borderColor: 'var(--green)' }}>
                                🧮 Punten Berekenen
                            </button>
                            <button className="btn btn-secondary" onClick={updatePrices} disabled={saving}
                                style={{ background: 'rgba(245,166,35,0.15)', borderColor: 'var(--amber)' }}>
                                💰 Prijzen Bijwerken
                            </button>
                            <button className="btn btn-secondary" onClick={deleteResults} disabled={saving}
                                style={{ background: 'rgba(255, 36, 66, 0.15)', borderColor: 'var(--red)', color: 'var(--red)', marginLeft: 'auto' }}>
                                🗑️ Uitslag Wissen
                            </button>
                        </div>
                    </>
                )}

                {/* ============= DRIVERS TAB ============= */}
                {tab === 'drivers' && (
                    <div className="card">
                        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Beheer Coureurs</h2>
                            <button className="btn btn-primary btn-small" onClick={() => setShowAddForm(!showAddForm)}>
                                {showAddForm ? '✕ Annuleren' : '➕ Rijder Toevoegen'}
                            </button>
                        </div>

                        {showAddForm && (
                            <form onSubmit={handleAddDriver} className="card" style={{ background: 'rgba(255,255,255,0.03)', marginBottom: 24, padding: 20, border: '1px solid var(--border)' }}>
                                <div className="grid-3">
                                    <div className="form-group">
                                        <label>Voornaam</label>
                                        <input className="form-input" required value={newDriver.first_name} onChange={e => setNewDriver({ ...newDriver, first_name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Achternaam</label>
                                        <input className="form-input" required value={newDriver.last_name} onChange={e => setNewDriver({ ...newDriver, last_name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Afk. (bijv. VER)</label>
                                        <input className="form-input" required maxLength={3} value={newDriver.abbreviation} onChange={e => setNewDriver({ ...newDriver, abbreviation: e.target.value.toUpperCase() })} />
                                    </div>
                                </div>
                                <div className="grid-3" style={{ marginTop: 12 }}>
                                    <div className="form-group">
                                        <label>Nummer</label>
                                        <input className="form-input" type="number" required value={newDriver.number} onChange={e => setNewDriver({ ...newDriver, number: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Team</label>
                                        <select className="form-input" required value={newDriver.constructor_id} onChange={e => setNewDriver({ ...newDriver, constructor_id: e.target.value })}>
                                            <option value="">— Kies Team —</option>
                                            {constructors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Waarde ($)</label>
                                        <input className="form-input" type="number" required value={newDriver.current_value} onChange={e => setNewDriver({ ...newDriver, current_value: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving}>
                                    💾 Coureur Opslaan
                                </button>
                            </form>
                        )}

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Coureur</th>
                                        <th>Team</th>
                                        <th>Waarde</th>
                                        <th>Actief</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drivers.map(d => (
                                        <tr key={d.id} style={{ opacity: d.active ? 1 : 0.5 }}>
                                            <td style={{ fontWeight: 600 }}>
                                                {d.abbreviation} — {d.first_name} {d.last_name}
                                            </td>
                                            <td>
                                                <select
                                                    className="form-input"
                                                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                                    value={d.constructor_id || ''}
                                                    onChange={(e) => updateDriver(d.id, { constructor_id: e.target.value })}
                                                    disabled={saving}
                                                >
                                                    <option value="">— Geen Team —</option>
                                                    {constructors.map(c => (
                                                        <option key={c.id} value={c.id}>{c.short_name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--green)', minWidth: 60 }}>{formatPrice(d.current_value)}</span>
                                                    <button
                                                        className="btn btn-secondary btn-small"
                                                        onClick={() => {
                                                            const newVal = prompt(`Nieuwe waarde voor ${d.last_name} (in miljoenen, bijv. 15.5):`, (d.current_value / 1000000).toFixed(1))
                                                            if (newVal) updateDriver(d.id, { current_value: parseFloat(newVal) * 1000000 })
                                                        }}
                                                        disabled={saving}
                                                    >
                                                        ✎
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={d.active}
                                                    onChange={(e) => updateDriver(d.id, { active: e.target.checked })}
                                                    disabled={saving}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ============= LOG TAB ============= */}
                {tab === 'log' && (
                    <div className="card">
                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: 400, overflowY: 'auto' }}>
                            {log.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)' }}>Nog geen acties uitgevoerd</p>
                            ) : (
                                log.map((line, i) => (
                                    <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>{line}</div>
                                ))
                            )}
                        </div>
                        {log.length > 0 && (
                            <button className="btn btn-secondary btn-small" style={{ marginTop: 8 }}
                                onClick={() => setLog([])}>Log wissen</button>
                        )}
                        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 8 }}>
                                ⚠️ <strong>Gevaarzone</strong>: De onderstaande knop verwijdert alle opgeslagen data (teams, uitslagen, punten) en herstelt het spel naar de beginsituatie.
                            </p>
                            <button className="btn btn-primary" onClick={resetSeason} disabled={saving}
                                style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>
                                🚨 Seizoen Volledig Resetten
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
