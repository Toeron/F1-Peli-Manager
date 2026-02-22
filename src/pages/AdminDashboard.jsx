import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

export default function AdminDashboard() {
    const { profile, fetchProfile } = useAuth()
    const [races, setRaces] = useState([])
    const [drivers, setDrivers] = useState([])
    const [constructors, setConstructors] = useState([])
    const [players, setPlayers] = useState([])
    const [selectedRace, setSelectedRace] = useState('')
    const [selectedRaceObj, setSelectedRaceObj] = useState(null)
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

        const { data: profilesData } = await supabase
            .from('profiles').select('*').order('created_at', { ascending: false })
        setPlayers(profilesData || [])

        setLoading(false)
    }

    useEffect(() => {
        if (selectedRace) {
            loadResults()
            setSelectedRaceObj(races.find(r => r.id === selectedRace))
        }
    }, [selectedRace, selectedSession, races])

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
        const maxPos = selectedSession === 'race' ? 10 : 8
        const rows = []
        for (let i = 1; i <= maxPos; i++) {
            const existing = results.find(r => r.position === i)
            rows.push({
                position: i,
                driver_id: existing?.driver_id || '',
                points_awarded: existing?.points_awarded || 0,
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
        if (session === 'qualifying') return position <= 8 ? (9 - position) : 0
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
                verified: true
            }))

        const { error } = await supabase.from('race_results').insert(rowsToInsert)
        if (error) {
            addLog(`❌ Fout: ${error.message}`)
        } else {
            addLog(`✅ ${rowsToInsert.length} resultaten opgeslagen voor ${selectedSession}`)
            // Automatically trigger points calculation for all players
            await calculatePoints()
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
            if (profile) await fetchProfile(profile.id)
        }

        setSaving(false)
    }

    async function completeWeekend() {
        if (!window.confirm('Weet je het zeker? Dit berekent de definitieve scores voor alle spelers en markeert de race als voltooid.')) return
        setSaving(true)
        addLog('🏁 Weekend aan het voltooien...')

        // First calculate points to ensure everyone has their scores
        addLog('🔄 Laatste check: punten berekenen...')
        const { data: calcData, error: calcError } = await supabase.rpc('apply_race_scores', { p_race_id: selectedRace })
        if (calcError) {
            addLog(`❌ Fout bij punten berekenen: ${calcError.message}`)
            setSaving(false)
            return
        }
        addLog(`✅ ${calcData}`)

        // Then mark as completed
        const { error } = await supabase.from('races').update({ status: 'completed' }).eq('id', selectedRace)
        if (error) {
            addLog(`❌ Fout bij status bijwerken: ${error.message}`)
        } else {
            addLog('✅ Race status → completed. Weekend is officieel gesloten.')
            if (profile) await fetchProfile(profile.id)
            await loadData()
            window.alert('🏁 Weekend succesvol voltooid en alle scores zijn berekend!')
        }
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

    // ============= TEST TOOLS =============
    async function resetRaceData() {
        if (!window.confirm('⚠️ WEET JE HET ZEKER? Dit wist ALLE uitslagen en berekende punten voor deze race!')) return
        setSaving(true)
        addLog(`🧹 Data wissen voor race ${selectedRace}...`)

        const tableRes = await Promise.all([
            supabase.from('race_results').delete().eq('race_id', selectedRace),
            supabase.from('user_race_scores').delete().eq('race_id', selectedRace)
        ])

        const errors = tableRes.filter(r => r.error)
        if (errors.length) {
            addLog(`❌ Fout bij wissen: ${errors[0].error.message}`)
        } else {
            addLog('✅ Alles gewist. Je kunt nu een nieuwe simulatie starten.')
            await supabase.from('races').update({ status: 'open' }).eq('id', selectedRace)
        }
        await loadResults()
        await loadData()
        setSaving(false)
    }

    async function lockRaceNow() {
        setSaving(true)
        const now = new Date().toISOString()
        addLog(`🔒 Race handmatig vergrendelen op ${now}...`)
        const { error } = await supabase.from('races').update({ lock_datetime: now }).eq('id', selectedRace)
        if (error) addLog(`❌ Fout: ${error.message}`)
        else addLog('✅ Race vergrendeld. Spelers kunnen geen wijzigingen meer maken en kunnen elkaars data zien.')
        await loadData()
        setSaving(false)
    }

    async function openRaceNow() {
        setSaving(true)
        addLog('🔓 Race tijdelijk openzetten voor simulatie...')
        // Set lock date to 1 week in future to ensure it stays open during testing
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        const { error } = await supabase.from('races').update({
            lock_datetime: nextWeek.toISOString(),
            status: 'open'
        }).eq('id', selectedRace)

        if (error) addLog(`❌ Fout: ${error.message}`)
        else addLog('✅ Race is weer open. Spelers kunnen weer invullen en data van anderen is weer verborgen.')
        await loadData()
        setSaving(false)
    }

    async function restoreDeadline() {
        if (!selectedRaceObj?.quali_datetime) {
            addLog('⚠️ Geen kwalificatie-deadline gevonden voor deze race.')
            return
        }
        setSaving(true)
        addLog('📅 Deadline herstellen naar kalender...')
        const { error } = await supabase.from('races')
            .update({ lock_datetime: selectedRaceObj.quali_datetime })
            .eq('id', selectedRace)

        if (error) addLog(`❌ Fout: ${error.message}`)
        else addLog(`✅ Deadline hersteld naar ${new Date(selectedRaceObj.quali_datetime).toLocaleString()}`)
        await loadData()
        setSaving(false)
    }

    function getDriverName(id) {
        const d = drivers.find(d => d.id === id)
        return d ? `${d.first_name} ${d.last_name}` : ''
    }

    async function handleDeletePlayer(playerId, playerName) {
        const confirmText = window.prompt(`Weet je zeker dat je speler "${playerName}" definitief wilt verwijderen?\n\nTyp 'VERWIJDER' in hoofdletters om te bevestigen:`)
        if (confirmText !== 'VERWIJDER') {
            if (confirmText !== null) addLog(`❌ Speler verwijderen geannuleerd.`)
            return
        }

        setSaving(true)
        addLog(`Verwijderen van speler ${playerName}...`)

        const { error } = await supabase.rpc('delete_user_by_admin', { user_id_to_delete: playerId })
        if (error) {
            addLog(`❌ Fout bij verwijderen speler: ${error.message}`)
        } else {
            addLog(`✅ Speler ${playerName} definitief verwijderd.`)
            await loadData()
        }
        setSaving(false)
    }

    function formatPrice(val) {
        return '$' + (Number(val) / 1000000).toFixed(1) + 'M'
    }


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
                <div className="page-header banner-admin">
                    <div className="page-header-content">
                        <h1>⚙️ Admin Dashboard</h1>
                    </div>
                </div>

                {/* Tabs */}
                <div className="session-tabs" style={{ marginBottom: 16, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    <button className={`session-tab ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>
                        🏁 Uitslagen
                    </button>
                    <button className={`session-tab ${tab === 'drivers' ? 'active' : ''}`} onClick={() => setTab('drivers')}>
                        👤 Coureurs
                    </button>
                    <button className={`session-tab ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>
                        👥 Spelers
                    </button>
                    <button className={`session-tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>
                        📋 Log
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                            <button className="btn btn-primary" style={{ flex: '1 1 180px' }} onClick={saveResults} disabled={saving}>
                                💾 Uitslag Opslaan
                            </button>
                            <button className="btn btn-secondary" style={{ flex: '1 1 180px', background: 'rgba(0,210,106,0.15)', borderColor: 'var(--green)' }} onClick={calculatePoints} disabled={saving}>
                                🧮 Punten Berekenen
                            </button>
                            <button className="btn btn-primary" style={{ flex: '1 1 180px', background: 'var(--green)', borderColor: 'var(--green)' }} onClick={completeWeekend} disabled={saving || selectedRaceObj?.status === 'completed'}>
                                🏁 Voltooi Weekend
                            </button>
                            <button className="btn btn-secondary" onClick={deleteResults} disabled={saving}
                                style={{ flex: '1 1 140px', background: 'rgba(255, 36, 66, 0.15)', borderColor: 'var(--red)', color: 'var(--red)' }}>
                                🗑️ Wissen
                            </button>
                        </div>

                        {/* Test Tools Section */}
                        <div className="card" style={{ border: '1px solid var(--amber)', background: 'rgba(245, 166, 35, 0.05)' }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                🛠️ Test & Simulatie Tools
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                                Gebruik deze tools om het verloop van een race-weekend te testen.
                            </p>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {(!selectedRaceObj?.lock_datetime || new Date(selectedRaceObj.lock_datetime) > new Date()) ? (
                                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px 12px', background: 'rgba(255, 193, 7, 0.1)', borderColor: 'var(--amber)' }}
                                        onClick={lockRaceNow} disabled={saving}>
                                        🔒 Deadline Nu (Vergrendelen)
                                    </button>
                                ) : (
                                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px 12px', background: 'rgba(0, 123, 255, 0.1)', borderColor: '#007bff' }}
                                        onClick={openRaceNow} disabled={saving}>
                                        🔓 Reopen Race (Ontgrendelen)
                                    </button>
                                )}

                                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                                    onClick={restoreDeadline} disabled={saving}>
                                    📅 Herstel naar Kalender
                                </button>

                                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px 12px', background: 'rgba(255, 36, 66, 0.1)', borderColor: 'rgba(255, 36, 66, 0.3)', color: 'var(--red)' }}
                                    onClick={resetRaceData} disabled={saving}>
                                    🧹 Reset Race Data
                                </button>
                            </div>
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

                {/* ============= PLAYERS TAB ============= */}
                {tab === 'players' && (
                    <div className="card">
                        <div style={{ marginBottom: 20 }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Geregistreerde Spelers</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Beheer accounts in de applicatie. Verwijderde accounts kunnen niet hersteld worden.</p>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Speler</th>
                                        <th>Username</th>
                                        <th>Punten / Budget</th>
                                        <th>Admin</th>
                                        <th style={{ textAlign: 'right' }}>Acties</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ fontWeight: 600 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div className="nav-avatar" style={{ width: 40, height: 40, fontSize: '1rem', overflow: 'hidden' }}>
                                                        {p.avatar_url ? (
                                                            <img src={p.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            (p.username || '?')[0].toUpperCase()
                                                        )}
                                                    </div>
                                                    {p.display_name}
                                                    {p.id === profile.id && <span style={{ fontSize: '0.65rem', color: 'var(--green)', marginLeft: 8 }}>(Jijzelf)</span>}
                                                </div>
                                            </td>
                                            <td>@{p.username}</td>
                                            <td>
                                                <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{p.total_points} pnt</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{formatPrice(p.budget)}</div>
                                            </td>
                                            <td>
                                                {p.is_admin ? <span style={{ color: 'var(--green)' }}>✓</span> : <span style={{ opacity: 0.3 }}>-</span>}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-secondary btn-small"
                                                    style={{ color: 'var(--red)', borderColor: 'var(--red)', background: 'transparent' }}
                                                    onClick={() => handleDeletePlayer(p.id, p.display_name || p.username)}
                                                    disabled={saving || p.id === profile.id}
                                                >
                                                    Verwijderen
                                                </button>
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
