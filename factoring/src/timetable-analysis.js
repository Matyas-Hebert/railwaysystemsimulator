import * as autoBoarding from "./auto-boarding.js";
import * as autoExit from "./auto-exit.js";
import * as collectionTab from "./collection-tab.js";
import * as connection from "./connection.js";
import * as delays from "./delays.js";
import * as foodora from "./foodora.js";
import * as idos from "./idos.js";
import * as journeyPricing from "./journey-pricing.js";
import * as lineVisits from "./line-visits.js";
import * as mapTab from "./map-tab.js";
import * as schedule from "./schedule.js";
import * as settings from "./settings.js";
import * as stationInformation from "./station-information.js";
import * as stationVisits from "./station-visits.js";
import * as tripRoutes from "./trip-routes.js";
import * as walking from "./walking.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as config from "../generated/config.js";
import * as constants from "./constants.js";
import * as trhTab from "./trh-tab.js";
import * as energy from "./energy.js";
import * as clock from "./clock.js";

function formatTime(seconds, includeday = true, includeseconds = true) {
    const d = Math.floor(seconds/constants.SECONDS_PER_DAY);
    let s = (Math.round(seconds) % constants.SECONDS_PER_DAY);
    if (s < 0){
        s += constants.SECONDS_PER_DAY;
    }

    const hh = Math.floor(s / 3600).toString().padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');

    if (!includeseconds){
        return `${hh}:${mm}`;
    }

    if (!includeday){
        return `${hh}:${mm}:${ss}`;
    }

    if (d == -1){
        return `${hh}:${mm}:${ss} včera`;
    }
    if (d < -1){
        return `${hh}:${mm}:${ss} před ${d} dny`;
    }
    if (d == 1){
        return `${hh}:${mm}:${ss} zítra`;
    }
    if (d > 1){
        return `${hh}:${mm}:${ss} za ${d} dny`;
    }
    if (d > 4){
        return `${hh}:${mm}:${ss} za ${d} dní`;
    }

    return `${hh}:${mm}:${ss}`;
}

function getTrainName(line, getnickname=false, padding=true){
    let name = "";
    if (padding){
        name = line.company.padEnd(6, " ") + " ";
    }
    else{
        name = line.company + " ";
    }
    name += config.lineTypes[line.type].code;
    if (padding){
        name = name.padEnd(9, " ");
    }
    name += " " + line.number;
    if (getnickname){
        name += " " + (line.nickname || "");
    }
    if (!padding){
        return name;
    }
    return name.substring(0, 36).padEnd(36, " ");
}

function getTripNumberByTime(
    line,
    stationID,
    time,
    stopIndex = null
){
    let extradays = Math.floor(time/constants.SECONDS_PER_DAY);
    time = (time+constants.SECONDS_PER_DAY)%constants.SECONDS_PER_DAY;
    const normalizedStationID = Number(stationID);
    const resolvedStopIndex = Number.isInteger(stopIndex)
        && line.stops[stopIndex]?.sid === normalizedStationID
        ? stopIndex
        : line.stops.findIndex(stop => stop.sid === normalizedStationID);
    if (resolvedStopIndex === -1) return null;

    const firstdep = line.starttime + line.stops[resolvedStopIndex].dep;
    let elapsed = time - firstdep;

    if (elapsed < 0){
        let yesterdayelapsed = elapsed + constants.SECONDS_PER_DAY;
        let tripID = Math.ceil(yesterdayelapsed/line.interval);
        if (tripID < line.trips){
            return {"trip": tripID, "day": -1+extradays};
        }
        return {"trip": 0, "day": extradays};
    }

    let tripID = Math.ceil(elapsed/line.interval);
    if (tripID >= line.trips) {
        return {"trip": 0, "day": 1+extradays};
    }
    return {"trip": tripID, "day": extradays};
}

function getNextTripServingStation(
    line,
    stationID,
    time,
    stopIndex = null
){
    const normalizedStationID = Number(stationID);
    const resolvedStopIndex = Number.isInteger(stopIndex)
        && line.stops[stopIndex]?.sid === normalizedStationID
        ? stopIndex
        : line.stops.findIndex(stop => stop.sid === normalizedStationID);
    if (resolvedStopIndex === -1) return null;

    const firstCandidate = getTripNumberByTime(
        line,
        normalizedStationID,
        time,
        resolvedStopIndex
    );
    if (firstCandidate === null) return null;
    let trip = firstCandidate.trip;
    let day = firstCandidate.day;

    for (let checkedTrips = 0; checkedTrips < line.trips; checkedTrips++) {
        const route = tripRoutes.getTripRoute(line.id, trip);
        if (route !== null
            && resolvedStopIndex >= route.startIndex
            && resolvedStopIndex <= route.endIndex) {
            return { trip, day, stopIndex: resolvedStopIndex };
        }
        trip++;
        if (trip >= line.trips) {
            trip = 0;
            day++;
        }
    }

    return null;
}

