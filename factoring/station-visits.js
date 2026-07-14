const stationVisits = (() => {
    const REQUIRED_STATION_TIME = 3 * 60 * 1000;

    function synchronizeStationEntry(now = getCurrentTimeInMilliseconds()) {
        const position = gameState.getCurrentPosition();
        if (position === null || position.transporttype !== TRANSPORT_TYPE.STATION) return;

        const state = gameState.getStationVisitState();
        const stationId = Number(position.statID);
        if (state.stationId !== stationId || state.enteredAt == null) {
            gameState.updateStationVisitState({
                stationId,
                enteredAt: now
            });
        }
    }

    function markCurrentStationVisited() {
        const position = gameState.getCurrentPosition();
        if (position === null || position.transporttype !== TRANSPORT_TYPE.STATION) return false;

        const stationId = Number(position.statID);
        const state = gameState.getStationVisitState();
        if (state.visitedStationIds.includes(stationId)) return false;

        gameState.updateStationVisitState({
            visitedStationIds: [...state.visitedStationIds, stationId]
        });
        document.dispatchEvent(new CustomEvent("station-visited", {
            detail: { stationId }
        }));
        return true;
    }

    function hasStayedLongEnough(now = getCurrentTimeInMilliseconds()) {
        const state = gameState.getStationVisitState();
        return state.enteredAt != null && now - state.enteredAt >= REQUIRED_STATION_TIME;
    }

    function checkElapsedTime(now = getCurrentTimeInMilliseconds()) {
        synchronizeStationEntry(now);
        if (hasStayedLongEnough(now)) {
            markCurrentStationVisited();
        }
    }

    function checkBeforeBoarding(lineId, tripId, now = getCurrentTimeInMilliseconds()) {
        synchronizeStationEntry(now);
        const position = gameState.getCurrentPosition();
        const state = gameState.getStationVisitState();

        if (position !== null && position.transporttype === TRANSPORT_TYPE.STATION) {
            const changedTrain = state.previousLineId != null
                && state.previousTripId != null
                && (state.previousLineId !== lineId || state.previousTripId !== tripId);

            if (hasStayedLongEnough(now) || changedTrain) {
                markCurrentStationVisited();
            }
        }

        gameState.updateStationVisitState({
            previousLineId: lineId,
            previousTripId: tripId
        });
    }

    function isVisited(stationId) {
        return gameState.getStationVisitState().visitedStationIds.includes(Number(stationId));
    }

    function reset() {
        gameState.setStationVisitState({
            stationId: null,
            enteredAt: null,
            previousLineId: null,
            previousTripId: null,
            visitedStationIds: []
        });
    }

    return { checkElapsedTime, checkBeforeBoarding, isVisited, reset };
})();
