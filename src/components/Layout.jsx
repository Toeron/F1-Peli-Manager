import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

export default function Layout() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [menuOpen, setMenuOpen] = useState(false)

    return (
        <>
            <nav className="navbar">
                <NavLink to="/" className="nav-logo">F1 <span>PELI-MANAGER</span></NavLink>

                <button className="nav-hamburger mobile-hide" onClick={() => setMenuOpen(!menuOpen)}>☰</button>

                <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
                    <li><NavLink to="/" onClick={() => setMenuOpen(false)}>Dashboard</NavLink></li>
                    <li><NavLink to="/calendar" onClick={() => setMenuOpen(false)}>Kalender</NavLink></li>
                    <li><NavLink to="/history" onClick={() => setMenuOpen(false)}>Historie</NavLink></li>
                    <li><NavLink to="/leagues" onClick={() => setMenuOpen(false)}>Klassement</NavLink></li>
                    <li><NavLink to="/rules" onClick={() => setMenuOpen(false)}>📚 Regels</NavLink></li>
                    {profile?.is_admin && <li><NavLink to="/admin" onClick={() => setMenuOpen(false)}>⚙️ Admin</NavLink></li>}
                </ul>

                <div className="nav-right">
                    <div className="nav-user" onClick={() => navigate('/profile')} title="Profiel">
                        <div className="nav-avatar" style={{ width: 48, height: 48, fontSize: '1.2rem', overflow: 'hidden' }}>
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                (profile?.username || '?')[0].toUpperCase()
                            )}
                        </div>
                        <span style={{ fontSize: '0.85rem' }}>{profile?.username}</span>
                    </div>
                </div>
            </nav>

            <Outlet />

            {/* Mobile bottom nav */}
            <div className="bottom-nav">
                <ul className="bottom-nav-items">
                    <li><NavLink to="/"><span className="icon">🏠</span><span>Home</span></NavLink></li>
                    <li><NavLink to="/calendar"><span className="icon">📅</span><span>Kalender</span></NavLink></li>
                    <li><NavLink to="/history"><span className="icon">🕒</span><span>Historie</span></NavLink></li>
                    <li><NavLink to="/leagues"><span className="icon">🏆</span><span>Klassement</span></NavLink></li>
                    <li><NavLink to="/profile">
                        <div className="nav-avatar" style={{ width: 40, height: 40, fontSize: '1.2rem', overflow: 'hidden' }}>
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                (profile?.username || '?')[0].toUpperCase()
                            )}
                        </div>
                        <span>Profiel</span>
                    </NavLink></li>
                </ul>
            </div>
        </>
    )
}
