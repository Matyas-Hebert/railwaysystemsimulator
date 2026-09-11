import * as delays from "./delays.js";
import * as tripRoutes from "./trip-routes.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as constants from "./constants.js";

    function checkCurrentLine() {
        const position = runtime.getGameState().getCurrentPosition();
        if (position === null || position.transporttype !== constants.TRANSPORT_TYPE.TRAIN) return;

        const line = data.timetable.lines[position.lineID];
        if (!line || position.tripID == null || position.day == null) return;

        const time = app.getCurrentTimeInSeconds();
        const day = position.day >= 100 ? position.day - app.getCurrentDayNumber() : position.day;
        const destinationStationId = tripRoutes.getTripDestinationStationId(
            position.lineID,
            position.tripID
        );
        const currentDelay = delays.get(
            position.lineID,
            position.tripID,
            time,
            destinationStationId,
            day,
            tripRoutes.getTripRoute(position.lineID, position.tripID).endIndex
        );

        if (currentDelay.status === constants.TRAIN_STATUS.TRAVELLING_TO_TARGET
            || currentDelay.status === constants.TRAIN_STATUS.TRAVELLING_PAST_TARGET) {
            if (runtime.getGameState().addVisitedLine(position.lineID)) {
                document.dispatchEvent(new CustomEvent("line-visited", {
                    detail: { lineId: Number(position.lineID) }
                }));
            }

            if (currentDelay.delay > 5 * 60) {
                const delayReason = delays.getReason(position.lineID, position.tripID, day);
                if (runtime.getGameState().addCollectedDelayReason(delayReason)) {
                    document.dispatchEvent(new CustomEvent("delay-reason-collected", {
                        detail: { delayReason }
                    }));
                }
            }
        }
    }

    function isVisited(lineId) {
        return runtime.getGameState().hasVisitedLine(lineId);
    }

    export {
    checkCurrentLine,
    isVisited
};
