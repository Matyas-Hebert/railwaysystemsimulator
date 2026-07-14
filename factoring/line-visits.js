const lineVisits = (() => {
    function checkCurrentLine() {
        const position = gameState.getCurrentPosition();
        if (position === null || position.transporttype !== TRANSPORT_TYPE.TRAIN) return;

        const line = timetable.lines[position.lineID];
        if (!line || position.tripID == null || position.day == null) return;

        const now = new Date();
        const time = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const daysSinceEpoch = Math.floor(getCurrentTimeInMilliseconds() / MILLISECONDS_PER_DAY);
        const day = position.day >= 100 ? position.day - daysSinceEpoch : position.day;
        const currentDelay = delays.get(
            position.lineID,
            position.tripID,
            time,
            line.stops[line.stops.length - 1],
            day
        );

        if (currentDelay.status === TRAIN_STATUS.TRAVELLING_TO_TARGET
            || currentDelay.status === TRAIN_STATUS.TRAVELLING_PAST_TARGET) {
            if (!isVisited(position.lineID)) {
                gameState.addVisitedLine(position.lineID);
                document.dispatchEvent(new CustomEvent("line-visited", {
                    detail: { lineId: Number(position.lineID) }
                }));
            }

            if (currentDelay.delay > 5 * 60) {
                const delayReason = delays.getReason(position.lineID, position.tripID, day);
                if (gameState.addCollectedDelayReason(delayReason)) {
                    document.dispatchEvent(new CustomEvent("delay-reason-collected", {
                        detail: { delayReason }
                    }));
                }
            }
        }
    }

    function isVisited(lineId) {
        return gameState.getVisitedLines().includes(Number(lineId));
    }

    return { checkCurrentLine, isVisited };
})();