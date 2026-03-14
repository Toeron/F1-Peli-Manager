import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

async function calculateTrends(rankingData, lastRaceId) {
    if (!lastRaceId || !rankingData || rankingData.length === 0) {
        return rankingData.map((p, i) => ({ ...p, currentRank: i, trend: 'stable', trendDiff: 0 }))
    }

    const { data: lastScores } = await supabase
        .from('user_race_scores')
        .select('user_id, total_points')
        .eq('race_id', lastRaceId)
        .in('user_id', rankingData.map(p => p.id))

    const withPrev = rankingData.map((p, i) => {
        const lastScore = lastScores?.find(s => s.user_id === p.id)?.total_points || 0
        return { ...p, currentRank: i, previousPoints: p.total_points - lastScore }
    })

    const sortedPrev = [...withPrev].sort((a, b) => b.previousPoints - a.previousPoints)

    return withPrev.map(p => {
        const prevRank = sortedPrev.findIndex(sp => sp.id === p.id)
        let trend = 'stable'
        if (p.currentRank < prevRank) trend = 'up'
        if (p.currentRank > prevRank) trend = 'down'
        return { ...p, trend, trendDiff: Math.abs(prevRank - p.currentRank) }
    })
}

function TrendIndicator({ trend, diff }) {
    if (trend === 'up') return <span style={{ color: 'var(--green)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 2 }} title="Gestegen ten opzichte van vorige race">▲ {diff}</span>
    if (trend === 'down') return <span style={{ color: 'var(--red)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 2 }} title="Gedaald ten opzichte van vorige race">▼ {diff}</span>
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', opacity: 0.5 }} title="Gelijk gebleven">-</span>
}

function CamelTrack({ players }) {
    const [isRacing, setIsRacing] = useState(false);
    const [racePhase, setRacePhase] = useState('idle'); // 'idle' | 'start' | 'racing' | 'finished'
    const audioRef = useRef(null);
    const timeoutRef = useRef(null);
    const startTimeoutRef = useRef(null);

    // Generate stable random durations per player for the race
    const raceDurationsRef = useRef([]);

    const startRace = useCallback(() => {
        if (isRacing) return;

        // Generate random durations between 17.5s and 19s for each player
        raceDurationsRef.current = (players || []).slice(0, 5).map(() =>
            17.5 + Math.random() * 1.5
        );

        setIsRacing(true);
        setRacePhase('start');

        // Play audio
        try {
            audioRef.current = new Audio('/audio/kamelenrace.mp3');
            audioRef.current.volume = 0.7;
            audioRef.current.play().catch(() => {});
        } catch (e) {
            // Audio might not be available, continue with animation only
        }

        // After a brief moment, start the actual race animation
        // Need enough time for browser to paint the 'start' position before enabling transitions
        startTimeoutRef.current = setTimeout(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setRacePhase('racing');
                });
            });
        }, 200);

        // After 19 seconds, race is done
        timeoutRef.current = setTimeout(() => {
            setRacePhase('finished');
            setTimeout(() => {
                setIsRacing(false);
                setRacePhase('idle');
            }, 500);
        }, 19000);
    }, [isRacing, players]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
        };
    }, []);

    if (!players || players.length < 2) return null;
    const trackPlayers = [...players].slice(0, 5); // top 5 looks best on mobile
    const maxPoints = trackPlayers[0].total_points;
    const minPoints = Math.max(0, trackPlayers[trackPlayers.length - 1].total_points - 20);

    const range = Math.max(1, maxPoints - minPoints);

    return (
        <div style={{ marginBottom: 32, padding: '0 4px' }}>
            <h3
                onClick={startRace}
                style={{
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    color: isRacing ? 'var(--gold)' : 'var(--text-muted)',
                    marginBottom: 16,
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'color 0.3s ease',
                    ...(isRacing ? {
                        animation: 'camelTitlePulse 0.6s ease-in-out infinite alternate',
                        textShadow: '0 0 8px rgba(255,200,0,0.4)',
                    } : {})
                }}
            >
                {isRacing ? '🐪 KAMELENRACE! 🐪' : 'Koplopers (Top 5) & Puntenverschil'}
            </h3>
            <div style={{
                position: 'relative',
                width: '100%',
                height: 110,
                background: isRacing
                    ? 'linear-gradient(90deg, rgba(194,154,55,0.08) 0%, rgba(194,154,55,0.15) 100%)'
                    : 'linear-gradient(90deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.04) 100%)',
                borderRadius: 12,
                border: `1px solid ${isRacing ? 'rgba(194,154,55,0.2)' : 'rgba(255,255,255,0.05)'}`,
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)',
                transition: 'background 0.5s ease, border-color 0.5s ease',
            }}>
                {/* Dust cloud animation during race */}
                {isRacing && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        overflow: 'hidden',
                        borderRadius: 12,
                        pointerEvents: 'none',
                        zIndex: 0,
                    }}>
                        <div style={{
                            width: '100%',
                            height: '100%',
                            background: 'repeating-linear-gradient(90deg, transparent, rgba(194,154,55,0.03) 20%, transparent 40%)',
                            animation: 'camelDust 2s linear infinite',
                        }} />
                    </div>
                )}

                {/* Finish line */}
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, background: 'repeating-linear-gradient(45deg, #fff, #fff 4px, #000 4px, #000 8px)', borderTopRightRadius: 11, borderBottomRightRadius: 11, opacity: 0.6, zIndex: 1 }} />

                {/* Start line - only visible during race */}
                {isRacing && (
                    <div style={{
                        position: 'absolute', left: 24, top: 0, bottom: 0, width: 3,
                        background: 'rgba(255,255,255,0.3)',
                        borderRadius: 2,
                        zIndex: 1,
                    }} />
                )}

                {trackPlayers.map((p, globalIndex) => {
                    const percentage = Math.max(0, Math.min(100, ((p.total_points - minPoints) / range) * 100));

                    // Fixed staggering offsets based on RANK to avoid overlap
                    const fanOffsets = [
                        { x: 0, y: -25 },  // P1: Up
                        { x: -5, y: 25 },  // P2: Down
                        { x: -10, y: 0 },   // P3: Middle
                        { x: -15, y: -35 }, // P4: Far Up
                        { x: -20, y: 35 }   // P5: Far Down
                    ];
                    const offset = fanOffsets[globalIndex % 5];

                    // Determine the left position based on race phase
                    const isAtStart = racePhase === 'start';
                    const isMoving = racePhase === 'racing' || racePhase === 'finished';
                    const raceDuration = raceDurationsRef.current[globalIndex] || 18;

                    const leftValue = isAtStart
                        ? '10px' // All bunched at the very start
                        : `calc(30px + (100% - 60px) * ${percentage / 100} + ${offset.x}px)`;

                    // Transition: none during start (instant snap), 19s during race, 1s normally
                    const transitionValue = isAtStart
                        ? 'none'
                        : isMoving
                            ? `all ${raceDuration}s cubic-bezier(0.16, 0.9, 0.4, 1)`
                            : 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)';

                    return (
                        <div key={p.id} style={{
                            position: 'absolute',
                            left: leftValue,
                            top: `calc(50% + ${isAtStart ? 0 : offset.y}px)`,
                            transform: 'translate(-50%, -50%)',
                            transition: transitionValue,
                            zIndex: 20 - globalIndex,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}>
                            <div className="nav-avatar" style={{
                                width: 40, height: 40,
                                border: `3px solid ${globalIndex === 0 ? 'var(--gold)' : globalIndex === 1 ? 'var(--silver)' : globalIndex === 2 ? 'var(--bronze)' : 'var(--border)'}`,
                                boxShadow: isRacing
                                    ? `0 4px 16px rgba(0,0,0,0.5), 0 0 12px ${globalIndex === 0 ? 'rgba(255,200,0,0.3)' : 'rgba(255,255,255,0.1)'}`
                                    : '0 4px 12px rgba(0,0,0,0.5)',
                                overflow: 'hidden',
                                background: 'var(--bg-elevated)',
                                fontSize: '1.2rem',
                                padding: 0,
                                transition: 'box-shadow 0.5s ease',
                                ...(isRacing ? { animation: `camelBounce 0.3s ease-in-out infinite alternate ${globalIndex * 0.05}s` } : {}),
                            }}>
                                {p.avatar_url ? (
                                    <img src={p.avatar_url} alt="Av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    (p.display_name || p.username || '?')[0].toUpperCase()
                                )}
                            </div>
                            <div style={{
                                position: 'absolute',
                                top: -14,
                                right: -14,
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                background: 'var(--bg-elevated)',
                                padding: '1px 5px',
                                borderRadius: 6,
                                whiteSpace: 'nowrap',
                                border: '1px solid',
                                borderColor: globalIndex === 0 ? 'var(--gold)' : globalIndex === 1 ? 'var(--silver)' : globalIndex === 2 ? 'var(--bronze)' : 'var(--border)',
                                color: globalIndex === 0 ? 'var(--gold)' : globalIndex === 1 ? 'var(--silver)' : globalIndex === 2 ? 'var(--bronze)' : 'var(--text-primary)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                zIndex: 21
                            }}>
                                {p.total_points}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* CSS Keyframes for race animations */}
            {isRacing && (
                <style>{`
                    @keyframes camelTitlePulse {
                        from { opacity: 0.8; transform: scale(1); }
                        to { opacity: 1; transform: scale(1.03); }
                    }
                    @keyframes camelDust {
                        from { transform: translateX(-100%); }
                        to { transform: translateX(100%); }
                    }
                    @keyframes camelBounce {
                        from { transform: translateY(0px); }
                        to { transform: translateY(-2px); }
                    }
                `}</style>
            )}
        </div>
    )
}

export default function Leagues() {
    const { profile } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const [tab, setTab] = useState(searchParams.get('tab') || 'leagues')
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
    const [selectedLeagueId, setSelectedLeagueId] = useState(searchParams.get('leagueId') || '')
    const [leagueRanking, setLeagueRanking] = useState([])

    // Update search params when tab or selectedLeagueId changes
    useEffect(() => {
        const params = new URLSearchParams()
        if (tab) params.set('tab', tab)
        if (selectedLeagueId) params.set('leagueId', selectedLeagueId)
        setSearchParams(params, { replace: true })
    }, [tab, selectedLeagueId, setSearchParams])

    useEffect(() => { loadData() }, [profile])

    async function loadData() {
        const now = new Date().toISOString()
        let fetchedLastRaceId = null
        const { data: pastRaces } = await supabase
            .from('races')
            .select('id')
            .eq('is_test', false)
            .lte('lock_datetime', now)
            .order('lock_datetime', { ascending: false })
            .limit(1)
        if (pastRaces?.length) {
            fetchedLastRaceId = pastRaces[0].id
            setLastRaceId(fetchedLastRaceId)
        }

        // Global ranking
        const { data: ranking } = await supabase
            .from('profiles')
            .select('id, username, display_name, total_points, budget, avatar_url')
            .order('total_points', { ascending: false })
            .limit(50)

        const rankingWithTrends = await calculateTrends(ranking || [], fetchedLastRaceId)
        setGlobalRanking(rankingWithTrends)

        // My leagues
        if (profile) {
            const { data: memberships } = await supabase
                .from('league_members')
                .select('*, leagues(*)')
                .eq('user_id', profile.id)
            const leaguesList = memberships?.map(m => m.leagues).filter(l => l && !l.is_global) || []
            setMyLeagues(leaguesList)
            if (leaguesList.length > 0 && !selectedLeagueId) {
                const initialLeagueId = searchParams.get('leagueId')
                if (initialLeagueId && leaguesList.some(l => l.id === initialLeagueId)) {
                    setSelectedLeagueId(initialLeagueId)
                } else {
                    setSelectedLeagueId(leaguesList[0].id)
                }
            } else if (leaguesList.length === 0) {
                setTab('global')
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
            // Fetch lastRaceId directly to avoid timing issues with state
            const now = new Date().toISOString()
            const { data: pastRaces } = await supabase
                .from('races')
                .select('id')
                .eq('is_test', false)
                .lte('lock_datetime', now)
                .order('lock_datetime', { ascending: false })
                .limit(1)
            const raceId = pastRaces?.[0]?.id || null

            const { data } = await supabase
                .from('profiles')
                .select('id, username, display_name, total_points, budget, avatar_url, league_members!inner(league_id)')
                .eq('league_members.league_id', selectedLeagueId)
                .order('total_points', { ascending: false })

            const rankingWithTrends = await calculateTrends(data || [], raceId)
            setLeagueRanking(rankingWithTrends)
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

    async function leaveLeague(leagueId) {
        if (!window.confirm('Weet je zeker dat je deze league wilt verlaten?')) return

        const { error: err } = await supabase
            .from('league_members')
            .delete()
            .eq('league_id', leagueId)
            .eq('user_id', profile.id)

        if (err) {
            setError(err.message)
            return
        }

        setSuccess('League verlaten')
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
                                    <tr><th style={{ width: 40 }}>#</th><th style={{ width: 60 }}>Trend</th><th>Speler</th><th style={{ textAlign: 'right' }}>Punten</th></tr>
                                </thead>
                                <tbody>
                                    {globalRanking.map((p, i) => (
                                        <tr key={p.id} className={p.id === profile?.id ? 'highlight' : ''}>
                                            <td style={{ fontWeight: 700, color: i < 3 ? ['var(--gold)', 'var(--silver)', 'var(--bronze)'][i] : 'inherit' }}>
                                                {i + 1}
                                            </td>
                                            <td>
                                                <TrendIndicator trend={p.trend} diff={p.trendDiff} />
                                            </td>
                                            <td>
                                                {lastRaceId ? (
                                                    <Link to={`/results/${lastRaceId}/player/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', overflow: 'hidden' }} className="hover-opacity">
                                                        <div className="nav-avatar" style={{ width: 56, height: 56, fontSize: '1.3rem', overflow: 'hidden' }}>
                                                            {p.avatar_url ? (
                                                                <img src={p.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                (p.username || '?')[0].toUpperCase()
                                                            )}
                                                        </div>
                                                        <span className="text-ellipsis" style={{ flex: 1, minWidth: 0 }}>{p.display_name || p.username}</span>
                                                    </Link>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                                                        <div className="nav-avatar" style={{ width: 56, height: 56, fontSize: '1.3rem', overflow: 'hidden' }}>
                                                            {p.avatar_url ? (
                                                                <img src={p.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                (p.username || '?')[0].toUpperCase()
                                                            )}
                                                        </div>
                                                        <span className="text-ellipsis" style={{ flex: 1, minWidth: 0 }}>{p.display_name || p.username}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 600, textAlign: 'right' }}>{p.total_points}</td>
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
                        <CamelTrack players={myLeagues.length > 0 ? leagueRanking : globalRanking} />

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
                                        <tr><th style={{ width: 40 }}>#</th><th style={{ width: 60 }}>Trend</th><th>Speler</th><th style={{ textAlign: 'right' }}>Punten</th></tr>
                                    </thead>
                                    <tbody>
                                        {leagueRanking.map((p, i) => (
                                            <tr key={p.id} className={p.id === profile?.id ? 'highlight' : ''}>
                                                <td style={{ fontWeight: 700, color: i < 3 ? ['var(--gold)', 'var(--silver)', 'var(--bronze)'][i] : 'inherit' }}>
                                                    {i + 1}
                                                </td>
                                                <td>
                                                    <TrendIndicator trend={p.trend} diff={p.trendDiff} />
                                                </td>
                                                <td>
                                                    {lastRaceId ? (
                                                        <Link to={`/results/${lastRaceId}/player/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', overflow: 'hidden' }} className="hover-opacity">
                                                            <div className="nav-avatar" style={{ width: 56, height: 56, fontSize: '1.3rem', overflow: 'hidden' }}>
                                                                {p.avatar_url ? (
                                                                    <img src={p.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    (p.username || '?')[0].toUpperCase()
                                                                )}
                                                            </div>
                                                            <span className="text-ellipsis" style={{ flex: 1, minWidth: 0 }}>{p.display_name || p.username}</span>
                                                        </Link>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                                                            <div className="nav-avatar" style={{ width: 56, height: 56, fontSize: '1.3rem', overflow: 'hidden' }}>
                                                                {p.avatar_url ? (
                                                                    <img src={p.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    (p.username || '?')[0].toUpperCase()
                                                                )}
                                                            </div>
                                                            <span className="text-ellipsis" style={{ flex: 1, minWidth: 0 }}>{p.display_name || p.username}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 600, textAlign: 'right' }}>{p.total_points}</td>
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
                                                {league.owner_id !== profile.id && (
                                                    <button className="btn btn-secondary btn-small"
                                                        style={{ color: 'var(--red)', borderColor: 'rgba(255, 24, 1, 0.2)' }}
                                                        onClick={() => leaveLeague(league.id)}>
                                                        🚪 Verlaten
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
