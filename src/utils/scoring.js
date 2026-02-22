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
    if (position === 1 && pred.p1_driver_id === driverId) return 'exact'
    if (position === 2 && pred.p2_driver_id === driverId) return 'exact'
    if (position === 3 && pred.p3_driver_id === driverId) return 'exact'
    const predDrivers = [pred.p1_driver_id, pred.p2_driver_id, pred.p3_driver_id]
    if (position <= 3 && predDrivers.includes(driverId)) return 'close'
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
        const ptsArr = [15, 10, 5]
        base = ptsArr[predPos - 1]
    } else if (session === 'sprint') {
        const ptsArr = [5, 3, 1]
        base = ptsArr[predPos - 1]
    } else if (session === 'qualifying' || session === 'sprint_qualifying') {
        const ptsArr = [10, 6, 3]
        base = ptsArr[predPos - 1]
    }

    const dist = Math.abs(position - predPos)
    const mult = dist === 0 ? 1.0 : (dist === 1 ? 0.5 : (dist === 2 ? 0.25 : 0))
    return Math.round(base * mult)
}
