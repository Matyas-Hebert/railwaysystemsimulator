function toggleSchedule(clickedrow, stopsdata){
    if (!stopsdata) return;
    const detail = document.querySelector(".detail");

    if (detail && detail.previousElementSibling === clickedrow){
        document.querySelectorAll(".detail").forEach(el => el.remove());
        openeddetail = "";
        return;
    }

    if (detail){
        document.querySelectorAll(".detail").forEach(el => el.remove());
    }

    let detailrow = _timetable.insertRow(clickedrow.rowIndex+1);
    detailrow.className = "detail";

    let c1 = detailrow.insertCell(0);
    let c2 = detailrow.insertCell(1);
    let c3 = detailrow.insertCell(2);

    c1.innerText = "STANICE";
    c2.innerText = "PŘÍJEZD";
    c3.innerText = "ODJEZD";

    i = 1;
    stopsdata.forEach(stopdata => {
        let detailrow = _timetable.insertRow(clickedrow.rowIndex+1+i);
        detailrow.className = "detail";

        let c1 = detailrow.insertCell(0);
        let c2 = detailrow.insertCell(1);
        let c3 = detailrow.insertCell(2);

        if (stopdata.station.length >= 17){
            c1.innerHTML = `<div class="scroll-container"><div class="scroll-text">${stopdata.station}</div></div><div class="subtext">${timetable.stations[stopdata.id].district}</div>`;
        }
        else{
            c1.innerHTML = `<div>${stopdata.station}</div></div><div class="subtext">${timetable.stations[stopdata.id].district}</div>`;
        }
        c2.innerText = stopdata.arr;
        c3.innerText = stopdata.dep;

        if (stopdata.id == filters.statid){
            c1.className = "delayed";
        }

        c1.onclick = function() {
            section1id = stopdata.id;
            changecurrentsection(1);
        };
        i++;
    });
}

function getboost(){
    wifiluckboost = 0.1;
}

function changecurrentsection(n){
    currentsection = n;
    printcurrentsection();
}

function changetransporttype(n){
    if (n != currentposition.transporttype){
        wifiluckboost = 0;
        currentposition.transporttype = n;
    }
}

function getontrain(lineID, tripID, day){
    changetransporttype(1);
    currentposition.lineID = lineID;
    currentposition.tripID = tripID;
    if (day <= 1000){
        console.log(day, "!");
        currentposition.day = day+Math.floor(getCurrentTimeInMs() / 86400000);
        console.log(getCurrentTimeInMs() / 86400000);
        console.log(getCurrentTimeInMs())
        console.log("newday:", currentposition.day);
    }
    else{
        currentposition.day = day;
    }
    if (window.stationVisitStartedAt >= Date.now() + 180000){
        if (!window.visitedStations.includes(currentposition.statID)){
            console.log("new visited station");
            window.visitedStations.push(currentposition.statID);
        }
    }
    else{
        console.log("waited for too short");
    }
    updatepositionlocalstorage();
}

