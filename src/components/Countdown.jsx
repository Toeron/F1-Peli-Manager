import { useEffect, useState, useRef } from 'react'

export default function Countdown({ targetDate }) {
    const [timeLeft, setTimeLeft] = useState(calcTime())
    const interval = useRef()

    function calcTime() {
        if (!targetDate) return null
        const diff = new Date(targetDate) - new Date()
        if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true }
        return {
            d: Math.floor(diff / 86400000),
            h: Math.floor((diff % 86400000) / 3600000),
            m: Math.floor((diff % 3600000) / 60000),
            s: Math.floor((diff % 60000) / 1000),
            expired: false
        }
    }

    useEffect(() => {
        interval.current = setInterval(() => setTimeLeft(calcTime()), 1000)
        return () => clearInterval(interval.current)
    }, [targetDate])

    if (!timeLeft) return null
    if (timeLeft.expired) return <span className="badge badge-live">🔴 Gesloten</span>

    return (
        <div className="countdown">
            <div className="countdown-item">
                <div className="countdown-value">{String(timeLeft.d).padStart(2, '0')}</div>
                <div className="countdown-label">Dagen</div>
            </div>
            <div className="countdown-item">
                <div className="countdown-value">{String(timeLeft.h).padStart(2, '0')}</div>
                <div className="countdown-label">Uren</div>
            </div>
            <div className="countdown-item">
                <div className="countdown-value">{String(timeLeft.m).padStart(2, '0')}</div>
                <div className="countdown-label">Min</div>
            </div>
            <div className="countdown-item">
                <div className="countdown-value">{String(timeLeft.s).padStart(2, '0')}</div>
                <div className="countdown-label">Sec</div>
            </div>
        </div>
    )
}
