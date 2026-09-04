import * as delays from "./delays.js";
import * as tripRoutes from "./trip-routes.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as constants from "./constants.js";

    function shouldBoard(status) {
        return status === constants.TRAIN_STATUS.STOPPED_AT_TARGET
            || status === constants.TRAIN_STATUS.TRAVELLING_PAST_TARGET
            || status === constants.TRAIN_STATUS.STOPPED_PAST_TARGET
            || status === constants.TRAIN_STATUS.FINISHED
            || status === constants.TRAIN_STATUS.CANCELLED_AFTER_TARGET;
    }

    function shouldBeMarkedAsVisited(status) {
        return status === constants.TRAIN_STATUS.TRAVELLING_PAST_TARGET
            || status === constants.TRAIN_STATUS.STOPPED_PAST_TARGET
            || status === constants.TRAIN_STATUS.FINISHED
            || status === constants.TRAIN_STATUS.CANCELLED_AFTER_TARGET;
    }

    function check() {
        const selection = runtime.getGameState().getAutoBoardSelection();
        const position = runtime.getGameState().getCurrentPosition();
        if (selection === null
            || position === null
            || position.transporttype !== constants.TRANSPORT_TYPE.STATION) {
            return false;
        }

        const line = data.timetable.lines[selection.lineID];
        if (!line
            || selection.tripID < 0
            || selection.tripID >= line.trips) {
            runtime.getGameState().setAutoBoardSelection(null);
            return false;
        }
        const route = tripRoutes.getTripRoute(
            selection.lineID,
            selection.tripID
        );
        const selectedStopIndex = Number.isInteger(selection.stopIndex)
            && route !== null
            && selection.stopIndex >= route.startIndex
            && selection.stopIndex <= route.endIndex
            && line.stops[selection.stopIndex].sid === position.statID
            ? selection.stopIndex
            : tripRoutes.getTripStopIndex(
                selection.lineID,
                selection.tripID,
                position.statID
            );
        if (selectedStopIndex === -1) {
            runtime.getGameState().setAutoBoardSelection(null);
            runtime.getGameState().setAutoExitStationId(null);
            return false;
        }
        const time = app.getCurrentTimeInSeconds();
        const daysSinceEpoch = Math.floor(app.getCurrentTimeInMilliseconds() / constants.MILLISECONDS_PER_DAY);
        const relativeDay = selection.day - daysSinceEpoch;
        const currentDelay = delays.get(
            selection.lineID,
            selection.tripID,
            time,
            position.statID,
            relativeDay,
            selectedStopIndex
        );
        if (!shouldBoard(currentDelay.status)) return false;

        app.boardTrain(
            selection.lineID,
            selection.tripID,
            selection.day,
            selectedStopIndex
        );

        if (shouldBeMarkedAsVisited(currentDelay.status)) {
            runtime.getGameState().addVisitedLine(selection.lineID);
        }

        return true;
    }

    export {
    check
};
