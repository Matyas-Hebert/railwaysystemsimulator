function formatTime(seconds, includeday = true, includeseconds = true) {
    const d = Math.floor(seconds/SECONDS_PER_DAY);
    let s = (Math.round(seconds) % SECONDS_PER_DAY);
    if (s < 0){
        s += SECONDS_PER_DAY;
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
    let type = line.type;
    if (type == 0){
        name += "Ps";
    }
    if (type == 1){
        name += "Os";
    }
    if (type == 2){
        name += "Sp";
    }
    if (type == 3){
        name += "R";
    }
    if (type == 4){
        name += "Sh";
    }
    if (type == 5){
        name += "EC";
    }
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

function getCurrentTimeInMilliseconds(){
    const now = new Date();
    return now.getTime() - (now.getTimezoneOffset()*60000);
}

function getTripNumberByTime(line, stationID, time){
    let extradays = Math.floor(time/SECONDS_PER_DAY);
    time = (time+SECONDS_PER_DAY)%SECONDS_PER_DAY;
    // find the first trip that departures from stationID after time

    const stop = line.stops.find(s => s.sid === stationID);
    const firstdep = line.starttime + stop.dep;
    let elapsed = time - firstdep;

    if (elapsed < 0){
        let yesterdayelapsed = elapsed + SECONDS_PER_DAY;
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

function activateWifiBoost(){
    wifiluckboost = 0.1;
}

function changeCurrentSection(n){
    currentsection = n;
    renderCurrentSection();
}

function changeTransportType(n){
    if (n != gameState.getCurrentPosition().transporttype){
        wifiluckboost = 0;
        gameState.updateCurrentPosition({transporttype: n});
    }
}

function boardTrain(lineID, tripID, day){
    stationVisits.checkBeforeBoarding(lineID, tripID);
    changeTransportType(TRANSPORT_TYPE.TRAIN);
    const positionChanges = {lineID, tripID};
    if (day <= 1000){
        positionChanges.day = day+Math.floor(getCurrentTimeInMilliseconds() / MILLISECONDS_PER_DAY);
    }
    else{
        positionChanges.day = day;
    }
    gameState.updateCurrentPosition(positionChanges);
}

function normalizeAutoBoardConnection(conn) {
    const day = conn.day <= 1000
        ? conn.day + Math.floor(getCurrentTimeInMilliseconds() / MILLISECONDS_PER_DAY)
        : conn.day;
    return {
        lineID: Number(conn.lineID),
        tripID: Number(conn.tripID),
        day: Number(day)
    };
}

function isAutoBoardSelection(conn) {
    const selected = gameState.getAutoBoardSelection();
    if (selected === null || conn == null) return false;
    const normalized = normalizeAutoBoardConnection(conn);
    return selected.lineID === normalized.lineID
        && selected.tripID === normalized.tripID
        && selected.day === normalized.day;
}

function toggleAutoBoardSelection(conn) {
    if (isAutoBoardSelection(conn)) {
        gameState.setAutoBoardSelection(null);
    }
    else {
        gameState.setAutoBoardSelection(normalizeAutoBoardConnection(conn));
    }
    renderCurrentSection(true);
}
function isAutoExitSelection(stationId) {
    return gameState.getAutoExitStationId() === Number(stationId);
}

function toggleAutoExitSelection(stationId) {
    gameState.setAutoExitStationId(
        isAutoExitSelection(stationId) ? null : Number(stationId)
    );
    renderCurrentSection(true);
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
            section2data = conn;
            changeCurrentSection(2);
        }
    }
    if (!onlythreecols || !firstcolspan){
        if (includegetonbutton){
            c3 = row.insertCell(2);
            c3.innerHTML = `<div>NASTOUPIT</div>`
            c3.onclick = function(){
                boardTrain(conn.lineID, conn.tripID, conn.day);
                renderCurrentSection();
            };
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

    if (openeddetail == openeddetailstring){
        schedule.toggle(row, stopsdata, conn, allowautoboard);
    }

    if (stopsdata){
        c2.onclick = function(){
            section1id = goalstationid;
            changeCurrentSection(1);
        }
        if (!includegetonbutton){
            c3.onclick = function(){
                openeddetail = (openeddetail == openeddetailstring) ? "" : openeddetailstring;
                connstruct = conn;
                renderCurrentSection();
            };
        }
    }
    return row;
}

function updateClock(){
    stationVisits.checkElapsedTime();
    const currentDate = new Date();
    var time = currentDate.getHours()*3600 + currentDate.getMinutes()*60 + currentDate.getSeconds();
    _clock.innerText = formatTime(time);
}

function selectFilter(name){
    if (name == "departures" || name == "arrivals"){
        filters["departures"] = !filters["departures"];
        let curr = filters["departures"];
        _arrivals.classList = curr ? "unselected" : "selected";
        _departures.classList = curr ? "selected" : "unselected";
    }
    let types = ["ps", "os", "sp", "r", "sh", "ec"];
    if (types.includes(name)){
        let type = types.indexOf(name);
        if (type >= 0 && type < 6){
            filters["types"][type] = !filters["types"][type];
            let curr = filters["types"][type];
            document.getElementById(name).classList = curr ? "selected" : "unselected";
        }
    }
    renderCurrentSection();
}

function selectDestination(id){
    filters.statid = id;
    let departures = filters.departures;
    renderCurrentSection(true);
}

function togglePinnedList(){
    pinnedstationsopened = !pinnedstationsopened;
    renderCurrentSection();
}

async function printTimetable(stationID, includegetonbutton = true, table=_timetable, includeheader=true, linescnt=15, timeoffset=0, force=false){
    if (isOpen && !force){
        return;
    }

    const currentDate = new Date();
    var time = currentDate.getHours()*3600 + currentDate.getMinutes()*60 + currentDate.getSeconds();
    time+=timeoffset;

    if (!stationID){
        stationID = 0;
    }

    table.innerHTML = "";

    const station = timetable.stations[stationID];
    time %= SECONDS_PER_DAY;

    if (currentsection == 1){
        _pinnedlist.innerHTML = "";
        _pinnedlist.style.display = "grid";
        _pinnedlisttoggle.style.display = "flex";
        _pinnedlisttoggle.innerHTML = String(gameState.getPinnedStations().length);
        if (gameState.getPinnedStations().length == 0){
            _pinnedlist.style.display = "none";
            _pinnedlisttoggle.style.display = "none";
        }
        if (!pinnedstationsopened){
            _pinnedlist.style.display = "none";
        }
        else{
            gameState.getPinnedStations().forEach(pinnedstation => {
                const newdiv = document.createElement("div");
                newdiv.innerHTML = "&#128204; " + settings.getStationNameMarkup(timetable.stations[pinnedstation]);
                newdiv.onclick = function(){
                    section1id = pinnedstation;
                    changeCurrentSection(1);
                };
                _pinnedlist.appendChild(newdiv);
            });
        }
    }

    if (includeheader){
        row = _timetableheader;
        row.classList = [];
        settings.setStationName(row, station);
        // addRow({
        //     "table": table,
        //     "c1t": station.name,
        //     "firstcolspan": true,
        //     "onlythreecols": true,
        //     "includered": false,
        //     "includetrainnameclass": true});
        // row.cells[0].style.width = "100%";
        // row.cells[0].style.textAlign = "center";
        if (currentsection == 1){
            let pinned = false;
            if (gameState.getPinnedStations().includes(stationID)){
                row.className = 'pinned';
                pinned = true;
            }
            else{
                row.className = 'notpinned';
            }
            row.onclick = function(){
                if (!pinned){
                    gameState.addPinnedStation(stationID);
                    renderCurrentSection();
                }
                else{
                    gameState.removePinnedStation(stationID);
                    renderCurrentSection();
                }
            };
        }
    }

    let departures = filters["departures"];

    let linelist = departures ? station.departures : station.arrivals;

    let stationsset = {};

    let nexttrains = linelist.flatMap(lineID => {
        if (!filters.types[timetable.lines[lineID].type]){
            return [];
        }
        const line = timetable.lines[lineID];

        let stop = null;
        let gather = departures ? false : true;
        let allow = filters.statid == -1;

        line.stops.forEach(lstop => {
            let name = settings.getStationName(timetable.stations[lstop.sid]);
            if (gather && !Object.keys(stationsset).includes(lstop.sid)){
                stationsset[lstop.sid] = name;
            }
            if (filters.statid == lstop.sid && gather){
                allow = true;
            }
            if (lstop.sid == stationID){
                gather = !gather;
                stop = lstop;
            }
        });

        if (!allow){
            return;
        }

        let stoparrdep = departures ? stop.dep : stop.arr;
        let day = 0;
        let timetosearchfrom = Math.max(time - stoparrdep - line.interval*3 - 30*60, time-43200); // no more than 12 hours
        if (timetosearchfrom < 0){
            day = -1;
            timetosearchfrom += SECONDS_PER_DAY;
        }

        let tripobject = getTripNumberByTime(line, stationID, timetosearchfrom);
        let triptosearch = tripobject.trip;
        day += tripobject.day;
        let delay = 0;

        while(delays.get(lineID, triptosearch, time, stationID, day).status > 3){
            triptosearch++;
            if (triptosearch >= line.trips){
                triptosearch = 0;
                day++;
            }
            delay = delays.get(lineID, triptosearch, time, stationID, day);
        };
        return {
            lineID: lineID,
            journeystart: line.starttime + triptosearch * line.interval + day*SECONDS_PER_DAY,
            time: line.starttime + triptosearch * line.interval + stoparrdep + day*SECONDS_PER_DAY,
            day: day,
            trip: triptosearch,
            delay: delay,
            interval: line.interval,
            maxtrips: line.trips
        };
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

    const doesoptionexist = Array.from(_destinations.options).some(opt => opt.value == filters.statid);
    if (doesoptionexist){
        _destinations.value = filters.statid;
    }
    else{
        _destinations.value = -1;
        selectDestination(-1);
    }
    _destheader.innerText = departures ? "Spoje do:" : "Spoje z:";

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
        const line = timetable.lines[current.lineID];
        const stop = line.stops.find(s => s.sid === stationID);
        let stoparrdep = departures ? stop.dep : stop.arr;

        const trainname = getTrainName(line);
        const destinationID = departures ? line.stops[line.stops.length-1].sid : line.stops[0].sid;
        const destinationname = settings.getStationName(timetable.stations[destinationID]).substring(0, 35).padEnd(35, " ");
        const regionname = timetable.stations[destinationID].district;

        let delaystr = current.delay.status === TRAIN_STATUS.CANCELLED_BEFORE_TARGET ? "Zrušeno ve stanici " + settings.getStationName(timetable.stations[current.delay.station]) :
            (current.delay.delay >= 60 ? "+"+String(Math.floor(current.delay.delay/60)) : "")+(current.delay.delay >= 300 ? "<br>"+delays.getReason(current.lineID, current.trip, current.day) : "");

        stopsdata = [];

        found = false;
        finalstopid = line.stops[line.stops.length-1].sid;
        distacc = 0;
        line.stops.forEach(stop => {
            let stoparrdep = departures ? stop.dep : stop.arr;
            if (found){
                distacc += stop.dist;
                stopsdata.push({
                    "id": stop.sid,
                    "station": settings.getStationName(timetable.stations[stop.sid]),
                    "arr": formatTime(stop.arr+current.journeystart, false),
                    "dep": stop.sid == finalstopid ? "-" : formatTime(stoparrdep+current.journeystart, false),
                    "dist": String(Math.round(distacc))+"km"
                });
            }
            if (stop.sid == stationID){
                found = true;
            }
        });

        let conn = {"lineID": current.lineID, "tripID": current.trip, "day": current.day, "hidesinfront": true};
        let row = addRow({
            "table": table,
            "c1t": trainname,
            "c2t": settings.getStationNameMarkup(timetable.stations[destinationID]),
            "c3t": formatTime(current.time),
            "scrolling": destinationname.trim().length >= 18,
            "stopsdata": stopsdata,
            "includered": current.delay.delay >= 60 || current.delay.status === TRAIN_STATUS.CANCELLED_BEFORE_TARGET,
            "conn": conn,
            "subtextdest": regionname,
            "subtexttrain": line.nickname,
            "subtexttime": delaystr,
            "onlythreecols": true,
            "includegetonbutton": current.delay.status === TRAIN_STATUS.STOPPED_AT_TARGET && includegetonbutton,
            "allowautoboard": currentsection === 0 && includegetonbutton && departures,
            "includetrainlink": true,
            "goalstationid": destinationID});

        do{
            if (current.trip >= current.maxtrips-1) {
                current.day++;
                current.trip = 0;
                current.time = line.starttime + current.day*SECONDS_PER_DAY + stoparrdep;
                current.journeystart = line.starttime + current.day*SECONDS_PER_DAY;
            } else {
                current.trip++;
                current.time += current.interval;
                current.journeystart += current.interval;
            }
            current.delay = delays.get(current.lineID, current.trip, time, stationID, current.day);
        } while(current.delay.status > 3);
    }
}

function startGame(){
    gameState.setCurrentPosition({
        transporttype: TRANSPORT_TYPE.STATION,
        statID: startid,
        goalStatID: startid
    });
    stationVisits.markVisited(startid);
    changeCurrentSection(0);
};

function selectSection(section){
    if (section >= 0 && section <= 8){
        changeCurrentSection(section);
    }
    if (currentsection == 4){
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
    if (gameState.getCurrentPosition() == null){
        _start.style.display = "block";
        return;
    }
    _tables.style.display = "flex";
    _section0.style.display = currentsection <= 1 ? "block" : "none";
    _section1.style.display = currentsection == 1 ? "block" : "none";
    _section2.style.display = currentsection == 2 ? "block" : "none";
    _section3.style.display = currentsection == 3 ? "block" : "none";
    _section4.style.display = currentsection == 4 ? "block" : "none";
    _section5.style.display = currentsection == 5 ? "block" : "none";
    _section6.style.display = currentsection == 6 ? "block" : "none";
    _section7.style.display = currentsection == 7 ? "block" : "none";
    _section8.style.display = currentsection == 8 ? "block" : "none";
    _subsection5.style.display = "none";
    _tab0.className = currentsection == 0 ? "chosen" : "unchosen";
    _tab1.className = currentsection == 1 ? "chosen" : "unchosen";
    _tab2.className = currentsection == 2 ? "chosen" : "unchosen";
    _tab4.className = currentsection == 4 ? "chosen" : "unchosen";
    _tab5.className = currentsection == 5 ? "chosen" : "unchosen";
    _tab6.className = currentsection == 6 ? "chosen" : "unchosen";
    _tab7.className = currentsection == 7 ? "chosen" : "unchosen";
    _tab8.className = currentsection == 8 ? "chosen" : "unchosen";
    _tab5.style.display = gameState.getCurrentPosition().transporttype === TRANSPORT_TYPE.STATION ? "block" : "none";
    if (currentsection == 0){
        if (gameState.getCurrentPosition().transporttype === TRANSPORT_TYPE.STATION){
            printTimetable(gameState.getCurrentPosition().statID, true, _timetable, true, 15, 0, force);
        }
        if (gameState.getCurrentPosition().transporttype === TRANSPORT_TYPE.TRAIN){
            _section0.style.display = "none";
            _section2.style.display = "block";
            gameState.updateCurrentPosition({hidesinfront: true});
            schedule.print(_traintimetable, gameState.getCurrentPosition(), true, true);
        }
        if (gameState.getCurrentPosition().transporttype === TRANSPORT_TYPE.WALKING){
            _section0.style.display = "none";
            _section2.style.display = "block";
            _subsection5.style.display = "block";
            walking.printProgress(_traintimetable);
        }
    }
    if (currentsection == 1){
        printTimetable(section1id, false, _timetable, true, 15, 0, force);
    }
    if (currentsection == 2){
        schedule.print(_traintimetable, section2data);
    }
    if (currentsection == 6){
        foodora.render();
    }
    if (currentsection == 7){
        collectionTab.render();
    }
    if (currentsection == 5){
        walking.printOptions(gameState.getCurrentPosition().transporttype === TRANSPORT_TYPE.WALKING ? -1 : gameState.getCurrentPosition().statID);
    }

    gameState.updateCurrentPosition({iswifi: false});
    if (gameState.getCurrentPosition().transporttype === TRANSPORT_TYPE.STATION){
        gameState.updateCurrentPosition({iswifi: delays.hasStationWifi(gameState.getCurrentPosition().statID, gameState.getCurrentPosition().day)});
    }
    if (gameState.getCurrentPosition().transporttype === TRANSPORT_TYPE.TRAIN){
        gameState.updateCurrentPosition({iswifi: delays.hasTrainWifi(gameState.getCurrentPosition().lineID, gameState.getCurrentPosition().tripID, gameState.getCurrentPosition().day, timetable.lines[gameState.getCurrentPosition().lineID].type)});
    }
    if (gameState.getCurrentPosition().transporttype === TRANSPORT_TYPE.WALKING){
        let start = gameState.getCurrentPosition().time;
        let dist = walking.getDistance(gameState.getCurrentPosition().statID, gameState.getCurrentPosition().goalStatID);
        let mstime = dist*8*60*1000;
        let end = start+mstime;
        let current = getCurrentTimeInMilliseconds();
        if (Math.abs(current - start) < 60000){
            gameState.updateCurrentPosition({iswifi: delays.hasStationWifi(gameState.getCurrentPosition().statID, gameState.getCurrentPosition().day)});
        }
        if (Math.abs(current - end) < 60000){
            gameState.updateCurrentPosition({iswifi: delays.hasStationWifi(gameState.getCurrentPosition().goalStatID, gameState.getCurrentPosition().day)});
        }
    }
    if (gameState.getCurrentPosition().iswifi){
        _wifi.className = "wifi";
    }
    else{
        _wifi.className = "nowifi";
    }
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

//generateTimeTables();
let openeddetail = "";
let connstruct = {};
let filters = {"departures": true, "types": [true, true, true, true, true, true], "statid": -1};
// 0 - in station, 1 - on train, 2 - walking
const gameState = new GameState(timetable.stations, lonlattoid);
let pinnedstationsopened = false;
let currentsection = 0;
let section1id = 200;
let startid = -1;
let wifiluckboost = 0;
let section2data = {"lineID": 1, "tripID": 1, "day": 0, "hidesinfront": true};
foodora.initialize();
settings.render();
renderCurrentSection();
setInterval(updateClock, 1000);
setInterval(() => {
    if (!settings.areAutoUpdatesPaused()) {
        renderCurrentSection();
    }
}, 5000);