function addrow({table, c1t="", c2t="", c3t="", c4t="", stopsdata = null, visibleoverflow=false, includered = true, includetrainnameclass = false, conn = {}, subtextdest = "", noclasssubtextdest = false, goalstationid = 0, includetrainlink = false, includegetonbutton = false, subtexttrain = "", firstcolspan = false, scrolling = false, scrollingfirstcol = false, onlythreecols = false, subtexttime = ""}){
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
            changecurrentsection(2);
        }
    }
    if (!onlythreecols || !firstcolspan){
        if (includegetonbutton){
            c3 = row.insertCell(2);
            c3.innerHTML = `<div>NASTOUPIT</div>`
            c3.onclick = function(){
                getontrain(conn.lineID, conn.tripID, conn.day);
                printcurrentsection();
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

    if (openeddetail == openeddetailstring){
        toggleSchedule(row, stopsdata);
    }

    if (stopsdata){
        c2.onclick = function(){
            console.log(stopsdata);
            section1id = goalstationid;
            changecurrentsection(1);
        }
        if (!includegetonbutton){
            c3.onclick = function(){
                openeddetail = (openeddetail == openeddetailstring) ? "" : openeddetailstring;
                connstruct = conn;
                printcurrentsection();
            };
        }
    }
    return row;
}

function getstationname(station){
    if (settings.developer){
        return station.name+" ("+station.id+")";
    }
    return station.name;
}

function updatetrackprogress(status, progress, station1, station2){
    _doublestop.className = "inactive";
    _singlestop.className = "inactive";
    _firststop.className = "inactive";
    _laststop.className = "inactive";
    if (status == -1 || status == 7){
        _singlestop.className = "active";
        _sss1.innerText = getstationname(timetable.stations[station1]);
        _sss1.onclick = function(){
            section1id = station1;
            changecurrentsection(1);
        };
    }
    if (status == 0){
        _firststop.className = "active";
        _fss1.innerText = getstationname(timetable.stations[station1]);
        _fss1.onclick = function(){
            section1id = station1;
            changecurrentsection(1);
        };
    }
    if (status == 6){
        _laststop.className = "active";
        _lss1.innerText = getstationname(timetable.stations[station1]);
        _lss1.onclick = function(){
            section1id = station1;
            changecurrentsection(1);
        };
    }
    if (status == 1 || status == 3 || status == 5){
        _singlestop.className = "active";
        _sss1.innerText = getstationname(timetable.stations[station1]);
        _sss1.onclick = function(){
            section1id = station1;
            changecurrentsection(1);
        };
    }
    if (status == 2 || status == 4){
        _doublestop.className = "active";
        progress = Math.floor(progress*100);
        _dspt.style.setProperty("width", `${progress}%`, "important");
        _dss1.innerText = getstationname(timetable.stations[station2]);
        _dss2.innerText = getstationname(timetable.stations[station1]);
        _dss1.onclick = function(){
            section1id = station2;
            changecurrentsection(1);
        };
        _dss2.onclick = function(){
            section1id = station1;
            changecurrentsection(1);
        };
    }
}

function printschedule(table=_information, conns=connstruct, checkifkick=false, getoffbutton=false){
    if (Object.keys(conns).length == 0){
        return;
    }
    let lineID = conns.lineID;
    let tripID = conns.tripID;
    console.log(tripID, timetable.lines[lineID].trips);
    let dayssinceepoch = Math.floor(getCurrentTimeInMs() / 86400000);
    let day = conns.day;
    if (day >= 100){
        day = day-dayssinceepoch;
        console.log("new day", day);
    }
    let hidesinfront = conns.hidesinfront;
    if (lineID == null || tripID == null){
        return;
    }
    const currentDate = new Date();
    let time = currentDate.getHours()*3600 + currentDate.getMinutes()*60 + currentDate.getSeconds();
    table.innerHTML = "";
    _traintimetableheader.innerHTML = "";
    let line = timetable.lines[lineID];
    let stops = line.stops;
    let delay = getDelay(lineID, tripID, time, stops[stops.length-1], day);
    if (checkifkick){
        if (delay.status == 6){
            changeStation(stops[stops.length-1].sid, {
                transportType: 0,
                goalStatID: stops[stops.length-1].sid,
                time: getCurrentTimeInMs(),
                forceVisit: true
            });
        }
        if (delay.status == -1 || delay.status == 7){
            changeStation(delay.station, {
                transportType: 0,
                goalStatID: delay.station,
                time: getCurrentTimeInMs(),
                forceVisit: true
            });
        }
    }
    if (delay.station == null){
        hidesinfront = false;
    }
    let hideuntil = delay.station;
    if (currentsection == 2 || currentsection == 0){
        let secst = stops[stops.length-1].sid;
        if (delay.status == 2 || delay.status == 4){
            for(let i=0; i<stops.length; i++){
                if (stops[i].sid == delay.station){
                    break;
                }
                secst = stops[i].sid
                hideuntil = secst;
            }
        }
        if (delay.station == null){
            updatetrackprogress(delay.status, delay.progress, secst, 1);
        }
        else{
            updatetrackprogress(delay.status, delay.progress, delay.station, secst);
        }
    }
    let delaystring = "+"+String(Math.floor(delay.delay/60));
    let delayreason = (delay.delay >= 300 ? getdelayreason(lineID, tripID, day) : "");

    row = addrow({
        "table": _traintimetableheader, 
        "c1t": "Vlak", 
        "c2t": "Z/DO", 
        "c3t": delaystring,
        "subtexttime": delayreason,
        "includered": delay.delay>=60 || delay.status == -1,
        "onlythreecols": true});

    row = addrow({
        "table": _traintimetableheader, 
        "c1t": getTrainName(line), 
        "c2t": "Z "+getstationname(timetable.stations[stops[0].sid]),
        "subtexttrain": line.nickname,
        "subtextdest": "Do "+getstationname(timetable.stations[stops[stops.length-1].sid]),
        "noclasssubtextdest": true,
        "includered": false,
        "onlythreecols": true});

    row.cells[0].onclick = function(){
        section2data = conns;
        changecurrentsection(2);
    }

    row.deleteCell(2);
    row.cells[1].colSpan = 2;
    if (getoffbutton && delay.status == 1 || delay.status == 3 || delay.status == 5){
        row.cells[1].innerHTML = "VYSTOUPIT";
        row.cells[1].style.backgroundColor = "#861313";
        row.cells[1].onclick = function(){
            console.log("changing station");
            changeStation(delay.station, {
                transportType: 0,
                goalStatID: delay.station,
                time: getCurrentTimeInMs(),
                forceVisit: true
            });
        };
    }

    if (currentsection == 2){
        row = addrow({
            "table": _traintimetableheader,
            "c1t": "< Předchozí", 
            "c2t": hidesinfront ? "Zobrazit" : "Skrýt", 
            "c3t": "Následující >",
            "includered": false,
            "onlythreecols": true
        })

        row.cells[0].style.backgroundColor = "#269c26";
        row.cells[0].style.fontWeight = "normal";
        row.cells[0].onclick = function(){
            let newtripid = tripID == 0 ? line.trips-1 : tripID-1;
            let newday = tripID == 0 ? day-1 : day;
            section2data = {"lineID": lineID, "tripID": newtripid, "day": newday, "hidesinfront": hidesinfront};
            printcurrentsection();
        };
        row.cells[1].onclick = function(){
            section2data = {"lineID": lineID, "tripID": tripID, "day": day, "hidesinfront": !hidesinfront};
            printcurrentsection();
        }
        row.cells[2].style.backgroundColor = "#269c26";
        row.cells[2].onclick = function(){
            let newtripid = tripID == line.trips-1 ? 0 : tripID+1;
            let newday = tripID == line.trips-1 ? day+1 : day;
            section2data = {"lineID": lineID, "tripID": newtripid, "day": newday, "hidesinfront": hidesinfront};
            printcurrentsection();
        };
    }

    row = addrow({
        "table": table
    });
    row.className = "border";

    addrow({
        "table": table, 
        "c1t": "Stanice", 
        "c2t": "Příjezd", 
        "c3t": "Odjezd", 
        "c4t": "Vzdálenost",
        "includered": false});

    let starttime = line.starttime + day*86400 + tripID*line.interval;

    let distacc = 0;
    let i = 0;
    let tocolor = true;
    let toprint = !hidesinfront;
    stops.forEach(stop => {
        if (hideuntil == stop.sid){
            toprint = true;
        }
        distacc += stop.dist;
        if (toprint){
            let arrstr = i == 0 ? "-" : formatTime(stop.arr+starttime);
            let depstr = i == stops.length - 1 ? " - " : formatTime(stop.dep+starttime);
            let stname = getstationname(timetable.stations[stop.sid]);
            row = addrow({
                "table": table,
                "c1t": stname,
                "visibleoverflow": true
            });
            row.cells[0].onclick = function(){
                section1id = stop.sid;
                changecurrentsection(1);
            }
            row.cells[0].style.textWrap = "nowrap";
            row = addrow({
                "table": table, 
                "c2t": arrstr, 
                "c3t": depstr, 
                "c4t": String(Math.round(distacc))+"km",
                "scrollingfirstcol": stname.length>=12,
                "includered": false});
            if (stop.sid == delay.station){
                if (delay.status == 1){
                    row.cells[1].classList.add("lime");
                }
                tocolor = false;
            }
            if (tocolor){
                row.cells[1].classList.add("lime");
                row.cells[2].classList.add("lime");
            }
        }
        i++;
    });
}

function updateclock(){
    const currentDate = new Date();
    var time = currentDate.getHours()*3600 + currentDate.getMinutes()*60 + currentDate.getSeconds();
    _clock.innerText = formatTime(time);
}

function findpath(startstationID, endstationID, time=-1){
    const currentDate = new Date();
    if (time == -1){
        time = currentDate.getHours()*3600 + currentDate.getMinutes()*60 + currentDate.getSeconds();
    }
    console.log("starttime", formatTime(time));
    checkedstations = {};
    uncheckedstations = {};
    checkedlines = new Set();

    uncheckedstations[startstationID] = {"from": undefined, "line": null, "trip": null, "day": null, "time": {"time": time, "day": 0}};

    while(Object.keys(uncheckedstations).length > 0){
        let mintime = Infinity;
        let stationID = null;

        for (const id in uncheckedstations){
            let time = uncheckedstations[id].time.time + uncheckedstations[id].time.day*86400;
            if (time < mintime){
                mintime = time;
                stationID = id;
            }
        }

        stationID = parseInt(stationID);
        
        checkedstations[stationID] = uncheckedstations[stationID];
        delete uncheckedstations[stationID];

        if (stationID == endstationID) {
            let path = [];
            let currentId = endstationID;
            let data = checkedstations[endstationID];

            while (data && data.from !== undefined) {
                let line = timetable.lines[data.line];
                let tripStartTime = line.starttime + data.trip * line.interval + data.time.day*86400;
                if (tripStartTime > data.time.time + data.time.day*86400){
                    tripStartTime -= 86400;
                }
                let startStop = line.stops.find(s => s.sid === data.from);
                let endStop = line.stops.find(s => s.sid === currentId);
                let dist = 0;
                let start = false;
                line.stops.forEach(stop => {
                    if (stop.sid == data.from){
                        start = true;
                    }
                    else if (start){
                        dist += stop.dist;
                    }
                    if (stop.sid == currentId){
                        start = false;
                    }
                });
                path.push({
                    fromName: getstationname(timetable.stations[data.from]),
                    fromID: data.from,
                    toName: getstationname(timetable.stations[currentId]),
                    toID: currentId,
                    dep: tripStartTime + startStop.dep,
                    arr: tripStartTime + endStop.arr,
                    train: getTrainName(line, true, true),
                    traindata: {
                        "lineID": data.line,
                        "tripID": data.trip,
                        "day": data.time.day,
                        "hidesinfront": false
                    },
                    dist: dist
                });

                currentId = data.from;
                data = checkedstations[currentId];
            }

            path.reverse();
            console.log(`--- SPOJENÍ Z ${path[0].fromName.toUpperCase()} ---`);
            let p = "";
            path.forEach((step, index) => {
                p += `${index + 1}. ${step.train}: ${step.fromName.padEnd(30, " ")} [${String(step.fromID).padStart(4, "0")}] (${step.dep}) -> ${step.toName.padEnd(30, " ")} [${String(step.toID).padStart(4, "0")}] (${step.arr})` + "\n";
            });
            console.log(p);

            return path;
        }

        let station = timetable.stations[stationID];

        station.departures.forEach(lineID => {
            if (!checkedlines.has(lineID)){
                let line = timetable.lines[lineID];
                let found = false;
                let trip = null;
                let day = 0;
                line.stops.forEach(lstop => {
                    if (lstop.sid == stationID){
                        found = true;
                        stop = lstop;
                        let tripo = gettripnumberbytime(line, stationID, mintime);
                        if (mintime > 86400 && tripo.day > 1){
                            console.log(formatTime(mintime));
                            console.log(tripo);
                        }
                        day += tripo.day;
                        trip = tripo.trip;
                    }
                    else if (found){
                        let newarrtime = lstop.arr + trip*line.interval + line.starttime;
                        let tmpday = day;
                        if (newarrtime >= 86400){
                            newarrtime -= 86400;
                            tmpday++;
                        }
                        if (tmpday > 1){
                            console.log(line);
                            console.log(formatTime(newarrtime), day, formatTime(line.starttime));
                        }
                        if (!Object.keys(checkedstations).includes(String(lstop.sid))){
                            let foundinunchecked = Object.keys(uncheckedstations).includes(String(lstop.sid));
                            if (!foundinunchecked){
                                uncheckedstations[lstop.sid] = {"from": stationID, "line": lineID, "trip": trip, "time": {"time": newarrtime, "day": tmpday}};
                            }
                            else if (uncheckedstations[lstop.sid].time.time + uncheckedstations[lstop.sid].time.day*86400 > newarrtime + tmpday*86400){
                                uncheckedstations[lstop.sid] = {"from": stationID, "line": lineID, "trip": trip, "time": {"time": newarrtime, "day": tmpday}};
                            }
                        }
                        else{
                        }
                    }
                });
                checkedlines.add(lineID);
            }
        });
    }
}

function selectfilter(name){
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
    printcurrentsection();
}

function selectdestination(id){
    filters.statid = id;
    let departures = filters.departures;
    printcurrentsection(true);
}

function togglepinnedlist(){
    pinnedstationsopened = !pinnedstationsopened;
    console.log("toggled", pinnedstationsopened);
    printcurrentsection();
}

async function printtimetable(stationID, includegetonbutton = true, table=_timetable, includeheader=true, linescnt=15, timeoffset=0, force=false){
    if (isOpen && !force){
        return;
    }

    const currentDate = new Date();
    console.log(currentDate);
    var time = currentDate.getHours()*3600 + currentDate.getMinutes()*60 + currentDate.getSeconds();
    time+=timeoffset;

    if (!stationID){
        stationID = 0;
    }

    table.innerHTML = "";

    const station = timetable.stations[stationID];
    time %= 86400;

    if (currentsection == 1){
        _pinnedlist.innerHTML = "";
        _pinnedlist.style.display = "grid";
        _pinnedlisttoggle.style.display = "flex";
        _pinnedlisttoggle.innerHTML = String(pinnedstations.length);
        if (pinnedstations.length == 0){
            _pinnedlist.style.display = "none";
            _pinnedlisttoggle.style.display = "none";
        }
        if (!pinnedstationsopened){
            _pinnedlist.style.display = "none";
        }
        else{
            pinnedstations.forEach(pinnedstation => {
                const newdiv = document.createElement("div");
                newdiv.innerHTML = "📌 "+getstationname(timetable.stations[pinnedstation]);
                newdiv.onclick = function(){
                    section1id = pinnedstation;
                    changecurrentsection(1);
                };
                _pinnedlist.appendChild(newdiv);
            });
        }
    }

    if (includeheader){
        row = _timetableheader;
        row.classList = [];
        row.innerText = getstationname(station);
        if (currentsection == 1){
            let pinned = false;
            if (pinnedstations.includes(stationID)){
                row.className = 'pinned';
                pinned = true;
            }
            else{
                row.className = 'notpinned';
            }
            row.onclick = function(){
                if (!pinned){
                    pinnedstations.push(stationID);
                    printcurrentsection();
                    savepinnedlist();
                }
                else{
                    const index = pinnedstations.indexOf(stationID);
                    pinnedstations.splice(index, 1);
                    printcurrentsection();
                    savepinnedlist();
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
            let name = getstationname(timetable.stations[lstop.sid]);
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
        let timetosearchfrom = Math.max(time - stoparrdep - line.interval*3 - 30*60, time-43200);
        if (timetosearchfrom < 0){
            day = -1;
            timetosearchfrom += 86400;
        }
        
        let tripobject = gettripnumberbytime(line, stationID, timetosearchfrom);
        let triptosearch = tripobject.trip;
        day += tripobject.day;
        let delay = 0;

        while(getDelay(lineID, triptosearch, time, stationID, day).status > 3){
            triptosearch++;
            if (triptosearch >= line.trips){
                triptosearch = 0;
                day++;
            }
            delay = getDelay(lineID, triptosearch, time, stationID, day);
        };
        return {
            lineID: lineID,
            journeystart: line.starttime + triptosearch * line.interval + day*86400,
            time: line.starttime + triptosearch * line.interval + stoparrdep + day*86400,
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
        _destinations.add(opt);
    });

    const doesoptionexist = Array.from(_destinations.options).some(opt => opt.value == filters.statid);
    if (doesoptionexist){
        _destinations.value = filters.statid;
    }
    else{
        _destinations.value = -1;
        selectdestination(-1);
    }
    _destheader.innerText = departures ? "Spoje do:" : "Spoje z:";

    addrow({
        "table": table, 
        "c1t": "Vlak", 
        "c2t": departures ? "Do" : "Z", 
        "c3t": departures ? "Prav. Odjezd " : "Prav. Příjezd", 
        "onlythreecols": true,
        "includered": false});

    if (nexttrains.length == 0){
        addrow({"table": table, 
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
        const destinationname = getstationname(timetable.stations[destinationID]).substring(0, 35).padEnd(35, " ");
        const regionname = timetable.stations[destinationID].district;

        let delaystr = current.delay.status == -1 ? "Zrušeno ve stanici " + getstationname(timetable.stations[current.delay.station]) : 
            (current.delay.delay >= 60 ? "+"+String(Math.floor(current.delay.delay/60)) : "")+(current.delay.delay >= 300 ? "<br>"+getdelayreason(current.lineID, current.trip, current.day) : "");

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
                    "station": getstationname(timetable.stations[stop.sid]),
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
        let row = addrow({
            "table": table, 
            "c1t": trainname, 
            "c2t": destinationname, 
            "c3t": formatTime(current.time), 
            "scrolling": destinationname.trim().length >= 18,
            "stopsdata": stopsdata, 
            "includered": current.delay.delay >= 60 || current.delay.status == -1, 
            "conn": conn, 
            "subtextdest": regionname, 
            "subtexttrain": line.nickname,
            "subtexttime": delaystr,
            "onlythreecols": true,
            "includegetonbutton": current.delay.status == 3 && includegetonbutton,
            "includetrainlink": true,
            "goalstationid": destinationID});

        do{
            if (current.trip >= current.maxtrips-1) {
                current.day++;
                current.trip = 0;
                current.time = line.starttime + current.day*86400 + stoparrdep;
                current.journeystart = line.starttime + current.day*86400;
            } else {
                current.trip++;
                current.time += current.interval;
                current.journeystart += current.interval;
            }
            current.delay = getDelay(current.lineID, current.trip, time, stationID, current.day);
        } while(current.delay.status > 3);
    }
}

function printidos(){
    _idosstats.style.display = "none";
    if (!currentposition.iswifi){
        _idosresults.innerHTML = "Žádné připojení k Wi-Fi<br>Spojení nebylo možné nalézt!";
        _idosresults.className = "nowifiinfo";
        return;
    }
    _idosstats.style.display = "flex";
    let res = findpath(section4ids[0], section4ids[1], idostime);
    console.log(res);
    _idosresults.innerHTML = "";

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
            changecurrentsection(2);
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
        sc2.innerText = getstationname(timetable.stations[result.fromID]);
        sc2.style.textAlign = "left";
        sc2.style.textWrap = "wrap";
        sc2.onclick = function(){
            section1id = result.fromID;
            changecurrentsection(1);
        };

        let erow = _idosresults.insertRow(-1);
        let ec0 = erow.insertCell(-1);
        let ec1 = erow.insertCell(-1);
        let ec2 = erow.insertCell(-1);
        ec0.innerText = "●"
        ec1.innerText = formatTime(result.arr);
        endtime = result.arr;
        ec2.innerText = getstationname(timetable.stations[result.toID]);
        ec2.style.textAlign = "left";
        ec2.style.textWrap = "wrap";
        ec2.onclick = function(){
            section1id = result.toID;
            changecurrentsection(1);
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
    console.log(speed);
    _idosstatsspeed.innerText = String(Math.round(speed))+"km/h";
}
