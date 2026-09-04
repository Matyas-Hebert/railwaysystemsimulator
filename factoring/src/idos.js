import * as config from "../generated/config.js";
import * as connection from "./connection.js";
import * as settings from "./settings.js";
import * as tripRoutes from "./trip-routes.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as constants from "./constants.js";

    let locations = [69, 420];
    let departureTime = 0;
    let includeAirRoutes = true;

let raptorIndex = null;

function getRaptorIndex() {
    if (raptorIndex !== null) return raptorIndex;

    const routesByStation = data.timetable.stations.map(station =>
        [...new Set(station.departures || [])]
    );
    const isTransferStation = routesByStation.map(routes => routes.length > 1);
    const distancesByLine = data.timetable.lines.map(line => {
        const distances = new Float64Array(line.stops.length);
        for (let index = 1; index < line.stops.length; index++) {
            distances[index] = distances[index - 1] + line.stops[index].dist;
        }
        return distances;
    });
    const tripServicesByLine = data.timetable.lines.map(line => {
        const servicesByStop = Array.from(
            { length: line.stops.length },
            () => new Map()
        );
        for (let tripID = 0; tripID < line.trips; tripID++) {
            const route = tripRoutes.getTripRoute(line.id, tripID);
            if (route === null) continue;
            for (
                let stopIndex = route.startIndex;
                stopIndex < route.endIndex;
                stopIndex++
            ) {
                const servicesByTerminus = servicesByStop[stopIndex];
                if (!servicesByTerminus.has(route.endIndex)) {
                    servicesByTerminus.set(route.endIndex, []);
                }
                servicesByTerminus.get(route.endIndex).push(tripID);
            }
        }
        return servicesByStop.map(servicesByTerminus =>
            [...servicesByTerminus.entries()].map(([endIndex, tripIDs]) => ({
                endIndex,
                tripIDs
            }))
        );
    });
    raptorIndex = {
        routesByStation,
        isTransferStation,
        distancesByLine,
        tripServicesByLine
    };
    return raptorIndex;
}

function getNextTripFromServicePattern(
    line,
    stop,
    tripIDs,
    earliestTime
) {
    const firstDeparture = line.starttime + stop.dep;
    let day = Math.floor(
        (earliestTime - firstDeparture) / constants.SECONDS_PER_DAY
    );
    const firstTripOnDay = Math.max(
        0,
        Math.ceil(
            (earliestTime - firstDeparture - day * constants.SECONDS_PER_DAY)
            / line.interval
        )
    );

    let low = 0;
    let high = tripIDs.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (tripIDs[middle] < firstTripOnDay) {
            low = middle + 1;
        }
        else {
            high = middle;
        }
    }
    if (low >= tripIDs.length) {
        low = 0;
        day++;
    }

    const trip = tripIDs[low];
    const tripStart = line.starttime
        + trip * line.interval
        + day * constants.SECONDS_PER_DAY;
    return {
        trip,
        day,
        departure: tripStart + stop.dep,
        tripStart
    };
}

function getNextRaptorTrips(
    line,
    stopIndex,
    earliestTime,
    serviceGroups
) {
    const stop = line.stops[stopIndex];
    const candidates = serviceGroups.map(serviceGroup => ({
        ...getNextTripFromServicePattern(
            line,
            stop,
            serviceGroup.tripIDs,
            earliestTime
        ),
        endIndex: serviceGroup.endIndex
    })).sort((first, second) =>
        first.departure - second.departure
        || second.endIndex - first.endIndex
    );

    const usefulCandidates = [];
    let furthestEndIndex = -1;
    candidates.forEach(candidate => {
        if (candidate.endIndex <= furthestEndIndex) return;
        usefulCandidates.push(candidate);
        furthestEndIndex = candidate.endIndex;
    });
    return usefulCandidates;
}


function buildRaptorPath(journey) {
    const path = [];
    while (journey !== null) {
        const leg = journey.leg;
        const line = data.timetable.lines[leg.lineID];
        path.push({
            fromName: settings.getStationName(data.timetable.stations[leg.fromID]),
            fromID: leg.fromID,
            toName: settings.getStationName(data.timetable.stations[leg.toID]),
            toID: leg.toID,
            dep: leg.dep,
            arr: leg.arr,
            train: app.getTrainName(line, true, true),
            traindata: {
                lineID: leg.lineID,
                tripID: leg.tripID,
                day: Math.floor(leg.arr / constants.SECONDS_PER_DAY),
                hidesinfront: false
            },
            dist: leg.dist
        });
        journey = journey.previous;
    }
    path.reverse();
    return path;
}