function tripMatchesTimetableSelection(
    lineID,
    tripID,
    stationID,
    selectedStationID,
    departures,
    stopIndex = null
){
    const route = tripRoutes.getTripRoute(lineID, tripID);
    const stationStopIndex = Number.isInteger(stopIndex)
        ? stopIndex
        : tripRoutes.getTripStopIndex(lineID, tripID, stationID);
    if (route === null
        || stationStopIndex < route.startIndex
        || stationStopIndex > route.endIndex) {
        return false;
    }
    if (departures && stationStopIndex >= route.endIndex) return false;
    if (!departures && stationStopIndex <= route.startIndex) return false;
    if (selectedStationID == -1) return true;

    const selectedStopIndices = tripRoutes.getTripStopIndices(
        lineID,
        tripID,
        selectedStationID
    );
    return departures
        ? selectedStopIndices.some(index => index > stationStopIndex)
        : selectedStopIndices.some(index => index < stationStopIndex);
}

function changeCurrentSection(n){
    runtime.setCurrentSection(n);
    renderCurrentSection();
}

function boardTrain(lineID, tripID, day, stopIndex = null){
    stationVisits.checkBeforeBoarding(lineID, tripID);
    const positionChanges = {
        transporttype: constants.TRANSPORT_TYPE.TRAIN,
        lineID,
        tripID,
        boardedAtStopIndex: Number.isInteger(Number(stopIndex))
            ? Number(stopIndex)
            : null
    };
    if (day <= 1000){
        positionChanges.day = day+Math.floor(getCurrentTimeInMilliseconds() / constants.MILLISECONDS_PER_DAY);
    }
    else{
        positionChanges.day = day;
    }
    runtime.getGameState().updateCurrentPosition(positionChanges);
}
function normalizeAutoBoardConnection(conn) {
    const day = conn.day <= 1000
        ? conn.day + Math.floor(getCurrentTimeInMilliseconds() / constants.MILLISECONDS_PER_DAY)
        : conn.day;
    return {
        lineID: Number(conn.lineID),
        tripID: Number(conn.tripID),
        day: Number(day),
        stopIndex: Number.isInteger(Number(conn.stopIndex))
            ? Number(conn.stopIndex)
            : null
    };
}

function isAutoBoardSelection(conn) {
    const selected = runtime.getGameState().getAutoBoardSelection();
    if (selected === null || conn == null) return false;
    const normalized = normalizeAutoBoardConnection(conn);
    return selected.lineID === normalized.lineID
        && selected.tripID === normalized.tripID
        && selected.day === normalized.day
        && (selected.stopIndex === null
            || selected.stopIndex === normalized.stopIndex);
}


function isAutoExitSelection(lineID, stationId) {
    return runtime.getGameState().getAutoExitStationId(lineID) === Number(stationId);
}


