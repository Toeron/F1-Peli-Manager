import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Leagues() {
    const { profile } = useAuth()
    const [tab, setTab] = useState('global')
    const [globalRanking, setGlobalRanking] = useState([])
    const [myLeagues, setMyLeagues] = useState([])
    const [showCreate, setShowCreate] = useState(false)
    const [showJoin, setShowJoin] = useState(false)
    const [newLeagueName, setNewLeagueName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [lastRaceId, setLastRaceId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedLeagueId, setSelectedLeagueId] = useState('')
    const [leagueRanking, setLeagueRanking] = useState([])

    useEffect(() => { loadData() }, [profile])

    async function loadData() {
        // Global ranking
        const { data: ranking } = await supabase
            .from('profiles')
            .select('id, username, display_name, total_points, budget, avatar_url')
            .order('total_points', { ascending: false })
            .limit(50)
        setGlobalRanking(ranking || [])

        // Get last locked race for linking
        const now = new Date().toISOString()
        const { data: pastRaces } = await supabase
            .from('races')
            .select('id')
            .eq('is_test', false)
            .lte('lock_datetime', now)
            .order('lock_datetime', { ascending: false })
            .limit(1)
        if (pastRaces?.length) {
            setLastRaceId(pastRaces[0].id)
        }

        // My leagues
        if (profile) {
            const { data: memberships } = await supabase
                .from('league_members')
                .select('*, leagues(*)')
                .eq('user_id', profile.id)
            const leaguesList = memberships?.map(m => m.leagues).filter(l => l && !l.is_global) || []
            setMyLeagues(leaguesList)
            if (leaguesList.length > 0 && !selectedLeagueId) {
                setSelectedLeagueId(leaguesList[0].id)
            }
        }
        setLoading(false)
    }

    useEffect(() => {
        if (!selectedLeagueId) {
            setLeagueRanking([])
            return
        }
        async function fetchLeagueRanking() {
            const { data } = await supabase
                .from('profiles')
                .select('id, username, display_name, total_points, budget, avatar_url, league_members!inner(league_id)')
                .eq('league_members.league_id', selectedLeagueId)
                .order('total_points', { ascending: false })

            setLeagueRanking(data || [])
        }
        fetchLeagueRanking()
    }, [selectedLeagueId])

    async function createLeague() {
        if (!newLeagueName.trim()) { setError('Geef je league een naam'); return }
        setError('')

        const { data, error: err } = await supabase
            .from('leagues')
            .insert({ name: newLeagueName, owner_id: profile.id })
            .select()
            .single()

        if (err) { setError(err.message); return }

        // Join own league
        await supabase.from('league_members').insert({ league_id: data.id, user_id: profile.id })

        setSuccess(`League "${data.name}" aangemaakt! Invite code: ${data.invite_code}`)
        setShowCreate(false)
        setNewLeagueName('')
        loadData()
    }

    async function joinLeague() {
        if (!joinCode.trim()) { setError('Voer een invite code in'); return }
        setError('')

        const { data: league } = await supabase
            .from('leagues')
            .select('*')
            .eq('invite_code', joinCode.trim())
            .single()

        if (!league) { setError('Ongeldige invite code'); return }

        const { error: err } = await supabase
            .from('league_members')
            .insert({ league_id: league.id, user_id: profile.id })

        if (err) {
            if (err.code === '23505') setError('Je bent al lid van deze league')
            else setError(err.message)
            return
        }

        setSuccess(`Je bent lid geworden van "${league.name}"!`)
        setShowJoin(false)
        setJoinCode('')
        loadData()
    }

    async function deleteLeague(leagueId) {
        if (!window.confirm('Weet je zeker dat je deze league wilt verwijderen? Alle deelnemers worden verwijderd.')) return

        const { error: err } = await supabase
            .from('leagues')
            .delete()
            .eq('id', leagueId)

        if (err) {
            setError(err.message)
            return
        }

        setSuccess('League verwijderd')
        loadData()
    }

    function formatBudget(val) {
        return '$' + (Number(val) / 1000000).toFixed(1) + 'M'
    }

    if (loading) return <div className="loading"><div className="spinner"></div></div>

    return (
        <div className="page">
            <div className="container">
                <div className="page-header banner-leagues">
                    <div className="page-header-content">
                        <h1>Ranglijst & Leagues</h1>
                        <p>Wie wordt de ultieme kenner?</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="session-tabs" style={{ marginBottom: 16 }}>
                    <button className={`session-tab ${tab === 'global' ? 'active' : ''}`} onClick={() => setTab('global')}>
                        🌍 Wereldranglijst
                    </button>
                    <button className={`session-tab ${tab === 'leagues' ? 'active' : ''}`} onClick={() => setTab('leagues')}>
                        🏆 Mijn Leagues
                    </button>
                    <button className={`session-tab ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>
                        ⚙️ Beheer
                    </button>
                </div>

                {error && <div className="form-error" style={{ textAlign: 'center', marginBottom: 12 }}>{error}</div>}
                {success && <div style={{ textAlign: 'center', marginBottom: 12, color: 'var(--green)', fontSize: '0.85rem' }}>{success}</div>}

                {tab === 'global' && (
                    <div className="card">
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr><th>#</th><th>Speler</th><th>Punten</th></tr>
                                </thead>
                                <tbody>
                                    {globalRanking.map((p, i) => (
                                        <tr key={p.id} className={p.id === profile?.id ? 'highlight' : ''}>
                                            <td style={{ fontWeight: 700, color: i < 3 ? ['var(--gold)', 'var(--silver)', 'var(--bronze)'][i] : 'inherit' }}>
                                                {i + 1}
                                            </td>
                                            <td>
                                                {lastRaceId ? (
                                                    <Link to={`/results/${lastRaceId}/player/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }} className="hover-opacity">
                                                        <div className="nav-avatar" style={{ width: 56, height: 56, fontSize: '1.3rem', overflow: 'hidden' }}>
                                                            {p.avatar_url ? (
                                                                <img src={p.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                (p.username || '?')[0].toUpperCase()
                                                            )}
                                                        </div>
                                                        {p.display_name || p.username}
                                                    </Link>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div className="nav-avatar" style={{ width: 56, height: 56, fontSize: '1.3rem', overflow: 'hidden' }}>
                                                            {p.avatar_url ? (
                                                                <img src={p.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                (p.username || '?')[0].toUpperCase()
                                                            )}
                                                        </div>
                                                        {p.display_name || p.username}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{p.total_points}</td>
                                        </tr>
                                    ))}
                                    {globalRanking.length === 0 && (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                                            Het seizoen is nog niet begonnen
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'leagues' && (
                    <div className="card">
                        <div style={{ marginBottom: 16 }}>
                            {myLeagues.length > 0 ? (
                                <select
                                    className="form-input"
                                    style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.9rem', width: 'auto', minWidth: 200 }}
                                    value={selectedLeagueId}
                                    onChange={(e) => setSelectedLeagueId(e.target.value)}
                                >
                                    {myLeagues.map(l => (
                                        <option key={l.id} value={l.id}>🏆 {l.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <p style={{ color: 'var(--text-muted)' }}>Je bent nog niet lid van een vriendschappelijke league.</p>
                            )}
                        </div>

                        {myLeagues.length > 0 && (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr><th>#</th><th>Speler</th><th>Punten</th></tr>
                                    </thead>
                                    <tbody>
                                        {leagueRanking.map((p, i) => (
                                            <tr key={p.id} className={p.id === profile?.id ? 'highlight' : ''}>
                                                <td style={{ fontWeight: 700, color: i < 3 ? ['var(--gold)', 'var(--silver)', 'var(--bronze)'][i] : 'inherit' }}>
                                                    {i + 1}
                                                </td>
                                                <td>
                                                    {lastRaceId ? (
                                                        <Link to={`/results/${lastRaceId}/player/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }} className="hover-opacity">
                                                            <div className="nav-avatar" style={{ width: 56, height: 56, fontSize: '1.3rem', overflow: 'hidden' }}>
                                                                {p.avatar_url ? (
                                                                    <img src={p.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    (p.username || '?')[0].toUpperCase()
                                                                )}
                                                            </div>
                                                            {p.display_name || p.username}
                                                        </Link>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <div className="nav-avatar" style={{ width: 56, height: 56, fontSize: '1.3rem', overflow: 'hidden' }}>
                                                                {p.avatar_url ? (
                                                                    <img src={p.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    (p.username || '?')[0].toUpperCase()
                                                                )}
                                                            </div>
                                                            {p.display_name || p.username}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{p.total_points}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'manage' && (
                    <>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" onClick={() => { setShowCreate(true); setShowJoin(false) }}>
                                + League Aanmaken
                            </button>
                            <button className="btn btn-secondary" onClick={() => { setShowJoin(true); setShowCreate(false) }}>
                                🔗 Deelnemen met Code
                            </button>
                        </div>

                        {showCreate && (
                            <div className="card" style={{ marginBottom: 16 }}>
                                <h3 style={{ marginBottom: 12 }}>Nieuwe League</h3>
                                <div className="form-group">
                                    <label>League naam</label>
                                    <input className="form-input" value={newLeagueName}
                                        onChange={e => setNewLeagueName(e.target.value)} placeholder="Bijv. De Racefanaten" />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-primary" onClick={createLeague}>Aanmaken</button>
                                    <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Annuleren</button>
                                </div>
                            </div>
                        )}

                        {showJoin && (
                            <div className="card" style={{ marginBottom: 16 }}>
                                <h3 style={{ marginBottom: 12 }}>Deelnemen aan League</h3>
                                <div className="form-group">
                                    <label>Invite code</label>
                                    <input className="form-input" value={joinCode}
                                        onChange={e => setJoinCode(e.target.value)} placeholder="Voer code in" />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-primary" onClick={joinLeague}>Deelnemen</button>
                                    <button className="btn btn-secondary" onClick={() => setShowJoin(false)}>Annuleren</button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {myLeagues.map(league => (
                                <div key={league.id} className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>
                                                {league.is_global ? '🌍 ' : '🏆 '}{league.name}
                                            </h3>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {league.description || `Invite code: ${league.invite_code}`}
                                            </p>
                                        </div>
                                        {!league.is_global && (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {(profile.is_admin || league.owner_id === profile.id) && (
                                                    <button className="btn btn-secondary btn-small"
                                                        style={{ color: 'var(--red)', borderColor: 'rgba(255, 24, 1, 0.2)' }}
                                                        onClick={() => deleteLeague(league.id)}>
                                                        🗑️ Verwijderen
                                                    </button>
                                                )}
                                                <button className="btn btn-secondary btn-small"
                                                    onClick={() => navigator.clipboard.writeText(league.invite_code)}>
                                                    📋 Code kopiëren
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {myLeagues.length === 0 && (
                                <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                    Je bent nog niet lid van een league. Maak er een aan of gebruik een invite code!
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
