const delays = (() => {
function getStopTimeForType(type){
    if (type <= 1){
        return 30;
    }
    if (type <= 4){
        return 90;
    }
    return 180; // in seconds
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
    let x = seededRandom(seed);
    if (type == 0){
        let delay = Math.max(-0.1,
            Math.min(2,
                -Math.log(1-(5/2)*(x-(3/5)))/2
            )
        )
        if (delay < currentdelayperc){
            return currentdelayperc;
        }
        return delay;
    }
    if (type == 1){
        let delay = Math.min(2,
            -Math.log(1-(x+(3/20))*(20/23))/6
        )-0.05;
        if (delay < 0){
            return Math.max(delay*4, currentdelayperc);
        }
        return delay;
    }
    if (type == 2){
        let delay = Math.min(2,
            -Math.log(1-(x+(1/10))*(10/11))/3.5
        )-0.05;
        if (delay < 0){
            return Math.max(delay*3, currentdelayperc);
        }
        return delay;
    }
    if (type == 3){
        let delay = Math.min(2,
            -Math.log(1-(x+(1/10))*(10/11))/3
        )-0.07;
        if (delay < 0){
            return Math.max(delay*3, currentdelayperc);
        }
        return delay;
    }
    if (type == 4){
        let delay = Math.max(0,
            Math.min(2,
                -Math.log(1-x)/8.3
            )
        );
        if (delay < 0){
            return Math.max(delay, currentdelayperc);
        }
        return delay;
    }
    if (type == 5){
        let delay = Math.min(2,
            -Math.log(1-(x+(1/10))*(10/11))/2.5
        )-0.07;
        if (delay < 0){
            return Math.max(delay*3, currentdelayperc);
        }
        return delay;
    }
    return 0;
}

function getDelayMultiplier(seed, currentdelayperc, type){
    let rand = seededRandom(seed);

    if(type == 5){
        if (rand > 0.9) {
            return (1 - rand) * 30;
        }
        else if (rand > 0.2) {
            return (rand - 0.3) * 0.6;
        }
        else if (rand < 0.2) {
            let maxCatch = 0.1;
            return -Math.min(maxCatch, currentdelayperc);
        }
    }
    if(type >= 2){
        if (rand > 0.9) {
            return (1 - rand) * 20;
        }
        else if (rand > 0.3) {
            return (rand - 0.3) * 0.6;
        }
        else if (rand < 0.1) {
            let maxCatch = 0.1;
            return -Math.min(maxCatch, currentdelayperc);
        }
    }
    if (rand > 0.96) {
        return (1 - rand) * 30;
    }
    else if (rand > 0.3) {
        return (rand - 0.3) * 0.5;
    }
    else if (rand < 0.1) {
        let maxCatch = 0.1;
        return -Math.min(maxCatch, currentdelayperc);
    }
    return 0;
}

function getStartingDelay(seed, type){
    let rand = seededRandom(seed);
    if (type == 5){
        return -Math.log(1-rand)*100;
    }
    if (type >= 2){
        return -Math.log(1-rand)*90;
    }
    else{
        return -Math.log(1-rand)*50;
    }
    return 0;
}

function getDelay(lineID, tripNumber, time, stationID, daynumber){
    const line = timetable.lines[lineID];
    let delay = getStartingDelay((tripNumber+1) * 100 + lineID * 100000 + daynumber, line.type);
    const starttime = line.starttime + line.interval*tripNumber + daynumber*SECONDS_PER_DAY;
    const stops =  line.stops;
    let previousDepartureTime = starttime + stops[0].dep + delay;
    let expectedDepartureTime = previousDepartureTime-delay;

    if (starttime-delay > time){
        return {"delay": 0, "status": TRAIN_STATUS.NOT_DEPARTED, "station": stops[0].sid, "arrtime": Math.round(starttime), "deptime": null, "progress": 1};
    }

    if (previousDepartureTime >= time){
        let status = stops[0].sid == stationID ? 3 : 1;
        return {"delay": Math.max(0, time-expectedDepartureTime), "status": status, "station": stops[0].sid, "arrtime": Math.round(starttime), "deptime": Math.round(previousDepartureTime), "progress": 1};
    }

    let passedTargetStation = false;

    if (stops[0].sid == stationID){
        passedTargetStation = true;
    }

    let expectedDepartureAtTarget;
    stops.forEach(stop => {
        if (stop.sid == stationID){
            expectedDepartureAtTarget = stop.dep + starttime;
            return;
        }
    });

    for (let i = 1; i < line.stops.length; i++){
        const stoptime = line.stops[i].dep - line.stops[i].arr;
        const stop = line.stops[i];
        const standardTravelTime = stop.arr - line.stops[i-1].dep
        const dayssinceera = Math.floor(getCurrentTimeInMilliseconds() / (MILLISECONDS_PER_DAY));
        let seed = i + (tripNumber+1) * 50 + lineID * 25000 + (dayssinceera + daynumber)*100000000;
        let newdelay = getNewDelayMultiplier(seed, delay/standardTravelTime, line.type)*standardTravelTime;
        const arrtime = starttime + stop.arr + delay + newdelay;
        if (arrtime > time){
            const progress = (time-previousDepartureTime)/(arrtime-previousDepartureTime);
            return {"delay": Math.round(delay+newdelay*progress), "status": passedTargetStation ? 4 : 2, "station": stops[i].sid,
                    "arrtime": Math.round(arrtime), "deptime": Math.round(previousDepartureTime), "progress": progress};
        }

        if (i < line.stops.length-1 && seededRandom(seed*2+1) <= 0.0023){
            const status = expectedDepartureAtTarget + delay + newdelay < time ? 7 : -1;
            return {"delay": Math.round(delay+newdelay), "status": status, "station": stops[i].sid,
                    "arrtime": Math.round(arrtime), "deptime": null, "progress": 1};
        }

        if (stop.sid == stationID){
            passedTargetStation = true;
        }

        delay += newdelay;
        delay -= Math.min(delay, stoptime/3);
        previousDepartureTime = starttime + stop.dep + delay;

        if (previousDepartureTime >= time){
            let status = passedTargetStation ? (stop.sid == stationID ? 3 : 5) : 1;
            return {"delay": Math.round(delay), "status": status, "station": stops[i].sid,
                    "arrtime": Math.round(arrtime), "deptime": Math.round(previousDepartureTime), "progress": 1};
        }
    }

    return {"delay": Math.round(delay), "status": TRAIN_STATUS.FINISHED, "station": null,
                    "arrtime": null, "deptime": Math.round(previousDepartureTime), "progress": 1};
}

function getStatusText(status){
    if (status === TRAIN_STATUS.NOT_DEPARTED) {return "Train havent depart yet"; }
    if (status === TRAIN_STATUS.STOPPED_BEFORE_TARGET) {return "Train is stopped at a station before the target";}
    if (status === TRAIN_STATUS.TRAVELLING_TO_TARGET) {return "Train is travelling towards target";}
    if (status === TRAIN_STATUS.STOPPED_AT_TARGET) {return "Train is stopped at the target station";}
    if (status === TRAIN_STATUS.TRAVELLING_PAST_TARGET) {return "Train is travelling past the target";}
    if (status === TRAIN_STATUS.STOPPED_PAST_TARGET) {return "Train is stopped at a station past the target";}
    if (status === TRAIN_STATUS.FINISHED) {return "Train have finished its journey";}
    return "unknown status "+String(status);
}

function getWifiChance(type){
    if (type == 0){
        return 0.9;
    }
    if (type == 1){
        return 0.75;
    }
    if (type == 2){
        return 0.4;
    }
    if (type == 3){
        return 0.2;
    }
    if (type == 4){
        return 0.6;
    }
    if (type == 5){
        return 0.1;
    }
}

function hasTrainWifi(lineID, tripID, day, type){
    let seed = tripID+lineID*201+day*81573;
    let r = seededRandom(seed);
    let newr = (r*123)-Math.floor(r*123);
    if (getWifiChance(type)+wifiluckboost >= newr){
        return true;
    }
    return false;
}

function hasTrainWifistation(statID, day){
    let seed = statID+day*5001;
    let r = seededRandom(seed);
    if (r+wifiluckboost >= 0.7){
        return true;
    }
    return false;
}

function getDelayReason(lineID, tripID, day){
    // reasons[0] je duvod, reasons[1] je weight
    let total = 0;
    reasons.forEach(reason => {
        total += reason[1];
    });
    let seed = tripID+lineID*201+day*81573;
    let r = seededRandom(seed);
    let target = total*r;
    total = 0;
    for (let i = 0; i < reasons.length; i++) {
        total += reasons[i][1];
        if (total >= target) {
            return reasons[i][0];
        }
    }

    return reasons[reasons.length - 1][0];
}

    return {
        get: getDelay,
        getReason: getDelayReason,
        getStatusText: getStatusText,
        hasTrainWifi: hasTrainWifi,
        hasStationWifi: hasTrainWifistation
    };
})();
