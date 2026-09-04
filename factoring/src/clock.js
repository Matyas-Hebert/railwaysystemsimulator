import * as runtime from "./runtime.js";

export function getCurrentTimeInMilliseconds(timeTravelled = null) {
    const offsetSeconds = timeTravelled === null
        ? runtime.getGameState().getTimeTravelled()
        : timeTravelled;
    return Date.now() + offsetSeconds * 1000;
}