function addRow({table, c1t="", c2t="", c3t="", c4t="", stopsdata = null, visibleoverflow=false, includered = true, includetrainnameclass = false, conn = {}, subtextdest = "", noclasssubtextdest = false, goalstationid = 0, includetrainlink = false, includegetonbutton = false, allowautoboard = false, subtexttrain = "", firstcolspan = false, scrolling = false, scrollingfirstcol = false, onlythreecols = false, subtexttime = ""}){
    let row = table.insertRow(-1);
    let c1 = row.insertCell(0);
    let c2 = row.insertCell(1);
    let c3;
    if (visibleoverflow){
        row.classList.add("visibleoverflow");
    }
    if (includetrainlink){
        c1.onclick = function(){
            runtime.setTrainSectionData(conn);
            changeCurrentSection(2);
        }
    }
    if (!onlythreecols || !firstcolspan){
        if (includegetonbutton){
            c3 = row.insertCell(2);
            const pricing = journeyPricing.getLineConfig(conn.lineID);
            if (pricing.must_auto_ride) {
                const terminalStationId = tripRoutes.getTripDestinationStationId(
                    conn.lineID,
                    conn.tripID
                );
                const journeyLength = journeyPricing.getTripDistanceBetweenStops(
                    conn.lineID,
                    conn.tripID,
                    runtime.getGameState().getCurrentPosition().statID,
                    terminalStationId,
                    conn.stopIndex
                );
                const mandatoryJourneyPrice = Math.ceil(
                    pricing.price_per_km * journeyLength + pricing.auto_leave_price
                );
                c3.innerHTML = `<div>NASTOUPIT<br>KOUPIT ${mandatoryJourneyPrice},-</div>`;
                c3.onclick = function(){
                    const purchased = runtime.getGameState().purchaseManualAutoJourney(
                        terminalStationId,
                        mandatoryJourneyPrice
                    );
                    if (!purchased) {
                        return;
                    }
                    boardTrain(
                        conn.lineID,
                        conn.tripID,
                        conn.day,
                        conn.stopIndex
                    );
                    renderCurrentSection();
                };
            }
            else {
                c3.innerHTML = `<div>NASTOUPIT</div>`;
                c3.onclick = function(){
                    boardTrain(
                        conn.lineID,
                        conn.tripID,
                        conn.day,
                        conn.stopIndex
                    );
                    renderCurrentSection();
                };
            }
            c3.style.backgroundColor = "rgb(38, 156, 38)";
        }
        else{
            c3 = row.insertCell(2);
            c3.classList.add("rightalign");
            c3.innerHTML = `<div>${c3t}</div><div class="subtext">${subtexttime}</div>`;
        }
    }
    if (!onlythreecols){
        let c4 = row.insertCell(3);
        c4.innerText = c4t;
        if (c4t != "" && includered){
            c4.classList.add("delayed");
        }
        c4.classList.add("rightalign");
    }
    else if (includered){
        if (!onlythreecols || !firstcolspan){
            c3.classList.add("delayed");
        }
    }

    if (includetrainnameclass){
        c1.classList.add("trainname");
    }

    if (scrollingfirstcol){
        c1.innerHTML = `<div class="scroll-container"><div class="scroll-text">${c1t}</div></div><div class="subtext">${subtexttrain}</div>`;
    }
    else{
        c1.innerHTML = `<div>${c1t}</div></div><div class="subtext">${subtexttrain}</div>`;
    }

    if (firstcolspan){
        c1.colSpan = 2;
        c2.classList.add("rightalign");
    }
    if (scrolling){
        if (noclasssubtextdest){
            c2.innerHTML = `<div class="scroll-container"><div class="scroll-text">${c2t}</div></div><div>${subtextdest}</div>`;
        }
        else{
            c2.innerHTML = `<div class="scroll-container"><div class="scroll-text">${c2t}</div></div><div class="subtext">${subtextdest}</div>`;
        }
    }
    else{
        if (noclasssubtextdest){
            c2.innerHTML = `<div>${c2t}</div><div>${subtextdest}</div>`;
        }
        else{
            c2.innerHTML = `<div>${c2t}</div><div class="subtext">${subtextdest}</div>`;
        }
    }

    let openeddetailstring = (c1t.trim()+c2t.trim()+c3t.trim().replace(/ /g, ''));

    if (allowautoboard && isAutoBoardSelection(conn)) {
        row.classList.add("auto-board-selected-row");
    }

    if (runtime.getOpenedDetail() == openeddetailstring){
        schedule.toggle(row, stopsdata, conn, allowautoboard);
    }

    if (stopsdata){
        c2.onclick = function(){
            runtime.setStationSectionId(goalstationid);
            changeCurrentSection(1);
        }
        if (!includegetonbutton){
            c3.onclick = function(){
                runtime.setOpenedDetail((runtime.getOpenedDetail() == openeddetailstring) ? "" : openeddetailstring);
                runtime.setConnectionStructure(conn);
                renderCurrentSection();
            };
        }
    }
    return row;
}

function updateClock(){
    energy.updateEnergy();
    updateTime();
    stationVisits.checkElapsedTime();
    var time = getCurrentTimeInSeconds();
    _clock.innerText = formatTime(time);
}

const DILATATION_RETENTION_PER_SECOND = 0.9;
const TIME_OFFSET_RETENTION_PER_SECOND = 0.98;
const TIME_OFFSET_EPSILON = 0.001;
const TIME_DILATATION_EPSILON = 0.000001;
let lastTimeUpdateAt = performance.now();