function findPath(startstationID, endstationID, time=-1) {
    if (time === -1) time = app.getCurrentTimeInSeconds();

    startstationID = Number(startstationID);
    endstationID = Number(endstationID);
    if (startstationID === endstationID) return [];
    if (!data.timetable.stations[startstationID] || !data.timetable.stations[endstationID]) return;

    const {
        routesByStation,
        isTransferStation,
        distancesByLine,
        tripServicesByLine
    } = getRaptorIndex();
    const stationCount = data.timetable.stations.length;
    let previousArrival = new Float64Array(stationCount);
    previousArrival.fill(Infinity);
    previousArrival[startstationID] = time;

    let previousJourney = new Array(stationCount).fill(null);
    let markedStations = new Set([startstationID]);

    for (let round = 0; round < stationCount && markedStations.size > 0; round++) {
        const routesToScan = new Set();
        markedStations.forEach(stationID => {
            routesByStation[stationID].forEach(lineID => routesToScan.add(lineID));
        });

        const currentArrival = previousArrival.slice();
        const currentJourney = previousJourney.slice();
        const improvedStations = new Set();

        routesToScan.forEach(lineID => {
            const line = data.timetable.lines[lineID];
            if (!includeAirRoutes
                && (line.type === config.trainTypeIds.AR || line.type === config.trainTypeIds.AJ)) {
                return;
            }
            let boardedTrips = [];

            line.stops.forEach((stop, stopIndex) => {
                boardedTrips = boardedTrips.filter(
                    boardedTrip => boardedTrip.endIndex >= stopIndex
                );
                boardedTrips.forEach(boardedTrip => {
                    if (stopIndex <= boardedTrip.boardingStopIndex) return;

                    const arrival = boardedTrip.tripStart + stop.arr;
                    if (arrival < currentArrival[stop.sid]) {
                        currentArrival[stop.sid] = arrival;
                        currentJourney[stop.sid] = {
                            previous: boardedTrip.boardingJourney,
                            leg: {
                                fromID: boardedTrip.boardingStationID,
                                toID: stop.sid,
                                lineID,
                                tripID: boardedTrip.trip,
                                dep: boardedTrip.departure,
                                arr: arrival,
                                dist: distancesByLine[lineID][stopIndex]
                                    - distancesByLine[lineID][boardedTrip.boardingStopIndex]
                            }
                        };
                        improvedStations.add(stop.sid);
                    }
                });

                if (!Number.isFinite(previousArrival[stop.sid])) return;
                const candidateTrips = getNextRaptorTrips(
                    line,
                    stopIndex,
                    previousArrival[stop.sid],
                    tripServicesByLine[lineID][stopIndex]
                );
                candidateTrips.forEach(candidateTrip => {
                    boardedTrips.push({
                        ...candidateTrip,
                        boardingStationID: stop.sid,
                        boardingStopIndex: stopIndex,
                        boardingJourney: previousJourney[stop.sid]
                    });
                });

                boardedTrips.sort((first, second) =>
                    first.tripStart - second.tripStart
                    || second.endIndex - first.endIndex
                );
                let furthestEndIndex = -1;
                boardedTrips = boardedTrips.filter(boardedTrip => {
                    if (boardedTrip.endIndex <= furthestEndIndex) return false;
                    furthestEndIndex = boardedTrip.endIndex;
                    return true;
                });
            });
        });

        const nextMarkedStations = new Set();
        improvedStations.forEach(stationID => {
            if (stationID !== endstationID
                && isTransferStation[stationID]
                && currentArrival[stationID] < currentArrival[endstationID]) {
                nextMarkedStations.add(stationID);
            }
        });
        if (currentArrival[endstationID] < previousArrival[endstationID]
            && nextMarkedStations.size === 0) {
            return buildRaptorPath(currentJourney[endstationID]);
        }

        previousArrival = currentArrival;
        previousJourney = currentJourney;
        markedStations = nextMarkedStations;
    }

    if (Number.isFinite(previousArrival[endstationID])) {
        return buildRaptorPath(previousJourney[endstationID]);
    }
}

