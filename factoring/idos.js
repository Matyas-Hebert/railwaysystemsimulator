const idos = (() => {
    let locations = [69, 420];
    let departureTime = 0;

let raptorIndex = null;

function getRaptorIndex() {
    if (raptorIndex !== null) return raptorIndex;

    const routesByStation = timetable.stations.map(station =>
        [...new Set(station.departures || [])]
    );
    const isTransferStation = routesByStation.map(routes => routes.length > 1);
    const distancesByLine = timetable.lines.map(line => {
        const distances = new Float64Array(line.stops.length);
        for (let index = 1; index < line.stops.length; index++) {
            distances[index] = distances[index - 1] + line.stops[index].dist;
        }
        return distances;
    });
    raptorIndex = { routesByStation, isTransferStation, distancesByLine };
    return raptorIndex;
}

function getNextRaptorTrip(line, stop, earliestTime) {
    const firstDeparture = line.starttime + stop.dep;
    const approximateDay = Math.floor((earliestTime - firstDeparture) / SECONDS_PER_DAY);
    let best = null;

    for (let day = approximateDay - 1; day <= approximateDay + 1; day++) {
        const firstDepartureOnDay = firstDeparture + day * SECONDS_PER_DAY;
        const trip = Math.max(0, Math.ceil((earliestTime - firstDepartureOnDay) / line.interval));
        if (trip >= line.trips) continue;

        const departure = firstDepartureOnDay + trip * line.interval;
        if (departure >= earliestTime && (best === null || departure < best.departure)) {
            best = {
                trip,
                departure,
                tripStart: line.starttime + trip * line.interval + day * SECONDS_PER_DAY
            };
        }
    }

    return best;
}


function buildRaptorPath(journey) {
    const path = [];
    while (journey !== null) {
        const leg = journey.leg;
        const line = timetable.lines[leg.lineID];
        path.push({
            fromName: settings.getStationName(timetable.stations[leg.fromID]),
            fromID: leg.fromID,
            toName: settings.getStationName(timetable.stations[leg.toID]),
            toID: leg.toID,
            dep: leg.dep,
            arr: leg.arr,
            train: getTrainName(line, true, true),
            traindata: {
                lineID: leg.lineID,
                tripID: leg.tripID,
                day: Math.floor(leg.arr / SECONDS_PER_DAY),
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
    if (time === -1) time = getCurrentTimeInSeconds();

    startstationID = Number(startstationID);
    endstationID = Number(endstationID);
    if (startstationID === endstationID) return [];
    if (!timetable.stations[startstationID] || !timetable.stations[endstationID]) return;

    const { routesByStation, isTransferStation, distancesByLine } = getRaptorIndex();
    const stationCount = timetable.stations.length;
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
            const line = timetable.lines[lineID];
            let boardedTrip = null;
            let boardingStationID = null;
            let boardingStopIndex = null;
            let boardingJourney = null;

            line.stops.forEach((stop, stopIndex) => {
                if (boardedTrip !== null && stopIndex > boardingStopIndex) {
                    const arrival = boardedTrip.tripStart + stop.arr;
                    if (arrival < currentArrival[stop.sid]) {
                        currentArrival[stop.sid] = arrival;
                        currentJourney[stop.sid] = {
                            previous: boardingJourney,
                            leg: {
                                fromID: boardingStationID,
                                toID: stop.sid,
                                lineID,
                                tripID: boardedTrip.trip,
                                dep: boardedTrip.departure,
                                arr: arrival,
                                dist: distancesByLine[lineID][stopIndex]
                                    - distancesByLine[lineID][boardingStopIndex]
                            }
                        };
                        improvedStations.add(stop.sid);
                    }
                }

                if (!Number.isFinite(previousArrival[stop.sid])) return;
                const candidateTrip = getNextRaptorTrip(line, stop, previousArrival[stop.sid]);
                if (candidateTrip !== null
                    && (boardedTrip === null || candidateTrip.tripStart < boardedTrip.tripStart)) {
                    boardedTrip = candidateTrip;
                    boardingStationID = stop.sid;
                    boardingStopIndex = stopIndex;
                    boardingJourney = previousJourney[stop.sid];
                }
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
    const from = timetable.stations[fromStationID];
    const to = timetable.stations[toStationID];
    const radius = 6371;
    const latitudeDifference = (to.lat - from.lat) * Math.PI / 180;
    const longitudeDifference = (to.lon - from.lon) * Math.PI / 180;
    const value = Math.sin(latitudeDifference / 2) ** 2
        + Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180)
        * Math.sin(longitudeDifference / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function print(){
    _idosstats.style.display = "none";
    const developerMode = gameState.getSettings().developer === true;
    if (!gameState.getCurrentPosition().iswifi && !developerMode){
        _idosresults.innerHTML = "Žádné připojení k Wi-Fi<br>Spojení nebylo možné nalézt!";
        _idosresults.className = "nowifiinfo";
        return;
    }
    _idosstats.style.display = "flex";
    let res = findPath(locations[0], locations[1], departureTime);
    _idosresults.innerHTML = "";


    //_idosresults
    let totaldist = 0;
    let starttime = null;
    let endtime = null;

    res.forEach(result => {
        totaldist += result.dist;
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
            section2data = result.traindata;
            changeCurrentSection(2);
        };

        let srow = _idosresults.insertRow(-1);
        let sc0 = srow.insertCell(-1);
        let sc1 = srow.insertCell(-1);
        let sc2 = srow.insertCell(-1);
        sc0.innerText = "●"
        sc1.innerText = formatTime(result.dep);
        if (starttime == null){
            starttime = result.dep;
        }
        settings.setStationName(sc2, timetable.stations[result.fromID]);
        sc2.style.textAlign = "left";
        sc2.style.textWrap = "wrap";
        sc2.onclick = function(){
            section1id = result.fromID;
            changeCurrentSection(1);
        };

        let erow = _idosresults.insertRow(-1);
        let ec0 = erow.insertCell(-1);
        let ec1 = erow.insertCell(-1);
        let ec2 = erow.insertCell(-1);
        ec0.innerText = "●"
        ec1.innerText = formatTime(result.arr);
        endtime = result.arr;
        settings.setStationName(ec2, timetable.stations[result.toID]);
        ec2.style.textAlign = "left";
        ec2.style.textWrap = "wrap";
        ec2.onclick = function(){
            section1id = result.toID;
            changeCurrentSection(1);
        };
        erow.className = "lastSectionRow";
    });

    _idosstatsdist.innerText = String(Math.round(totaldist))+"km";
    let timeelapsed = endtime-starttime;
    let hours = Math.floor(timeelapsed/3600);
    let minutes = Math.floor((timeelapsed-hours*3600)/60);
    _idosstatstime.innerText = String(minutes)+"m";
    if (hours > 0){
        _idosstatstime.innerText = String(hours)+"h"+String(minutes)+"m";
    }
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
    renderCurrentSection();
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
    document.querySelector("#_idostime").value = formatTime(departureTime, false, false);
}

    function setLocation(index, stationId) {
        locations[index] = stationId;
    }

    function initializeTime() {
        departureTime = getCurrentTimeInMinutes();
        updateTimeView();
    }

    return {
        print,
        switchLocations,
        decreaseTime,
        increaseTime,
        updateTime,
        setLocation,
        initializeTime
    };
})();
