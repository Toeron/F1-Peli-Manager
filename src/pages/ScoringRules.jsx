import { useNavigate } from 'react-router-dom'

export default function ScoringRules() {
    const navigate = useNavigate()

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 800 }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
                    ← Terug
                </button>

                <div className="card card-glow">
                    <h1 style={{ marginBottom: 20, color: 'var(--green)' }}>Puntentelling Uitleg</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                        Bij F1 Peli-Manager verdien je punten op drie verschillende manieren: via je geselecteerde team, je voorspellingen en de krachtige Synergy Bonus.
                    </p>

                    <section style={{ marginBottom: 32 }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>🏎️ 1. Team Punten</h2>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: 12 }}>
                            Je kiest voor elk weekend 4 coureurs. Zij verdienen punten op basis van hun resultaten in de drie sessies:
                        </p>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Positie</th>
                                        <th>Race</th>
                                        <th>Kwalificatie</th>
                                        <th>Sprint</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pos => (
                                        <tr key={pos}>
                                            <td>P{pos}</td>
                                            <td>{[25, 18, 15, 12, 10, 8, 6, 4, 2, 1][pos - 1] || 0} pnt</td>
                                            <td>{pos <= 8 ? (9 - pos) : 0} pnt</td>
                                            <td>{pos <= 8 ? Math.round((9 - pos) * 1) : 0} pnt*</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                            * Sprintpunten zijn 25% van de reguliere race-punten die voor die positie worden uitgegeven.
                        </p>
                    </section>

                    <section style={{ marginBottom: 32 }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>🎯 2. Voorspellingen (Top 3)</h2>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: 12 }}>
                            Voor elke sessie voorspel je de Top 3. Je krijgt punten op basis van hoe dicht je bij de werkelijke uitslag zit:
                        </p>
                        <ul className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', listStyle: 'none', padding: 0, gap: 12 }}>
                            <li className="stat-card" style={{ padding: 12 }}>
                                <div className="stat-value" style={{ color: 'var(--green)' }}>100%</div>
                                <div className="stat-label">Exacte Match</div>
                            </li>
                            <li className="stat-card" style={{ padding: 12 }}>
                                <div className="stat-value" style={{ color: 'var(--blue)' }}>50%</div>
                                <div className="stat-label">1 plek ernaast</div>
                            </li>
                            <li className="stat-card" style={{ padding: 12 }}>
                                <div className="stat-value" style={{ color: 'var(--text-muted)' }}>25%</div>
                                <div className="stat-label">2 plekken ernaast</div>
                            </li>
                        </ul>
                        <p style={{ fontSize: '0.8rem', marginTop: 12, opacity: 0.7 }}>
                            De basispunten voor een voorspelling (bij 100% match) zijn gelijk aan de punten die de coureur in die sessie zou verdienen (bijvoorbeeld 25 pnt voor P1 in de race).
                        </p>
                    </section>

                    <section style={{ marginBottom: 32 }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>⚡ 3. Synergy Bonus</h2>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: 12 }}>
                            Dit is de ultieme boost! Als een coureur die je in je **Team** hebt voorkomt in je **Voorspelling**, worden de resultaat-punten van die coureur vermenigvuldigd:
                        </p>
                        <div className="stats-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <div className="stat-card" style={{ flex: '1 1 100px', padding: 10, minWidth: '80px' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>2.0x</div>
                                <div style={{ fontSize: '0.65rem' }}>Exacte Match</div>
                            </div>
                            <div className="stat-card" style={{ flex: '1 1 100px', padding: 10, minWidth: '80px' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>1.5x</div>
                                <div style={{ fontSize: '0.65rem' }}>1 plek ernaast</div>
                            </div>
                            <div className="stat-card" style={{ flex: '1 1 100px', padding: 10, minWidth: '80px' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>1.25x</div>
                                <div style={{ fontSize: '0.65rem' }}>2 plekken ernaast</div>
                            </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', marginTop: 12, background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8 }}>
                            <strong>Voorbeeld:</strong> Je hebt Verstappen in je team en voorspelt hem op P1. Hij wint de race (25 pnt).
                            Door de 2.0x Synergy bonus krijgt je team niet 25, maar <strong>50 teampunten</strong> voor Verstappen!
                        </p>
                    </section>

                    <section style={{ marginBottom: 32 }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>💰 4. Budget & Team Selectie</h2>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: 12 }}>
                            Je begint het seizoen met een vast startbudget van <strong>$100M</strong>.
                        </p>
                        <ul style={{ fontSize: '0.9rem', opacity: 0.8, paddingLeft: 20, marginBottom: 16 }}>
                            <li style={{ marginBottom: 6 }}>De prijzen van coureurs zijn gebaseerd op hun historische prestaties en blijven het hele seizoen gelijk.</li>
                            <li style={{ marginBottom: 6 }}>Als je een team kiest dat minder dan $100M kost, blijft het restant gewoon in je account staan.</li>
                            <li>Dit overgebleven budget kun je bij volgende races gebruiken om eventueel duurdere coureurs te kiezen.</li>
                        </ul>
                        <p style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8 }}>
                            💡 <strong>Tip:</strong> Je hoeft dus niet elke race je volledige budget op te maken. Slim sparen kan je helpen om later in het seizoen een sterker team op te stellen!
                        </p>
                    </section>

                    <section>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>🔓 Lock-in Tijd</h2>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                            Je team en voorspellingen worden definitief vastgezet **5 minuten voor het begin van de Kwalificatie**.
                            Zorg dat je op tijd bent, daarna kun je niets meer wijzigen voor dat raceweekend!
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}
