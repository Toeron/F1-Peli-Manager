// Maps driver abbreviation to their icon filename
const driverIcons = {
    VER: 'verstappen',
    HAD: 'hadjar',
    NOR: 'norris',
    PIA: 'piastri',
    LEC: 'leclerc',
    HAM: 'hamilton',
    RUS: 'russel',
    ANT: 'antonelli',
    ALO: 'alonso',
    STR: 'stroll',
    GAS: 'gasly',
    COL: 'colapinto',
    OCO: 'ocon',
    BEA: 'bearman',
    LAW: 'lawson',
    LIN: 'lindblad',
    ALB: 'albon',
    SAI: 'sainz',
    HUL: 'hulkenberg',
    BOR: 'bortoleto',
    PER: 'perez',
    BOT: 'bottas',
}

export function getDriverIcon(abbreviation) {
    const file = driverIcons[abbreviation]
    if (!file) return null
    return `/drivers/${file}.png?v=2026`
}

export function DriverAvatar({ abbreviation, name, src, size = 40, className = '' }) {
    let icon = src || getDriverIcon(abbreviation)
    if (icon && icon.startsWith('/drivers/') && !icon.includes('?')) {
        icon += '?v=2026'
    }
    return (
        <div className={`driver-avatar ${className}`} style={{ width: size, height: size }}>
            {icon ? (
                <img src={icon} alt={name || abbreviation}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
                <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: 'var(--bg-input)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700
                }}>
                    {abbreviation?.slice(0, 2) || '?'}
                </div>
            )}
        </div>
    )
}
