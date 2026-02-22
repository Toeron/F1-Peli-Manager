import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DriverAvatar } from '../components/DriverAvatar'

export default function TeamSelection() {
    const { raceId } = useParams()
    const { profile, fetchProfile } = useAuth()
    const navigate = useNavigate()
    const [race, setRace] = useState(null)
    const [drivers, setDrivers] = useState([])
    const [selected, setSelected] = useState([])
    const [existing, setExisting] = useState(null)
    const [saving, setSaving] = useState(false)
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
            const { data: team } = await supabase
                .from('team_selections')
                .select('*')
                .eq('user_id', profile.id)
                .eq('race_id', raceId)
                .single()
            if (team) {
                setExisting(team)
                setSelected([team.driver1_id, team.driver2_id, team.driver3_id, team.driver4_id])
            }
        }
        setLoading(false)
    }

    function isLocked() {
        if (!race?.lock_datetime) return false
        return new Date(race.lock_datetime) <= new Date()
    }

    function totalCost() {
        return drivers.filter(d => selected.includes(d.id))
            .reduce((sum, d) => sum + Number(d.current_value), 0)
    }

    function canAfford() {
        return totalCost() <= Number(profile?.budget || 0)
    }

    function usedConstructors() {
        return drivers.filter(d => selected.includes(d.id)).map(d => d.constructor_id)
    }

    function toggleDriver(driverId) {
        if (existing?.locked || isLocked()) return
        if (selected.includes(driverId)) {
            setSelected(selected.filter(id => id !== driverId))
        } else {
            if (selected.length >= 4) return
            const driver = drivers.find(d => d.id === driverId)
            const used = usedConstructors()
            if (used.includes(driver.constructor_id)) return
            setSelected([...selected, driverId])
        }
        setError('')
    }

    async function saveTeam() {
        if (selected.length !== 4) { setError('Kies precies 4 coureurs'); return }
        if (!canAfford()) { setError('Te weinig budget!'); return }
        if (isLocked()) { setError('Voorspellingen zijn gesloten'); return }

        setSaving(true)
        setError('')

        const payload = {
            user_id: profile.id,
            race_id: raceId,
            driver1_id: selected[0],
            driver2_id: selected[1],
            driver3_id: selected[2],
            driver4_id: selected[3],
            total_cost: totalCost(),
            locked: false
        }

        let result
        if (existing) {
            result = await supabase.from('team_selections').update(payload).eq('id', existing.id)
        } else {
            result = await supabase.from('team_selections').insert(payload)
        }

        if (result.error) {
            setError(result.error.message)
        } else {
            navigate(`/predictions/${raceId}`)
        }
        setSaving(false)
    }

    function formatPrice(val) {
        return '$' + (Number(val) / 1000000).toFixed(1) + 'M'
    }

    if (loading) return <div className="loading"><div className="spinner"></div></div>

    const locked = isLocked() || existing?.locked

    return (
        <div className="page">
            <div className="container">
                <div className="page-header banner-team">
                    <div className="page-header-content">
                        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Terug</Link>
                        <h1 style={{ marginTop: 8 }}>Team Kiezen</h1>
                        {race && <p>{race.name} — Ronde {race.round}</p>}
                    </div>
                </div>

                {locked && (
                    <div className="card" style={{ marginBottom: 16, textAlign: 'center', borderColor: 'var(--amber)' }}>
                        <p style={{ color: 'var(--amber)' }}>🔒 Teamselectie is gesloten voor dit weekend</p>
                    </div>
                )}

                {/* Sticky Budget & selection info */}
                <div className="sticky-stats">
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
                            <div className="stat-value">{selected.length}/4</div>
                            <div className="stat-label">Gekozen</div>
                        </div>
                    </div>
                </div>

                {error && <div className="form-error" style={{ textAlign: 'center', marginBottom: 16 }}>{error}</div>}

                {/* Drivers grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 24 }}>
                    {drivers.map(d => {
                        const isSelected = selected.includes(d.id)
                        const constructorUsed = !isSelected && usedConstructors().includes(d.constructor_id)
                        const teamFull = !isSelected && selected.length >= 4
                        const tooExpensive = !isSelected && (totalCost() + Number(d.current_value) > Number(profile?.budget || 0))
                        const disabled = constructorUsed || teamFull || tooExpensive || locked

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

                {!locked && (
                    <button className="btn btn-primary btn-large" onClick={saveTeam}
                        disabled={selected.length !== 4 || !canAfford() || saving}>
                        {saving ? 'Opslaan...' : '🏁 Team Bevestigen'}
                    </button>
                )}
            </div>
        </div>
    )
}
