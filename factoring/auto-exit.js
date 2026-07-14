const autoExit = (() => {
    function shouldExit(status) {
        return status === TRAIN_STATUS.STOPPED_AT_TARGET
            || status === TRAIN_STATUS.TRAVELLING_PAST_TARGET
            || status === TRAIN_STATUS.STOPPED_PAST_TARGET
            || status === TRAIN_STATUS.FINISHED
            || status === TRAIN_STATUS.CANCELLED_AFTER_TARGET;
    }

    function check() {
        const stationId = gameState.getAutoExitStationId();
        const position = gameState.getCurrentPosition();
        if (stationId === null
            || position === null
            || position.transporttype !== TRANSPORT_TYPE.TRAIN) {
            return false;
        }

        const line = timetable.lines[position.lineID];
        if (!line || !line.stops.some(stop => stop.sid === stationId)) {
            gameState.setAutoExitStationId(null);
            return false;
        }

        const now = new Date();
        const time = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const daysSinceEpoch = Math.floor(getCurrentTimeInMilliseconds() / MILLISECONDS_PER_DAY);
        const relativeDay = position.day >= 100
            ? position.day - daysSinceEpoch
            : position.day;
        const currentDelay = delays.get(
            position.lineID,
            position.tripID,
            time,
            stationId,
            relativeDay
        );
        if (!shouldExit(currentDelay.status)) return false;

        gameState.setAutoExitStationId(null);
        gameState.updateCurrentPosition({
            transporttype: TRANSPORT_TYPE.STATION,
            statID: stationId,
            goalStatID: stationId
        });
        return true;
    }

    return { check };
})();