import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Flag from '../components/Flag'

export default function Calendar() {
    const [races, setRaces] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const { data } = await supabase
                .from('races')
                .select('*, circuits(*)')
                .eq('is_test', false)
                .order('round', { ascending: true })
            setRaces(data || [])
            setLoading(false)
        }
        load()
    }, [])


    function getStatus(race) {
        const now = new Date()
        const raceDate = new Date(race.race_date)
        const qualiDate = new Date(race.quali_date)
        if (race.status === 'cancelled') return 'cancelled'
        if (race.status === 'completed') return 'completed'
        if (now >= qualiDate && now <= new Date(raceDate.getTime() + 86400000)) return 'live'
        return 'upcoming'
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
    }

    function findNextRace() {
        const now = new Date()
        return races.find(r => r.status !== 'cancelled' && new Date(r.race_date) >= now)
    }

    if (loading) return <div className="loading"><div className="spinner"></div></div>

    const nextRace = findNextRace()
    const activeRaces = races.filter(r => r.status !== 'cancelled')
    const completed = races.filter(r => r.status === 'completed').length

    return (
        <div className="page">
            <div className="container">
                <div className="page-header banner-calendar">
                    <div className="page-header-content">
                        <h1>Seizoen 2026</h1>
                        <p>{completed} van {activeRaces.length} races afgelopen</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, height: 8, marginBottom: 24, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--red)', height: '100%', width: `${(completed / activeRaces.length) * 100}%`, borderRadius: 8, transition: 'width 0.5s' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {races.map(race => {
                        const status = getStatus(race)
                        const isNext = nextRace?.id === race.id

                        return (
                            <div key={race.id} className={`race-card ${isNext ? 'next' : ''}`} style={status === 'cancelled' ? { opacity: 0.5 } : {}}>
                                <div className="race-round" style={status === 'cancelled' ? { textDecoration: 'line-through' } : {}}>R{race.round}</div>
                                <div className="race-flag">
                                    <Flag code={race.circuits?.country_code} />
                                </div>
                                <div className="race-info">
                                    <div className="race-name" style={status === 'cancelled' ? { textDecoration: 'line-through' } : {}}>{race.name}</div>
                                    <div className="race-date">
                                        {formatDate(race.race_date)} — {race.circuits?.city}
                                    </div>
                                </div>
                                <div className="race-actions">
                                    {race.is_sprint_weekend && status !== 'cancelled' && <span className="badge badge-sprint">⚡ Sprint</span>}
                                    {status === 'cancelled' && <span className="badge" style={{ background: 'rgba(255,60,60,0.15)', color: '#ff4d4d', border: '1px solid rgba(255,60,60,0.3)' }}>🚫 Geannuleerd</span>}
                                    {status === 'live' && <span className="badge badge-live">Live</span>}
                                    {status === 'completed' && <span className="badge badge-done">✓</span>}
                                    {isNext && <span className="badge badge-live">Volgende</span>}
                                    {status === 'upcoming' && (
                                        <Link to={`/wizard/${race.id}`} className="btn btn-secondary btn-small">
                                            Kiezen
                                        </Link>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
