import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

export default function LoginPage() {
    const { user, signIn, signUp, resetPasswordForEmail } = useAuth()
    const [isSignUp, setIsSignUp] = useState(false)
    const [isReset, setIsReset] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState('')

    if (user) return <Navigate to="/" />

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)

        if (isReset) {
            if (!email) { setError('Vul je e-mailadres in'); setLoading(false); return }
            const { error: err } = await resetPasswordForEmail(email)
            if (err) {
                setError(err.message)
            } else {
                setSuccess('Als dit account bestaat, is er een herstellink naar je e-mail gestuurd.')
            }
        } else if (isSignUp) {
            if (!username.trim()) { setError('Kies een gebruikersnaam'); setLoading(false); return }
            if (password.length < 6) { setError('Wachtwoord moet minimaal 6 tekens zijn'); setLoading(false); return }
            const { error: err } = await signUp(email, password, username)
            if (err) {
                if (err.message.includes('rate limit')) {
                    setError('Te veel pogingen. Probeer het over een paar minuten opnieuw.')
                } else {
                    setError(err.message)
                }
            }
            else setSuccess('Account aangemaakt! Je kunt nu inloggen (e-mailbevestiging is niet nodig).')
        } else {
            const { error: err } = await signIn(email, password)
            if (err) {
                if (err.message.includes('Email not confirmed')) {
                    setError('E-mailadres is nog niet bevestigd. Check je inbox (of vraag de beheerder om dit uit te schakelen).')
                } else {
                    setError('Onjuiste inloggegevens')
                }
            }
        }
        setLoading(false)
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <h1>F1 <span>PELI</span>-MANAGER</h1>
                    <p>Bouw je droomteam. Voorspel het podium. Win het kampioenschap.</p>
                </div>

                {error && <div className="form-error" style={{ textAlign: 'center', marginBottom: 16 }}>{error}</div>}
                {success && <div style={{ textAlign: 'center', marginBottom: 16, color: 'var(--green)', fontSize: '0.85rem' }}>{success}</div>}

                <form onSubmit={handleSubmit}>
                    {!isReset && isSignUp && (
                        <div className="form-group">
                            <label>Gebruikersnaam</label>
                            <input className="form-input" type="text" value={username}
                                onChange={e => setUsername(e.target.value)} placeholder="RacingKing2026" required />
                        </div>
                    )}
                    <div className="form-group">
                        <label>E-mail</label>
                        <input className="form-input" type="email" value={email}
                            onChange={e => setEmail(e.target.value)} placeholder="naam@voorbeeld.nl" required />
                    </div>
                    {!isReset && (
                        <div className="form-group">
                            <label>Wachtwoord</label>
                            <input className="form-input" type="password" value={password}
                                onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                        </div>
                    )}
                    <button className="btn btn-primary btn-large" type="submit" disabled={loading}>
                        {loading ? '...' : isReset ? 'Stuur Herstellink' : isSignUp ? '🏁 Account Aanmaken' : '🏁 Start Your Engine'}
                    </button>
                </form>

                <div className="auth-toggle">
                    {isReset ? (
                        <>Weer inloggen? <a href="#" onClick={e => { e.preventDefault(); setIsReset(false); setIsSignUp(false); setError(''); setSuccess(''); }}>Terug</a></>
                    ) : isSignUp ? (
                        <>Al een account? <a href="#" onClick={e => { e.preventDefault(); setIsSignUp(false); setError(''); setSuccess(''); }}>Inloggen</a></>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span>Nog geen account? <a href="#" onClick={e => { e.preventDefault(); setIsSignUp(true); setError(''); setSuccess(''); }}>Registreren</a></span>
                            <span>Wachtwoord vergeten? <a href="#" onClick={e => { e.preventDefault(); setIsReset(true); setError(''); setSuccess(''); }}>Herstellen</a></span>
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}
