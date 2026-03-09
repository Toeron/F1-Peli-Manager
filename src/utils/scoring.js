// Shared scoring logic for the frontend

export function getTeamPointsForDriver(session, position, driverId, myTeamDrivers, activePredictions) {
    if (!myTeamDrivers || !myTeamDrivers.includes(driverId)) return 0

    let base = 0
    if (session === 'race') {
        const ptsArr = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
        base = position <= 10 ? ptsArr[position - 1] : 0
    } else if (session === 'qualifying' || session === 'sprint_qualifying') {
        base = position <= 8 ? (9 - position) : 0
    } else if (session === 'sprint') {
        const ptsArr = [8, 7, 6, 5, 4, 3, 2, 1]
        base = position <= 8 ? Math.round(ptsArr[position - 1] * 0.25) : 0
    }

    const multiplier = getSynergyMultiplier(session, position, driverId, myTeamDrivers, activePredictions) || 1.0
    return Math.round(base * multiplier)
}

export function getPredictionMatch(session, position, driverId, activePredictions) {
    const pred = activePredictions[session]
    if (!pred) return null

    let predPos = null
    if (pred.p1_driver_id === driverId) predPos = 1
    else if (pred.p2_driver_id === driverId) predPos = 2
    else if (pred.p3_driver_id === driverId) predPos = 3

    if (!predPos) return null

    const dist = Math.abs(position - predPos)
    if (dist === 0) return 'exact'
    if (dist <= 2) return 'close'

    return null
}

export function getSynergyMultiplier(session, position, driverId, myTeamDrivers, activePredictions) {
    if (!myTeamDrivers || !myTeamDrivers.includes(driverId) || position > 3) return null
    const pred = activePredictions[session]
    if (!pred) return null

    let predPos = null
    if (pred.p1_driver_id === driverId) predPos = 1
    else if (pred.p2_driver_id === driverId) predPos = 2
    else if (pred.p3_driver_id === driverId) predPos = 3

    if (!predPos) return null

    const dist = Math.abs(position - predPos)
    if (dist === 0) return 2.0
    if (dist === 1) return 1.5
    if (dist === 2) return 1.25
    return null
}

export function getPredictionPoints(session, position, driverId, activePredictions) {
    const match = getPredictionMatch(session, position, driverId, activePredictions)
    if (!match) return 0

    const pred = activePredictions[session]
    let predPos = null
    if (pred.p1_driver_id === driverId) predPos = 1
    else if (pred.p2_driver_id === driverId) predPos = 2
    else if (pred.p3_driver_id === driverId) predPos = 3

    if (!predPos) return 0

    let base = 0
    if (session === 'race') {
        const ptsArr = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
        base = position <= 10 ? ptsArr[position - 1] : 0
    } else if (session === 'sprint') {
        const ptsArr = [8, 7, 6, 5, 4, 3, 2, 1]
        base = position <= 8 ? ptsArr[position - 1] : 0
    } else if (session === 'qualifying' || session === 'sprint_qualifying') {
        const ptsArr = [8, 7, 6, 5, 4, 3, 2, 1]
        base = position <= 8 ? ptsArr[position - 1] : 0
    }

    const dist = Math.abs(position - predPos)
    const mult = dist === 0 ? 1.0 : (dist === 1 ? 0.5 : (dist === 2 ? 0.25 : 0))
    return Math.round(base * mult)
}

export function getPredictionDetails(session, position, driverId, activePredictions) {
    const match = getPredictionMatch(session, position, driverId, activePredictions)
    if (!match) return null

    const pred = activePredictions[session]
    let predPos = null
    if (pred.p1_driver_id === driverId) predPos = 1
    else if (pred.p2_driver_id === driverId) predPos = 2
    else if (pred.p3_driver_id === driverId) predPos = 3

    if (!predPos) return null

    let base = 0
    if (session === 'race') {
        const ptsArr = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
        base = position <= 10 ? ptsArr[position - 1] : 0
    } else if (session === 'sprint') {
        const ptsArr = [8, 7, 6, 5, 4, 3, 2, 1]
        base = position <= 8 ? ptsArr[position - 1] : 0
    } else if (session === 'qualifying' || session === 'sprint_qualifying') {
        const ptsArr = [8, 7, 6, 5, 4, 3, 2, 1]
        base = position <= 8 ? ptsArr[position - 1] : 0
    }

    const dist = Math.abs(position - predPos)
    const mult = dist === 0 ? 1.0 : (dist === 1 ? 0.5 : (dist === 2 ? 0.25 : 0))
    const pts = Math.round(base * mult)

    let text = ''
    if (dist === 0) text = `Exact (100% van ${base} pnt)`
    else if (dist === 1) text = `1 plek ernaast (50% van ${base} pnt)`
    else if (dist === 2) text = `2 plekken ernaast (25% van ${base} pnt)`

    return { pts, text }
}
