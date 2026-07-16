const autoBoarding = (() => {
    function shouldBoard(status) {
        return status === TRAIN_STATUS.STOPPED_AT_TARGET
            || status === TRAIN_STATUS.TRAVELLING_PAST_TARGET
            || status === TRAIN_STATUS.STOPPED_PAST_TARGET
            || status === TRAIN_STATUS.FINISHED
            || status === TRAIN_STATUS.CANCELLED_AFTER_TARGET;
    }

    function shouldBeMarkedAsVisited(status) {
        return status === TRAIN_STATUS.TRAVELLING_PAST_TARGET
            || status === TRAIN_STATUS.STOPPED_PAST_TARGET
            || status === TRAIN_STATUS.FINISHED
            || status === TRAIN_STATUS.CANCELLED_AFTER_TARGET;
    }

    function check() {
        const selection = gameState.getAutoBoardSelection();
        const position = gameState.getCurrentPosition();
        if (selection === null
            || position === null
            || position.transporttype !== TRANSPORT_TYPE.STATION) {
            return false;
        }

        const line = timetable.lines[selection.lineID];
        if (!line
            || selection.tripID < 0
            || selection.tripID >= line.trips) {
            gameState.setAutoBoardSelection(null);
            return false;
        }

        const time = getCurrentTimeInSeconds();
        const daysSinceEpoch = Math.floor(getCurrentTimeInMilliseconds() / MILLISECONDS_PER_DAY);
        const relativeDay = selection.day - daysSinceEpoch;
        const currentDelay = delays.get(
            selection.lineID,
            selection.tripID,
            time,
            position.statID,
            relativeDay
        );
        if (!shouldBoard(currentDelay.status)) return false;

        gameState.setAutoBoardSelection(null);
        boardTrain(selection.lineID, selection.tripID, selection.day);

        if (shouldBeMarkedAsVisited(currentDelay.status)) {
            gameState.addVisitedLine(selection.lineID);
        }

        return true;
    }

    return { check };
})();