function updateTime() {
    // const updatedAt = performance.now();
    // const elapsedSeconds = Math.max(0, (updatedAt - lastTimeUpdateAt) / 1000);
    // lastTimeUpdateAt = updatedAt;
    // if (elapsedSeconds === 0) return;

    // const timeOffset = runtime.getGameState().getTimeTravelled();
    // const timeDilatation = runtime.getGameState().getTimeDilatation();
    // if (timeOffset === 0 && timeDilatation === 1) return;

    // // Dilation changes how much game time passes during this real-time interval.
    // const dilatationChange = (timeDilatation - 1) * elapsedSeconds;

    // // Both values then move exponentially toward their normal values. Using
    // // elapsedSeconds keeps the result independent of the update frequency.
    // const offsetRetention = Math.pow(
    //     TIME_OFFSET_RETENTION_PER_SECOND,
    //     elapsedSeconds
    // );
    // const dilatationRetention = Math.pow(
    //     DILATATION_RETENTION_PER_SECOND,
    //     elapsedSeconds
    // );
    // let nextTimeOffset = (timeOffset + dilatationChange) * offsetRetention;
    // let nextTimeDilatation = 1
    //     + (timeDilatation - 1) * dilatationRetention;

    // if (Math.abs(nextTimeOffset) < TIME_OFFSET_EPSILON) {
    //     nextTimeOffset = 0;
    // }
    // if (Math.abs(nextTimeDilatation - 1) < TIME_DILATATION_EPSILON) {
    //     nextTimeDilatation = 1;
    // }

    // runtime.getGameState().setTimeState(nextTimeOffset, nextTimeDilatation);
}
function getCurrentTimeInMilliseconds(){
    return clock.getCurrentTimeInMilliseconds();
}

function getCurrentTimeInSeconds(){
    const currentDate = new Date();
    const seconds = currentDate.getHours()*3600
        + currentDate.getMinutes()*60
        + currentDate.getSeconds()
        + runtime.getGameState().getTimeTravelled();
    return ((seconds % constants.SECONDS_PER_DAY) + constants.SECONDS_PER_DAY) % constants.SECONDS_PER_DAY;
}

function getCurrentTimeInMinutes(){
    return Math.floor(getCurrentTimeInSeconds()/60)*60;
}

function getLineTypeCode(typeId){
    return config.lineTypes[typeId]?.code ?? "?";
}

function getTrainTypes(statID, direction){
    const station = data.timetable.stations[statID];
    if (!station || (direction !== 0 && direction !== 1)) return [];

    const lineIDs = direction === 1
        ? station.departures
        : station.arrivals;

    return [...new Set(lineIDs.map(lineID => data.timetable.lines[lineID]?.type))]
        .filter(Number.isInteger);
}

function createTrainTypeFilters(statID){
    _typefilters.innerHTML = "";
    const direction = runtime.getFilters().departures ? 1 : 0;
    const availableTypes = getTrainTypes(statID, direction);

    config.lineTypes.forEach((typeConfig, typeId) => {
        if (!availableTypes.includes(typeId)) return;

        const button = document.createElement("div");
        button.id = "type-filter-" + typeId;
        button.className = runtime.getFilters().types[typeId] ? "selected" : "unselected";
        button.textContent = getLineTypeCode(typeId);
        button.onclick = () => selectFilter(typeId);
        _typefilters.appendChild(button);
    });
}

function selectFilter(name){
    if (name == "departures" || name == "arrivals"){
        runtime.getFilters()["departures"] = !runtime.getFilters()["departures"];
        let curr = runtime.getFilters()["departures"];
        _arrivals.classList = curr ? "unselected" : "selected";
        _departures.classList = curr ? "selected" : "unselected";
    }
    const type = Number(name);
    if (Number.isInteger(type) && runtime.getFilters().types[type] !== undefined){
        runtime.getFilters().types[type] = !runtime.getFilters().types[type];
        const curr = runtime.getFilters().types[type];
        document.getElementById("type-filter-" + type).className
            = curr ? "selected" : "unselected";
    }
    renderCurrentSection();
}

function selectDestination(id){
    runtime.getFilters().statid = id;
    let departures = runtime.getFilters().departures;
    renderCurrentSection(true);
}

function selectTicketDestination(id){
    runtime.setTicketSelectionOpen(false);
    runtime.getFilters().ticketDestinationStatId = id;
    renderCurrentSection(true);
}

function togglePinnedList(){
    runtime.setPinnedStationsOpened(!runtime.arePinnedStationsOpened());
    renderCurrentSection();
}

