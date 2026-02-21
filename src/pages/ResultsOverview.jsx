import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Flag from '../components/Flag'

export default function ResultsOverview() {
    const [races, setRaces] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadRaces()
    }, [])

    async function loadRaces() {
        const { data } = await supabase
            .from('races')
            .select('*, circuits(*)')
            .eq('is_test', false)
            .order('race_date', { ascending: true })

        setRaces(data || [])
        setLoading(false)
    }


    if (loading) return <div className="loading"><div className="spinner"></div></div>

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 800 }}>
                <div className="page-header banner-history">
                    <div className="page-header-content">
                        <h1>Resultaten Historie</h1>
                        <p>Overzicht van alle verreden races</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {races.map(race => (
                        <Link to={`/results/${race.id}`} key={race.id} className="card result-card-link" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                            <div style={{ fontSize: '2.5rem', display: 'flex' }}>
                                <Flag code={race.circuits?.country_code} size={40} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>
                                    {race.name}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {new Date(race.race_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="btn btn-secondary btn-small">Details →</div>
                        </Link>
                    ))}
                    {races.length === 0 && (
                        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                            Nog geen races voltooid dit seizoen.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
