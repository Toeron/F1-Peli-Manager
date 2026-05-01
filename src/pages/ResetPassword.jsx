import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
    const { user, updatePassword } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        // If we already have a user from the session, we can skip verification
        if (user) {
            setVerifying(false)
            return
        }

        const verifyToken = async () => {
            const token_hash = searchParams.get('token_hash')
            const type = searchParams.get('type')
            
            // If implicit flow (hash based), Supabase might already handle it via onAuthStateChange
            // We just wait for a second to see if user becomes available
            if (!token_hash || type !== 'recovery') {
                setTimeout(() => {
                    setVerifying(false)
                }, 1000)
                return
            }

            try {
                const { error } = await supabase.auth.verifyOtp({ token_hash, type })
                if (error) throw error
                // The onAuthStateChange in AuthContext will catch the session and set the user.
            } catch (err) {
                console.error(err)
                setError('Ongeldige of verlopen herstellink. Vraag een nieuwe aan.')
            } finally {
                setVerifying(false)
            }
        }

        verifyToken()
    }, [user, searchParams])

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)

        if (password.length < 6) {
            setError('Wachtwoord moet minimaal 6 tekens zijn')
            setLoading(false)
            return
        }

        const { error: err } = await updatePassword(password)
        if (err) {
            setError(err.message)
        } else {
            setSuccess('Wachtwoord is succesvol gewijzigd!')
            setTimeout(() => {
                navigate('/')
            }, 2000)
        }
        setLoading(false)
    }

    if (verifying) {
        return (
            <div className="auth-page">
                <div className="auth-card" style={{ textAlign: 'center' }}>
                    <p>Link verifiëren...</p>
                    <div className="spinner" style={{ margin: '20px auto' }}></div>
                </div>
            </div>
        )
    }

    if (!user && !success && !error) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Toegang Geweigerd</h2>
                    <p style={{ textAlign: 'center' }}>
                        Je bent niet ingelogd en de herstellink is mogelijk ongeldig.
                    </p>
                    <button className="btn btn-secondary btn-large" onClick={() => navigate('/login')} style={{ marginTop: '20px' }}>
                        Terug naar Inloggen
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <h2>Nieuw Wachtwoord</h2>
                    <p>Kies een nieuw, sterk wachtwoord voor je account.</p>
                </div>

                {error && <div className="form-error" style={{ textAlign: 'center', marginBottom: 16 }}>{error}</div>}
                {success && <div style={{ textAlign: 'center', marginBottom: 16, color: 'var(--green)', fontSize: '0.85rem' }}>{success}</div>}

                {!success && (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Nieuw Wachtwoord</label>
                            <input className="form-input" type="password" value={password}
                                onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                        </div>
                        <button className="btn btn-primary btn-large" type="submit" disabled={loading}>
                            {loading ? '...' : 'Wachtwoord Opslaan'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