function getStraightLineDistance(fromStationID, toStationID) {
    const from = data.timetable.stations[fromStationID];
    const to = data.timetable.stations[toStationID];
    const radius = 6371;
    const latitudeDifference = (to.lat - from.lat) * Math.PI / 180;
    const longitudeDifference = (to.lon - from.lon) * Math.PI / 180;
    const value = Math.sin(latitudeDifference / 2) ** 2
        + Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180)
        * Math.sin(longitudeDifference / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDuration(duration) {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return hours > 0 ? String(hours)+"h"+String(minutes)+"m" : String(minutes)+"m";
}

function print(){
    _idosstats.style.display = "none";
    const developerMode = runtime.getGameState().getSettings().developer === true;
    if (!developerMode && !connection.use(1)){
        _idosresults.innerHTML = "Žádné připojení<br>Spojení nebylo možné nalézt!";
        _idosresults.className = "nowifiinfo";
        return;
    }
    _idosstats.style.display = "flex";
    let res = findPath(locations[0], locations[1], departureTime);
    _idosresults.innerHTML = "";

    if (!Array.isArray(res) || res.length === 0) {
        _idosstats.style.display = "none";
        _idosresults.innerText = "Spojení nebylo nalezeno.";
        _idosresults.className = "nowifiinfo";
        return;
    }
    _idosresults.className = "";


    //_idosresults
    let totaldist = 0;
    let travelTime = 0;
    let starttime = null;
    let endtime = null;

    res.forEach(result => {
        totaldist += result.dist;
        travelTime += result.arr - result.dep;
        let row = _idosresults.insertRow(-1);
        let parts = result.train.split(" ");
        let lc = null;
        let cs = 0;
        parts.forEach(part => {
            if (part.trim().length > 0){
                if (cs >= 3){
                    lc.innerText += " "+part;
                }
                else{
                    let c = row.insertCell(-1);
                    lc = c;
                    lc.style.textAlign = "left";
                    c.innerText = part;
                    cs++;
                }
            }
        });

        row.onclick = function(){
            runtime.setTrainSectionData(result.traindata);
            app.changeCurrentSection(2);
        };

        let srow = _idosresults.insertRow(-1);
        let sc0 = srow.insertCell(-1);
        let sc1 = srow.insertCell(-1);
        let sc2 = srow.insertCell(-1);
        sc0.innerText = "●"
        sc1.innerText = app.formatTime(result.dep);
        if (starttime == null){
            starttime = result.dep;
        }
        settings.setStationName(sc2, data.timetable.stations[result.fromID]);
        sc2.style.textAlign = "left";
        sc2.style.textWrap = "wrap";
        sc2.onclick = function(){
            runtime.setStationSectionId(result.fromID);
            app.changeCurrentSection(1);
        };

        let erow = _idosresults.insertRow(-1);
        let ec0 = erow.insertCell(-1);
        let ec1 = erow.insertCell(-1);
        let ec2 = erow.insertCell(-1);
        ec0.innerText = "●"
        ec1.innerText = app.formatTime(result.arr);
        endtime = result.arr;
        settings.setStationName(ec2, data.timetable.stations[result.toID]);
        ec2.style.textAlign = "left";
        ec2.style.textWrap = "wrap";
        ec2.onclick = function(){
            runtime.setStationSectionId(result.toID);
            app.changeCurrentSection(1);
        };
        erow.className = "lastSectionRow";
    });

    _idosstatsdist.innerText = String(Math.round(totaldist))+"km";
    let timeelapsed = endtime-starttime;
    _idosstatstime.innerText = formatDuration(timeelapsed);
    const travelPercentage = timeelapsed > 0 ? Math.round(travelTime/timeelapsed*100) : 0;
    const waitPercentage = 100-travelPercentage;
    _idosstatstraveltime.innerText = "Ve vlacích: "+formatDuration(travelTime)
        + " ("+String(travelPercentage)+"%)";
    _idosstatswaittime.innerText = "Čekání: "
        + formatDuration(Math.max(0, timeelapsed-travelTime))
        + " ("+String(waitPercentage)+"%)";
    let speed = totaldist/(timeelapsed/3600);
    _idosstatsspeed.innerText = String(Math.round(speed))+"km/h";
    const straightLineDistance = getStraightLineDistance(locations[0], locations[1]);
    _idosstatstruedist.innerText = "Přímo: "+String(Math.round(straightLineDistance))+"km";
    const straightLineSpeed = straightLineDistance/(timeelapsed/3600);
    _idosstatstruespeed.innerText = "Přímo: "+String(Math.round(straightLineSpeed))+"km/h";
}

function switchLocations(){
    let tmp = locations[0];
    locations[0] = locations[1];
    locations[1] = tmp;
    let tmpvalue = _idosstart.value;
    let tmphtml = _idosstart.innerHTML;
    _idosstart.value = _idosend.value;
    _idosstart.innerHTML = _idosend.innerHTML;
    _idosend.value = tmpvalue;
    _idosend.innerHTML = tmphtml;
    app.renderCurrentSection();
}

function decreaseTime(){
    departureTime -= 60*30;
    updateTimeView();
}

function increaseTime(){
    departureTime += 60*30;
    updateTimeView();
}

function updateTime(){
    const timeInput = document.querySelector("#_idostime");
    let parts = timeInput.value.split(":");
    if (parts.length < 2){
        return;
    }
    let hours = parseInt(parts[0]);
    let minutes = parseInt(parts[1]);
    if (minutes > 100){
        hours = Math.min((hours%10)*10, 20);
        hours += Math.floor(minutes/100);
        minutes %= 100;
    }
    departureTime = hours*3600+minutes*60;
    updateTimeView();
}

function updateTimeView(){
    document.querySelector("#_idostime").value = app.formatTime(departureTime, false, false);
}

    function setLocation(index, stationId) {
        locations[index] = stationId;
    }

    function setIncludeAirRoutes(include) {
        includeAirRoutes = Boolean(include);
    }

    function initializeTime() {
        departureTime = app.getCurrentTimeInMinutes();
        updateTimeView();
    }

    export {
    print,
    switchLocations,
    decreaseTime,
    increaseTime,
    updateTime,
    setLocation,
    setIncludeAirRoutes,
    initializeTime
};