async function printTimetable(stationID, includegetonbutton = true, table=_timetable, includeheader=true, linescnt=15, timeoffset=0, force=false){
    if ((isOpen || runtime.isTicketSelectionOpen()) && !force){
        return;
    }

    var time = getCurrentTimeInSeconds();
    time+=timeoffset;

    if (!stationID){
        stationID = 0;
    }

    table.innerHTML = "";

    const station = data.timetable.stations[stationID];
    time %= constants.SECONDS_PER_DAY;

    if (runtime.getCurrentSection() == 1){
        _pinnedlist.innerHTML = "";
        _pinnedlist.style.display = "grid";
        _pinnedlisttoggle.style.display = "flex";
        _pinnedlisttoggle.innerHTML = String(runtime.getGameState().getPinnedStations().length);
        if (runtime.getGameState().getPinnedStations().length == 0){
            _pinnedlist.style.display = "none";
            _pinnedlisttoggle.style.display = "none";
        }
        if (!runtime.arePinnedStationsOpened()){
            _pinnedlist.style.display = "none";
        }
        else{
            runtime.getGameState().getPinnedStations().forEach(pinnedstation => {
                const newdiv = document.createElement("div");
                newdiv.innerHTML = "&#128204; " + settings.getStationNameMarkup(data.timetable.stations[pinnedstation]);
                newdiv.onclick = function(){
                    runtime.setStationSectionId(pinnedstation);
                    changeCurrentSection(1);
                };
                _pinnedlist.appendChild(newdiv);
            });
        }
    }

    if (includeheader){
        const row = _timetableheader;
        row.classList = [];
        settings.setStationName(row, station);
        stationInformation.addButton(row, stationID);
        // addRow({
        //     "table": table,
        //     "c1t": station.name,
        //     "firstcolspan": true,
        //     "onlythreecols": true,
        //     "includered": false,
        //     "includetrainnameclass": true});
        // row.cells[0].style.width = "100%";
        // row.cells[0].style.textAlign = "center";
        if (runtime.getCurrentSection() == 1){
            let pinned = false;
            if (runtime.getGameState().getPinnedStations().includes(stationID)){
                row.className = 'pinned';
                pinned = true;
            }
            else{
                row.className = 'notpinned';
            }
            row.onclick = function(){
                if (!pinned){
                    runtime.getGameState().addPinnedStation(stationID);
                    renderCurrentSection();
                }
                else{
                    runtime.getGameState().removePinnedStation(stationID);
                    renderCurrentSection();
                }
            };
        }
    }

    let departures = runtime.getFilters()["departures"];
    createTrainTypeFilters(stationID);

    let linelist = departures ? station.departures : station.arrivals;

    let stationsset = {};

    let nexttrains = [...new Set(linelist)].flatMap(lineID => {
        if (!runtime.getFilters().types[data.timetable.lines[lineID].type]){
            return [];
        }
        const line = data.timetable.lines[lineID];
        const stationStopIndices = line.stops
            .map((stop, stopIndex) => ({ stop, stopIndex }))
            .filter(({ stop, stopIndex }) =>
                stop.sid === stationID
                && (departures
                    ? stopIndex < line.stops.length - 1
                    : stopIndex > 0)
            )
            .map(({ stopIndex }) => stopIndex);

        return stationStopIndices.flatMap(stopIndex => {
            const stop = line.stops[stopIndex];
            const reachableStops = departures
                ? line.stops.slice(stopIndex + 1)
                : line.stops.slice(0, stopIndex);
            reachableStops.forEach(reachableStop => {
                if (reachableStop.sid === stationID) return;
                stationsset[reachableStop.sid] = settings.getStationName(
                    data.timetable.stations[reachableStop.sid]
                );
            });

            const selectedStationID = Number(runtime.getFilters().statid);
            const allow = selectedStationID === -1
                || reachableStops.some(
                    reachableStop => reachableStop.sid === selectedStationID
                );
            if (!allow) return [];

            let stoparrdep = departures ? stop.dep : stop.arr;
            let day = 0;
            let timetosearchfrom = Math.max(
                time - stoparrdep - line.interval*3 - 30*60,
                time - 43200
            );
            if (timetosearchfrom < 0){
                day = -1;
                timetosearchfrom += constants.SECONDS_PER_DAY;
            }

            const tripobject = getNextTripServingStation(
                line,
                stationID,
                timetosearchfrom,
                stopIndex
            );
            if (tripobject === null) return [];

            let triptosearch = tripobject.trip;
            day += tripobject.day;
            let delay = null;

            for (
                let checkedTrips = 0;
                checkedTrips < line.trips * 2;
                checkedTrips++
            ) {
                if (tripMatchesTimetableSelection(
                    lineID,
                    triptosearch,
                    stationID,
                    runtime.getFilters().statid,
                    departures,
                    stopIndex
                )) {
                    const candidateDelay = delays.get(
                        lineID,
                        triptosearch,
                        time,
                        stationID,
                        day,
                        stopIndex
                    );
                    if (
                        candidateDelay.status
                        <= constants.TRAIN_STATUS.STOPPED_AT_TARGET
                    ) {
                        delay = candidateDelay;
                        break;
                    }
                }

                triptosearch++;
                if (triptosearch >= line.trips){
                    triptosearch = 0;
                    day++;
                }
            }
            if (delay === null) return [];

            return [{
                lineID,
                stopIndex,
                journeystart: line.starttime
                    + triptosearch * line.interval
                    + day * constants.SECONDS_PER_DAY,
                time: line.starttime
                    + triptosearch * line.interval
                    + stoparrdep
                    + day * constants.SECONDS_PER_DAY,
                day,
                trip: triptosearch,
                delay,
                interval: line.interval,
                maxtrips: line.trips
            }];
        });
    });

    stationsset = Object.entries(stationsset).sort((a, b) => a[1].localeCompare(b[1]));

    _destinations.innerHTML = "";
    let opt = document.createElement('option');
    opt.value = -1;
    opt.textContent = departures ? "Kamkoli" : "Odkudkoli";
    _destinations.add(opt);
    stationsset.forEach(stat => {
        let opt = document.createElement('option');
        opt.value = parseInt(stat[0]);
        opt.textContent = stat[1];
        opt.className = stationVisits.isVisited(opt.value)
            ? "station-name-visited"
            : "station-name-unvisited";
        _destinations.add(opt);
    });

    const doesoptionexist = Array.from(_destinations.options).some(opt => opt.value == runtime.getFilters().statid);
    if (doesoptionexist){
        _destinations.value = runtime.getFilters().statid;
    }
    else{
        _destinations.value = -1;
        selectDestination(-1);
    }
    _destheader.innerText = departures ? "Spoje do:" : "Spoje z:";

    if (runtime.getCurrentSection() === 0) {
        schedule.addAutoTravelStatusRow(table);
    }

    addRow({
        "table": table,
        "c1t": "Vlak",
        "c2t": departures ? "Do" : "Z",
        "c3t": departures ? "Prav. Odjezd " : "Prav. Příjezd",
        "onlythreecols": true,
        "includered": false});

    if (nexttrains.length == 0){
        addRow({"table": table,
        "c1t": "Spoje",
        "c2t": "nevyhovují",
        "c3t": "filtrům",
        "onlythreecols": true});
    }

    for (let n = 0; n < linescnt; n++) {
        if (nexttrains.length == 0){
            return;
        }
        nexttrains.sort((a, b) => a.time - b.time);

        const current = nexttrains[0];
        const line = data.timetable.lines[current.lineID];
        const stop = line.stops[current.stopIndex];
        let stoparrdep = departures ? stop.dep : stop.arr;

        const trainname = getTrainName(line);
        const route = tripRoutes.getTripRoute(current.lineID, current.trip);
        const destinationID = departures
            ? route.destinationStationId
            : route.originStationId;
        const destinationname = settings.getStationName(data.timetable.stations[destinationID]).substring(0, 35).padEnd(35, " ");
        const regionname = data.timetable.stations[destinationID].district;

        let delaystr = current.delay.status === constants.TRAIN_STATUS.CANCELLED_BEFORE_TARGET ? "Zrušeno ve stanici " + settings.getStationName(data.timetable.stations[current.delay.station]) :
            (current.delay.delay >= 60 ? "+"+String(Math.floor(current.delay.delay/60)) : "")+(current.delay.delay >= 300 ? "<br>"+delays.getReason(current.lineID, current.trip, current.day) : "");

        const stopsdata = [];

        let found = false;
        let distacc = 0;
        route.stops.forEach((stop, routeStopIndex) => {
            const globalStopIndex = route.startIndex + routeStopIndex;
            let stoparrdep = departures ? stop.dep : stop.arr;
            if (found){
                distacc += stop.dist;
                stopsdata.push({
                    "id": stop.sid,
                    "station": settings.getStationName(data.timetable.stations[stop.sid]),
                    "arr": formatTime(stop.arr+current.journeystart, false),
                    "dep": globalStopIndex === route.endIndex
                        ? "-"
                        : formatTime(stoparrdep+current.journeystart, false),
                    "dist": String(Math.round(distacc))+"km"
                });
            }
            if (globalStopIndex === current.stopIndex){
                found = true;
            }
        });

        let conn = {"lineID": current.lineID, "tripID": current.trip, "day": current.day, "stopIndex": current.stopIndex, "hidesinfront": true};
        let row = addRow({
            "table": table,
            "c1t": trainname,
            "c2t": settings.getStationNameMarkup(data.timetable.stations[destinationID]),
            "c3t": formatTime(current.time),
            "scrolling": destinationname.trim().length >= 18,
            "stopsdata": stopsdata,
            "includered": current.delay.delay >= 60 || current.delay.status === constants.TRAIN_STATUS.CANCELLED_BEFORE_TARGET,
            "conn": conn,
            "subtextdest": regionname,
            "subtexttrain": line.nickname,
            "subtexttime": delaystr,
            "onlythreecols": true,
            "includegetonbutton": current.delay.status === constants.TRAIN_STATUS.STOPPED_AT_TARGET && includegetonbutton,
            "allowautoboard": runtime.getCurrentSection() === 0 && includegetonbutton && departures,
            "includetrainlink": true,
            "goalstationid": destinationID});

        let nextTripFound = false;
        for (let checkedTrips = 0; checkedTrips < current.maxtrips * 2; checkedTrips++) {
            if (current.trip >= current.maxtrips-1) {
                current.day++;
                current.trip = 0;
            } else {
                current.trip++;
            }
            current.journeystart = line.starttime
                + current.trip * current.interval
                + current.day * constants.SECONDS_PER_DAY;
            current.time = current.journeystart + stoparrdep;

            if (!tripMatchesTimetableSelection(
                current.lineID,
                current.trip,
                stationID,
                runtime.getFilters().statid,
                departures,
                current.stopIndex
            )) {
                continue;
            }

            const candidateDelay = delays.get(
                current.lineID,
                current.trip,
                time,
                stationID,
                current.day,
                current.stopIndex
            );
            if (candidateDelay.status <= constants.TRAIN_STATUS.STOPPED_AT_TARGET) {
                current.delay = candidateDelay;
                nextTripFound = true;
                break;
            }
        }
        if (!nextTripFound) nexttrains.shift();
    }
}

