import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Profile() {
    const { profile, fetchProfile, signOut } = useAuth()
    const [displayName, setDisplayName] = useState(profile?.display_name || '')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)

    async function saveProfile() {
        setSaving(true)
        setSaved(false)
        await supabase
            .from('profiles')
            .update({ display_name: displayName })
            .eq('id', profile.id)
        await fetchProfile(profile.id)
        setSaved(true)
        setSaving(false)
    }

    async function handleAvatarUpload(e) {
        const file = e.target.files[0]
        if (!file) return

        // Basic validation
        if (file.size > 2 * 1024 * 1024) {
            alert('Afbeelding is te groot (max 2MB)')
            return
        }

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const filePath = `${profile.id}/avatar-${Math.random()}.${fileExt}` // Cache busting with random suffix

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            // Update profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', profile.id)

            if (updateError) throw updateError

            await fetchProfile(profile.id)
        } catch (err) {
            console.error('Upload error:', err)
            alert('Fout bij uploaden: ' + err.message)
        } finally {
            setUploading(false)
        }
    }

    function formatBudget(val) {
        return '$' + (Number(val) / 1000000).toFixed(1) + 'M'
    }

    if (!profile) return null

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 600 }}>
                <div className="page-header banner-profile">
                    <div className="page-header-content">
                        <h1>Profiel</h1>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 12px' }}>
                            <div className="nav-avatar" style={{
                                width: '100%',
                                height: '100%',
                                fontSize: '2rem',
                                overflow: 'hidden',
                                border: '2px solid var(--border)'
                            }}>
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    (profile.username || '?')[0].toUpperCase()
                                )}
                            </div>
                            <button
                                className="btn btn-secondary btn-small"
                                style={{
                                    position: 'absolute',
                                    bottom: -8,
                                    right: -8,
                                    padding: 6,
                                    borderRadius: '50%',
                                    width: 32,
                                    height: 32,
                                    border: '1px solid var(--border)',
                                    boxShadow: 'var(--shadow)'
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? '...' : '📷'}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleAvatarUpload}
                            />
                        </div>
                        <h3>{profile.display_name || profile.username}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>@{profile.username}</p>
                    </div>

                    <div className="stats-row" style={{ marginBottom: 20 }}>
                        <div className="stat-card">
                            <div className="stat-value">{formatBudget(profile.budget)}</div>
                            <div className="stat-label">Budget</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{profile.total_points}</div>
                            <div className="stat-label">Punten</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Weergavenaam</label>
                        <input className="form-input" value={displayName}
                            onChange={e => setDisplayName(e.target.value)} placeholder="Jouw naam" />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                            {saving ? 'Opslaan...' : '✓ Opslaan'}
                        </button>
                        {saved && <span style={{ color: 'var(--green)', alignSelf: 'center', fontSize: '0.85rem' }}>Opgeslagen!</span>}
                    </div>
                </div>

                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={signOut}>
                    Uitloggen
                </button>
            </div>
        </div>
    )
}
