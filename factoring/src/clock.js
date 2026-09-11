import * as runtime from "./runtime.js";
import * as constants from "./constants.js";

export function getCurrentTimeInMilliseconds(timeTravelled = null) {
    const offsetSeconds = timeTravelled === null
        ? runtime.getGameState().getTimeTravelled()
        : timeTravelled;
    return Date.now() + offsetSeconds * 1000;
}

export function getCurrentDayNumber() {
    const timestamp = getCurrentTimeInMilliseconds();
    const date = new Date(timestamp);
    const localTimestamp = timestamp
        - date.getTimezoneOffset() * 60 * 1000;
    return Math.floor(localTimestamp / constants.MILLISECONDS_PER_DAY);
}
