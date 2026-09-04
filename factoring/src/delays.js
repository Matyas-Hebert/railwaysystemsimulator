import * as tripRoutes from "./trip-routes.js";
import * as app from "./timetable-analysis.js";
import * as data from "../generated/timetable.js";
import * as config from "../generated/config.js";
import * as constants from "./constants.js";

function getLineTypeConfig(type){
    return config.lineTypes[type];
}

function seededRandom(a){
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function getNewDelayMultiplier(seed, currentdelayperc, type){
    currentdelayperc *= -1;
    const random = seededRandom(seed);
    const model = getLineTypeConfig(type).delayModel;
    let delay = -Math.log(
        1-(random+model.randomOffset)*model.randomScale
    )/model.logarithmDivisor;
    delay = Math.min(model.maximumMultiplier, delay)-model.baseOffset;
    if (model.minimumMultiplier !== null){
        delay = Math.max(model.minimumMultiplier, delay);
    }
    if (model.respectCurrentDelayMinimum || delay < 0){
        return Math.max(delay*model.recoveryMultiplier, currentdelayperc);
    }
    return delay;
}

function getStartingDelay(seed, type){
    const random = seededRandom(seed);
    return -Math.log(1-random)*getLineTypeConfig(type).startingDelayMeanSeconds;
}

function getDelay(
    lineID,
    tripNumber,
    time,
    stationID,
    daynumber,
    targetStopIndex = null
){
    const line = data.timetable.lines[lineID];
    const route = tripRoutes.getTripRoute(lineID, tripNumber);
    if (route === null) return null;
    let delay = getStartingDelay((tripNumber+1) * 100 + lineID * 100000 + daynumber, line.type);
    const starttime = line.starttime + line.interval*tripNumber + daynumber*constants.SECONDS_PER_DAY;
    const stops = line.stops;
    const routeStartStop = stops[route.startIndex];
    const routeEndStop = stops[route.endIndex];
    const matchingTargetIndices = tripRoutes.getTripStopIndices(
        lineID,
        tripNumber,
        stationID
    );
    const hasExplicitTargetIndex = Number.isInteger(targetStopIndex)
        && targetStopIndex >= route.startIndex
        && targetStopIndex <= route.endIndex
        && stops[targetStopIndex].sid === Number(stationID);
    const resolvedTargetStopIndex = hasExplicitTargetIndex
        ? targetStopIndex
        : matchingTargetIndices[0] ?? route.endIndex;
    const routeStartTime = starttime + routeStartStop.arr;
    let previousDepartureTime = starttime + routeStartStop.dep + delay;
    let expectedDepartureTime = previousDepartureTime-delay;

    if (routeStartTime-delay > time){
        return {"delay": 0, "status": constants.TRAIN_STATUS.NOT_DEPARTED, "station": routeStartStop.sid, "arrtime": Math.round(routeStartTime), "deptime": null, "progress": 1, "stopIndex": route.startIndex};
    }

    if (previousDepartureTime >= time){
        let status = route.startIndex === resolvedTargetStopIndex ? 3 : 1;
        return {"delay": Math.max(0, time-expectedDepartureTime), "status": status, "station": routeStartStop.sid, "arrtime": Math.round(routeStartTime), "deptime": Math.round(previousDepartureTime), "progress": 1, "stopIndex": route.startIndex};
    }

    let passedTargetStation = route.startIndex === resolvedTargetStopIndex;

    const expectedDepartureAtTarget = stops[resolvedTargetStopIndex].dep
        + starttime;

    for (let i = route.startIndex + 1; i <= route.endIndex; i++){
        const stoptime = line.stops[i].dep - line.stops[i].arr;
        const stop = line.stops[i];
        const standardTravelTime = stop.arr - line.stops[i-1].dep
        const dayssinceera = Math.floor(app.getCurrentTimeInMilliseconds() / (constants.MILLISECONDS_PER_DAY));
        let seed = i + (tripNumber+1) * 50 + lineID * 25000 + (dayssinceera + daynumber)*100000000;
        let newdelay = getNewDelayMultiplier(seed, delay/standardTravelTime, line.type)*standardTravelTime;
        const arrtime = starttime + stop.arr + delay + newdelay;
        if (arrtime > time){
            const progress = (time-previousDepartureTime)/(arrtime-previousDepartureTime);
            return {"delay": Math.round(delay+newdelay*progress), "status": passedTargetStation ? 4 : 2, "station": stops[i].sid,
                    "arrtime": Math.round(arrtime), "deptime": Math.round(previousDepartureTime), "progress": progress, "stopIndex": i};
        }

        if (i < route.endIndex
            && seededRandom(seed*2+1) <= getLineTypeConfig(line.type).cancellationProbabilityPerStop){
            const status = expectedDepartureAtTarget + delay + newdelay < time ? 7 : -1;
            return {"delay": Math.round(delay+newdelay), "status": status, "station": stops[i].sid,
                    "arrtime": Math.round(arrtime), "deptime": null, "progress": 1, "stopIndex": i};
        }

        if (i === resolvedTargetStopIndex){
            passedTargetStation = true;
        }

        delay += newdelay;
        delay -= Math.min(delay, stoptime/3);
        previousDepartureTime = starttime + stop.dep + delay;

        if (previousDepartureTime >= time){
            let status = passedTargetStation
                ? (i === resolvedTargetStopIndex ? 3 : 5)
                : 1;
            return {"delay": Math.round(delay), "status": status, "station": stops[i].sid,
                    "arrtime": Math.round(arrtime), "deptime": Math.round(previousDepartureTime), "progress": 1, "stopIndex": i};
        }
    }

    return {"delay": Math.round(delay), "status": constants.TRAIN_STATUS.FINISHED, "station": null,
                    "arrtime": null, "deptime": Math.round(starttime + routeEndStop.arr + delay), "progress": 1, "stopIndex": route.endIndex};
}

function getStatusText(status){
    if (status === constants.TRAIN_STATUS.NOT_DEPARTED) {return "Train havent depart yet"; }
    if (status === constants.TRAIN_STATUS.STOPPED_BEFORE_TARGET) {return "Train is stopped at a station before the target";}
    if (status === constants.TRAIN_STATUS.TRAVELLING_TO_TARGET) {return "Train is travelling towards target";}
    if (status === constants.TRAIN_STATUS.STOPPED_AT_TARGET) {return "Train is stopped at the target station";}
    if (status === constants.TRAIN_STATUS.TRAVELLING_PAST_TARGET) {return "Train is travelling past the target";}
    if (status === constants.TRAIN_STATUS.STOPPED_PAST_TARGET) {return "Train is stopped at a station past the target";}
    if (status === constants.TRAIN_STATUS.FINISHED) {return "Train have finished its journey";}
    return "unknown status "+String(status);
}

function getWifiChance(type){
    return getLineTypeConfig(type).workingWifiProbability;
}

function hasTrainWifi(lineID, tripID, day, type){
    let seed = tripID+lineID*201+day*81573;
    let r = seededRandom(seed);
    let newr = (r*123)-Math.floor(r*123);
    if (getWifiChance(type) >= newr){
        return true;
    }
    return false;
}

function hasTrainWifistation(statID, day){
    let seed = statID+day*5001;
    let r = seededRandom(seed);
    if (r >= 0.7){
        return true;
    }
    return false;
}

function getDelayReason(lineID, tripID, day){
    // config.delayReasons[0] je duvod, config.delayReasons[1] je weight
    let total = 0;
    config.delayReasons.forEach(reason => {
        total += reason[1];
    });
    let seed = tripID+lineID*201+day*81573;
    let r = seededRandom(seed);
    let target = total*r;
    total = 0;
    for (let i = 0; i < config.delayReasons.length; i++) {
        total += config.delayReasons[i][1];
        if (total >= target) {
            return config.delayReasons[i][0];
        }
    }

    return config.delayReasons[config.delayReasons.length - 1][0];
}

    export {
    getDelay as get,
    getDelayReason as getReason,
    getStatusText as getStatusText,
    hasTrainWifi as hasTrainWifi,
    hasTrainWifistation as hasStationWifi
};