function startGame(){
    runtime.getGameState().setCurrentPosition({
        transporttype: constants.TRANSPORT_TYPE.STATION,
        statID: runtime.getStartStationId(),
        goalStatID: runtime.getStartStationId()
    });
    stationVisits.markVisited(runtime.getStartStationId());
    changeCurrentSection(0);

    runtime.getGameState().setEnergySnapshot(
        null,
        constants.ENERGY_RESTORATION_IDLE,
        gameState.getEnergy(),
        null,
        clock.getCurrentTimeInMilliseconds()
    );
};

function selectSection(section){
    if (section >= 0 && section <= 10){
        changeCurrentSection(section);
    }
    if (runtime.getCurrentSection() == 4){
        idos.initializeTime();
    }
    renderCurrentSection();
}

function renderCurrentSection(force = false){
    autoBoarding.check();
    lineVisits.checkCurrentLine();
    autoExit.check();
    _start.style.display = "none";
    _tables.style.display = "none";
    if (runtime.getGameState().getCurrentPosition() == null){
        _start.style.display = "block";
        return;
    }
    const currentTransportType = runtime.getGameState().getCurrentPosition().transporttype;
    if (currentTransportType === constants.TRANSPORT_TYPE.FIELD && runtime.getCurrentSection() === 0) {
        runtime.setCurrentSection(5);
    }
    _tables.style.display = "flex";
    _section0.style.display = runtime.getCurrentSection() <= 1 ? "block" : "none";
    _section1.style.display = runtime.getCurrentSection() == 1 ? "block" : "none";
    _section2.style.display = runtime.getCurrentSection() == 2 ? "block" : "none";
    _section3.style.display = runtime.getCurrentSection() == 3 ? "block" : "none";
    _section4.style.display = runtime.getCurrentSection() == 4 ? "block" : "none";
    _section5.style.display = runtime.getCurrentSection() == 5 ? "block" : "none";
    _section6.style.display = runtime.getCurrentSection() == 6 ? "block" : "none";
    _section7.style.display = runtime.getCurrentSection() == 7 ? "block" : "none";
    _section8.style.display = runtime.getCurrentSection() == 8 ? "block" : "none";
    _section9.style.display = runtime.getCurrentSection() == 9 ? "block" : "none";
    _section10.style.display = runtime.getCurrentSection() == 10 ? "block" : "none";
    _subsection5.style.display = "none";
    _tab0.className = runtime.getCurrentSection() == 0 ? "chosen" : "unchosen";
    _tab1.className = runtime.getCurrentSection() == 1 ? "chosen" : "unchosen";
    _tab2.className = runtime.getCurrentSection() == 2 ? "chosen" : "unchosen";
    _tab4.className = runtime.getCurrentSection() == 4 ? "chosen" : "unchosen";
    _tab5.className = runtime.getCurrentSection() == 5 ? "chosen" : "unchosen";
    _tab6.className = runtime.getCurrentSection() == 6 ? "chosen" : "unchosen";
    _tab7.className = runtime.getCurrentSection() == 7 ? "chosen" : "unchosen";
    _tab8.className = runtime.getCurrentSection() == 8 ? "chosen" : "unchosen";
    _tab9.className = runtime.getCurrentSection() == 9 ? "chosen" : "unchosen";
    _tab10.style.display = currentTransportType === constants.TRANSPORT_TYPE.STATION ? "block" : "none";
    _tab10.className = runtime.getCurrentSection() == 10 ? "chosen" : "unchosen";
    _tab0.style.display = currentTransportType === constants.TRANSPORT_TYPE.FIELD ? "none" : "block";
    _tab5.style.display = (
        currentTransportType === constants.TRANSPORT_TYPE.STATION
        || currentTransportType === constants.TRANSPORT_TYPE.FIELD
    ) ? "block" : "none";
    if (runtime.getCurrentSection() == 0){
        if (runtime.getGameState().getCurrentPosition().transporttype === constants.TRANSPORT_TYPE.STATION){
            printTimetable(runtime.getGameState().getCurrentPosition().statID, true, _timetable, true, 15, 0, force);
        }
        if (runtime.getGameState().getCurrentPosition().transporttype === constants.TRANSPORT_TYPE.TRAIN){
            _section0.style.display = "none";
            _section2.style.display = "block";
            runtime.getGameState().updateCurrentPosition({hidesinfront: true});
            schedule.print(_traintimetable, runtime.getGameState().getCurrentPosition(), true, true);
        }
        if (runtime.getGameState().getCurrentPosition().transporttype === constants.TRANSPORT_TYPE.WALKING){
            _section0.style.display = "none";
            _section2.style.display = "block";
            _subsection5.style.display = "block";
            walking.printProgress(_traintimetable);
        }
    }
    if (runtime.getCurrentSection() == 1){
        printTimetable(runtime.getStationSectionId(), false, _timetable, true, 15, 0, force);
    }
    if (runtime.getCurrentSection() == 2){
        schedule.print(_traintimetable, runtime.getTrainSectionData());
    }
    if (runtime.getCurrentSection() == 6){
        foodora.render();
    }
    if (runtime.getCurrentSection() == 7){
        collectionTab.render();
    }
    if (runtime.getCurrentSection() == 9){
        mapTab.render();
    }
    if (runtime.getCurrentSection() == 10){
        trhTab.render();
    }
    if (runtime.getCurrentSection() == 5){
        walking.printOptions(runtime.getGameState().getCurrentPosition().transporttype === constants.TRANSPORT_TYPE.WALKING ? -1 : runtime.getGameState().getCurrentPosition().statID);
    }

    stationInformation.render();

    settings.renderEnergy();

    connection.refresh();
}


let isOpen = false;
let justClosed = false;

_destinations.addEventListener('click', () => {
    if (justClosed){
        return;
    }
    isOpen = !isOpen;
});

_destinations.addEventListener('blur', () => {
    isOpen = false;
});

_destinations.addEventListener('change', () => {
    isOpen = false;
    justClosed = true;
    setTimeout(() => { justClosed = false; }, 10);
});

window.addEventListener('scroll', () => {
    if (isOpen){
        isOpen = false;
    }
});


export { formatTime, getCurrentTimeInMilliseconds, getCurrentTimeInSeconds, getCurrentTimeInMinutes, renderCurrentSection, changeCurrentSection, boardTrain, addRow, normalizeAutoBoardConnection, getTrainName, selectTicketDestination, selectDestination, selectFilter, selectSection, startGame, togglePinnedList, updateClock };
