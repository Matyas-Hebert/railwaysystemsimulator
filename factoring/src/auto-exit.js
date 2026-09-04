import * as delays from "./delays.js";
import * as tripRoutes from "./trip-routes.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as constants from "./constants.js";

    function shouldExit(status) {
        return status === constants.TRAIN_STATUS.STOPPED_AT_TARGET
            || status === constants.TRAIN_STATUS.TRAVELLING_PAST_TARGET
            || status === constants.TRAIN_STATUS.STOPPED_PAST_TARGET
            || status === constants.TRAIN_STATUS.FINISHED
            || status === constants.TRAIN_STATUS.CANCELLED_AFTER_TARGET;
    }

    function check() {
        const position = runtime.getGameState().getCurrentPosition();
        if (position === null || position.transporttype !== constants.TRANSPORT_TYPE.TRAIN) {
            return false;
        }

        const stationId = runtime.getGameState().getAutoExitStationId(position.lineID);
        if (stationId === null) return false;

        const line = data.timetable.lines[position.lineID];
        const route = tripRoutes.getTripRoute(position.lineID, position.tripID);
        if (!line || route === null) {
            runtime.getGameState().setAutoExitStationId(null);
            return false;
        }

        const boardedAtStopIndex = Number.isInteger(position.boardedAtStopIndex)
            ? position.boardedAtStopIndex
            : route.startIndex - 1;
        const targetStopIndex = tripRoutes.getTripStopIndex(
            position.lineID,
            position.tripID,
            stationId,
            boardedAtStopIndex
        );
        if (targetStopIndex === -1) {
            runtime.getGameState().setAutoExitStationId(null);
            return false;
        }

        const time = app.getCurrentTimeInSeconds();
        const daysSinceEpoch = Math.floor(
            app.getCurrentTimeInMilliseconds() / constants.MILLISECONDS_PER_DAY
        );
        const relativeDay = position.day >= 100
            ? position.day - daysSinceEpoch
            : position.day;
        const currentDelay = delays.get(
            position.lineID,
            position.tripID,
            time,
            stationId,
            relativeDay,
            targetStopIndex
        );
        if (!shouldExit(currentDelay.status)) return false;

        runtime.getGameState().setAutoExitStationId(null);
        runtime.getGameState().updateCurrentPosition({
            transporttype: constants.TRANSPORT_TYPE.STATION,
            statID: stationId,
            goalStatID: stationId
        });
        return true;
    }

    export {
    check
};
