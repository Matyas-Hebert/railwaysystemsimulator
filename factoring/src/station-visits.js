import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as constants from "./constants.js";

    const REQUIRED_STATION_TIME = 3 * 60 * 1000;

    function synchronizeStationEntry(now = app.getCurrentTimeInMilliseconds()) {
        const position = runtime.getGameState().getCurrentPosition();
        if (position === null || position.transporttype !== constants.TRANSPORT_TYPE.STATION) return;

        const state = runtime.getGameState().getStationVisitState();
        const stationId = Number(position.statID);
        if (state.stationId !== stationId || state.enteredAt == null) {
            runtime.getGameState().updateStationVisitState({
                stationId,
                enteredAt: now
            });
        }
    }

    function setStationEntry(stationId, enteredAt) {
        runtime.getGameState().updateStationVisitState({
            stationId: Number(stationId),
            enteredAt
        });
    }

    function markVisited(stationId) {
        stationId = Number(stationId);
        if (!Number.isInteger(stationId)) return false;

        const state = runtime.getGameState().getStationVisitState();
        if (state.visitedStationIds.includes(stationId)) return false;

        runtime.getGameState().updateStationVisitState({
            visitedStationIds: [...state.visitedStationIds, stationId]
        });
        document.dispatchEvent(new CustomEvent("station-visited", {
            detail: { stationId }
        }));

        return true;
    }

    function markCurrentStationVisited() {
        const position = runtime.getGameState().getCurrentPosition();
        if (position === null || position.transporttype !== constants.TRANSPORT_TYPE.STATION) return false;
        return markVisited(position.statID);
    }

    function hasStayedLongEnough(now = app.getCurrentTimeInMilliseconds()) {
        const state = runtime.getGameState().getStationVisitState();
        return state.enteredAt != null && now - state.enteredAt >= REQUIRED_STATION_TIME;
    }

    function checkElapsedTime(now = app.getCurrentTimeInMilliseconds()) {
        synchronizeStationEntry(now);
        if (hasStayedLongEnough(now)) {
            markCurrentStationVisited();
        }
    }

    function checkBeforeBoarding(lineId, tripId, now = app.getCurrentTimeInMilliseconds()) {
        synchronizeStationEntry(now);
        const position = runtime.getGameState().getCurrentPosition();
        const state = runtime.getGameState().getStationVisitState();

        if (position !== null && position.transporttype === constants.TRANSPORT_TYPE.STATION) {
            const changedTrain = state.previousLineId != null
                && state.previousTripId != null
                && (state.previousLineId !== lineId || state.previousTripId !== tripId);

            if (hasStayedLongEnough(now) || changedTrain) {
                markCurrentStationVisited();
            }
        }

        runtime.getGameState().updateStationVisitState({
            previousLineId: lineId,
            previousTripId: tripId
        });
    }

    function getVisitedStationIds() {
        return [...runtime.getGameState().getStationVisitState().visitedStationIds];
    }

    function isVisited(stationId) {
        return runtime.getGameState().hasVisitedStation(stationId);
    }

    function reset() {
        runtime.getGameState().setStationVisitState({
            stationId: null,
            enteredAt: null,
            previousLineId: null,
            previousTripId: null,
            visitedStationIds: []
        });
    }

    export {
    checkElapsedTime,
    checkBeforeBoarding,
    getVisitedStationIds,
    isVisited,
    markVisited,
    reset,
    setStationEntry
};
