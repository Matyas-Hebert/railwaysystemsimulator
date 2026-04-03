function getnexttripnumber(currtime, trainstarttime, interval, timeadj){
    return Math.max(Math.ceil((currtime-(trainstarttime+timeadj))/interval),0)+1;
}

function getStopTimeFromType(type){
    if (type <= 1){
        return 30;
    }
    if (type <= 4){
        return 90;
    }
    return 180; // in seconds
}

function formatTime(seconds, includeday = true, includeseconds = true) {
    const d = Math.floor(seconds/86400);
    let s = (Math.round(seconds) % 86400); 
    if (s < 0){
        s += 86400;
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

function mulberry32(a){
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function newgetdelaymult(seed, currentdelayperc, type){
    currentdelayperc *= -1;
    let x = mulberry32(seed); 
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

function getdelaymult(seed, currentdelayperc, type){
    let rand = mulberry32(seed); 

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

function getstartdelay(seed, type){
    let rand = mulberry32(seed);
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

function getCurrentTimeInMs(){
    const now = new Date();
    return now.getTime() - (now.getTimezoneOffset()*60000);
}

function getDelay(lineID, tripNumber, time, stationID, daynumber){
    const line = timetable.lines[lineID];
    let delay = getstartdelay((tripNumber+1) * 100 + lineID * 100000 + daynumber, line.type);
    const starttime = line.starttime + line.interval*tripNumber + daynumber*86400;
    const stops =  line.stops;
    let previousdeptime = starttime + stops[0].dep + delay;
    let exprecteddeptime = previousdeptime-delay;

    if (starttime-delay > time){
        return {"delay": 0, "status": 0, "station": stops[0].sid, "arrtime": Math.round(starttime), "deptime": null, "progress": 1};
    }
    
    if (previousdeptime >= time){
        let status = stops[0].sid == stationID ? 3 : 1;
        return {"delay": Math.max(0, time-exprecteddeptime), "status": status, "station": stops[0].sid, "arrtime": Math.round(starttime), "deptime": Math.round(previousdeptime), "progress": 1};
    }

    let passedtargetstation = false;

    if (stops[0].sid == stationID){
        passedtargetstation = true;
    }

    let expdepattarget;
    stops.forEach(stop => {
        if (stop.sid == stationID){
            expdepattarget = stop.dep + starttime;
            return;
        }
    });

    for (let i = 1; i < line.stops.length; i++){
        const stoptime = line.stops[i].dep - line.stops[i].arr;
        const stop = line.stops[i];
        const standarttraveltime = stop.arr - line.stops[i-1].dep
        const dayssinceera = Math.floor(getCurrentTimeInMs() / (86400000));
        let seed = i + (tripNumber+1) * 50 + lineID * 25000 + (dayssinceera + daynumber)*100000000;
        let newdelay = newgetdelaymult(seed, delay/standarttraveltime, line.type)*standarttraveltime;
        const arrtime = starttime + stop.arr + delay + newdelay;
        if (arrtime > time){
            const progress = (time-previousdeptime)/(arrtime-previousdeptime);
            return {"delay": Math.round(delay+newdelay*progress), "status": passedtargetstation ? 4 : 2, "station": stops[i].sid, 
                    "arrtime": Math.round(arrtime), "deptime": Math.round(previousdeptime), "progress": progress};
        }

        if (i < line.stops.length-1 && mulberry32(seed*2+1) <= 0.0023){
            const status = expdepattarget + delay + newdelay < time ? 7 : -1;
            return {"delay": Math.round(delay+newdelay), "status": status, "station": stops[i].sid, 
                    "arrtime": Math.round(arrtime), "deptime": null, "progress": 1};
        }

        if (stop.sid == stationID){
            passedtargetstation = true;
        }

        delay += newdelay;
        delay -= Math.min(delay, stoptime/3);
        previousdeptime = starttime + stop.dep + delay;

        if (previousdeptime >= time){
            let status = passedtargetstation ? (stop.sid == stationID ? 3 : 5) : 1;
            return {"delay": Math.round(delay), "status": status, "station": stops[i].sid, 
                    "arrtime": Math.round(arrtime), "deptime": Math.round(previousdeptime), "progress": 1};
        }
    }

    return {"delay": Math.round(delay), "status": 6, "station": null, 
                    "arrtime": null, "deptime": Math.round(previousdeptime), "progress": 1};
}

function gettripnumberbytime(line, stationID, time){
    let extradays = Math.floor(time/86400);
    time = (time+86400)%86400;
    // find the first trip that departures from stationID after time

    const stop = line.stops.find(s => s.sid === stationID);
    const firstdep = line.starttime + stop.dep;
    let elapsed = time - firstdep;

    if (elapsed < 0){
        let yesterdayelapsed = elapsed + 86400;
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

function getstatusstring(status){
    if (status == 0) {return "Train havent depart yet"; }
    if (status == 1) {return "Train is stopped at a station before the target";}
    if (status == 2) {return "Train is travelling towards target";}
    if (status == 3) {return "Train is stopped at the target station";}
    if (status == 4) {return "Train is travelling past the target";}
    if (status == 5) {return "Train is stopped at a station past the target";}
    if (status == 6) {return "Train have finished its journey";}
    return "unknown status "+String(status);
}

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
    //let c4 = detailrow.insertCell(3);

    c1.innerText = "STANICE";
    c2.innerText = "PŘÍJEZD";
    c3.innerText = "ODJEZD";
    //c4.innerText = "VZDÁLENOST";

    i = 1;
    stopsdata.forEach(stopdata => {
        let detailrow = _timetable.insertRow(clickedrow.rowIndex+1+i);
        detailrow.className = "detail";

        let c1 = detailrow.insertCell(0);
        let c2 = detailrow.insertCell(1);
        let c3 = detailrow.insertCell(2);
        //let c4 = detailrow.insertCell(3);

        if (stopdata.station.length >= 17){
            c1.innerHTML = `<div class="scroll-container"><div class="scroll-text">${stopdata.station}</div></div><div class="subtext">${timetable.stations[stopdata.id].district}</div>`;
        }
        else{
            c1.innerHTML = `<div>${stopdata.station}</div></div><div class="subtext">${timetable.stations[stopdata.id].district}</div>`;
        }
        c2.innerText = stopdata.arr;
        c3.innerText = stopdata.dep;
        //c4.innerText = stopdata.dist;

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
    updatepositionlocalstorage();
}

function getwifichance(type){
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

function havewifi(lineID, tripID, day, type){
    let seed = tripID+lineID*201+day*81573;
    let r = mulberry32(seed);
    let newr = (r*123)-Math.floor(r*123);
    if (getwifichance(type)+wifiluckboost >= newr){
        return true;
    }
    return false;
}

function havewifistation(statID, day){
    let seed = statID+day*5001;
    let r = mulberry32(seed);
    if (r+wifiluckboost >= 0.7){
        return true;
    }
    return false;
}

function getdelayreason(lineID, tripID, day){
    // reasons[0] je duvod, reasons[1] je weight
    let total = 0;
    reasons.forEach(reason => {
        total += reason[1];
    });
    let seed = tripID+lineID*201+day*81573;
    let r = mulberry32(seed);
    let target = total*r;
    total = 0;
    i = 0;
    for (let i = 0; i < reasons.length; i++) {
        total += reasons[i][1];
        if (total >= target) {
            return reasons[i][0];
        }
    }
    
    return reasons[reasons.length - 1][0];
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

function updatetrackprogress(status, progress, station1, station2){
    _doublestop.className = "inactive";
    _singlestop.className = "inactive";
    _firststop.className = "inactive";
    _laststop.className = "inactive";
    if (status == -1 || status == 7){
        _singlestop.className = "active";
        _sss1.innerText = timetable.stations[station1].name;
        _sss1.onclick = function(){
            section1id = station1;
            changecurrentsection(1);
        };
    }
    if (status == 0){
        _firststop.className = "active";
        _fss1.innerText = timetable.stations[station1].name;
        _fss1.onclick = function(){
            section1id = station1;
            changecurrentsection(1);
        };
    }
    if (status == 6){
        _laststop.className = "active";
        _lss1.innerText = timetable.stations[station1].name;
        _lss1.onclick = function(){
            section1id = station1;
            changecurrentsection(1);
        };
    }
    if (status == 1 || status == 3 || status == 5){
        _singlestop.className = "active";
        _sss1.innerText = timetable.stations[station1].name;
        _sss1.onclick = function(){
            section1id = station1;
            changecurrentsection(1);
        };
    }
    if (status == 2 || status == 4){
        _doublestop.className = "active";
        progress = Math.floor(progress*100);
        _dspt.style.setProperty("width", `${progress}%`, "important");
        console.log(timetable.stations[station1].name, timetable.stations[station2].name)
        _dss1.innerText = timetable.stations[station2].name;
        _dss2.innerText = timetable.stations[station1].name;
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
            changetransporttype(0);
            currentposition.statID = stops[stops.length-1].sid;
            updatepositionlocalstorage();
            printcurrentsection();
        }
        if (delay.status == -1 || delay.status == 7){
            changetransporttype(0);
            currentposition.statID = delay.station;
            updatepositionlocalstorage();
            printcurrentsection();
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
        "c2t": "Z "+timetable.stations[stops[0].sid].name,
        "subtexttrain": line.nickname,
        "subtextdest": "Do "+timetable.stations[stops[stops.length-1].sid].name,
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
            currentposition.statID = delay.station;
            changetransporttype(0);
            updatepositionlocalstorage();
            printcurrentsection();
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

        row.cells[0].style.backgroundColor = "green";
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
        row.cells[2].style.backgroundColor = "green";
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
            let stname = timetable.stations[stop.sid].name;
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
    //time = 14*3600+40*60;
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

            // 1. Posbíráme trasu pozpátku
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
                    fromName: timetable.stations[data.from].name,
                    fromID: data.from,
                    toName: timetable.stations[currentId].name,
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

            // 2. Obrátíme ji, aby byla od startu do cíle
            path.reverse();

            // 3. Vykreslíme to hezky
            console.log(`--- SPOJENÍ Z ${path[0].fromName.toUpperCase()} ---`);
            let p = "";
            path.forEach((step, index) => {
                p += `${index + 1}. ${step.train}: ${step.fromName.padEnd(30, " ")} [${String(step.fromID).padStart(4, '0')}] (${step.dep}) -> ${step.toName.padEnd(30, " ")} [${String(step.toID).padStart(4, '0')}] (${step.arr})` + "\n";
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
                            //console.log("found in checked stations");
                        }
                    }
                });
                checkedlines.add(lineID);
            }
        });

        //return;
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

function savepinnedlist(){
    localStorage.setItem("_pinnedstations", JSON.stringify(pinnedstations));
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
                newdiv.innerHTML = "📌 "+timetable.stations[pinnedstation].name;
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
        row.innerText = station.name;
        // addrow({
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
            let name = timetable.stations[lstop.sid].name;
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
        const destinationname = timetable.stations[destinationID].name.substring(0, 35).padEnd(35, " ");
        const regionname = timetable.stations[destinationID].district;

        let delaystr = current.delay.status == -1 ? "Zrušeno ve stanici " + timetable.stations[current.delay.station].name : 
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
                    "station": timetable.stations[stop.sid].name,
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

function normalize(string){
    return string.normalize("NFD").replace(/-/g, '').replace(/\./g, '').replace(/[\u0300-\u036f]/g, "").replace(/ /g,'').toLowerCase();
}

function searchstations(search, firstid=null){
    let updatedsearch = normalize(search);
    let valid = [];
    let exact = [];
    let first = null;
    timetable.stations.forEach(station => {
        let name = normalize(station.name);
        if (name == updatedsearch || name.replace("hln", "") == updatedsearch || name.replace("hls", "") == updatedsearch){
            exact.push({"name":station.name, "district":station.district, "id": station.id, "color": false});
        }
        else if (name.includes(updatedsearch)){
            if (station.id == firstid){
                first = {"name":station.name, "district":station.district, "id": station.id, "color": true};
            }
            else{
                valid.push({"name":station.name, "district":station.district, "id": station.id, "color": false});
            }
        }
    });
    valid = valid.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    exact.forEach(ex =>{
        valid.unshift(ex);
    })
    if (first != null){
        valid.unshift(first);
    }
    return valid;
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

    console.log("printing idos");

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
        sc2.innerText = timetable.stations[result.fromID].name;
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
        ec2.innerText = timetable.stations[result.toID].name;
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

function startgame(){
    currentposition = {
        transporttype: 0,
        statID: startid,
        goalStatID: startid
    };
    changecurrentsection(0);
    updatepositionlocalstorage();
};

function switchidoslocations(){
    console.log("switching");
    let tmp = section4ids[0];
    section4ids[0] = section4ids[1];
    section4ids[1] = tmp;
    let tmpvalue = _idosstart.value;
    let tmphtml = _idosstart.innerHTML;
    _idosstart.value = _idosend.value;
    _idosstart.innerHTML = _idosend.innerHTML;
    _idosend.value = tmpvalue;
    _idosend.innerHTML = tmphtml;
    printcurrentsection();
}

function search(search, options=_s1options, section4 = false, id=0, inputfield=null, clear=false, start=false){
    options.innerHTML = "";
    let i = 0;
    if (clear){
        inputfield.value = "";
        search = inputfield.value;
    }
    let opts;
    if (currentsection == 4 && currentposition.transporttype == 0){
        opts = searchstations(search, currentposition.statID);
    }
    else{
        opts = searchstations(search);
    }
    opts.slice(0,20).forEach(opt => {
        let newdiv = document.createElement("div");
        newdiv.className = "search-result";
        newdiv.onclick = function(){
            if (section4){
                section4ids[id] = opt.id;
                inputfield.value = opt.name;
            }
            if (start){
                startid = opt.id;
                inputfield.value = opt.name;
            }
            else {
                section1id = opt.id;
            }
            options.innerHTML = "";
            printcurrentsection();
        };
        newdiv.innerHTML = `
            <span class="main-text">${opt.name}</span>
            <span class="alt-text">${opt.district}</span>
        `;
        if (opt.color){
            newdiv.className = "colored-search-result";
        }
        options.appendChild(newdiv);
        i++;
    });
}

function closes1options(){
    _s1options.innerHTML = "";
}

function decreasetime(){
    idostime -= 60*30;
    updateidostimeview();
}

function increasetime(){
    idostime += 60*30;
    updateidostimeview();
}

function updateidostime(){
    let parts = _idostime.value.split(":");
    if (parts.length < 2){
        return;
    }
    let hours = parseInt(parts[0]);
    let minutes = parseInt(parts[1]);
    console.log(hours, minutes);
    if (minutes > 100){
        hours = Math.min((hours%10)*10, 20);
        console.log(hours, minutes);
        hours += Math.floor(minutes/100);
        console.log(hours, minutes);
        minutes %= 100;
    }
    console.log(hours, minutes);
    idostime = hours*3600+minutes*60;
    updateidostimeview();
}

function updateidostimeview(){
    _idostime.value = formatTime(idostime, false, false);
}

function selectsection(section){
    if (section >= 0 && section < 6){
        changecurrentsection(section);
    }
    if (currentsection == 4){
        const currentDate = new Date();
        idostime = currentDate.getHours()*3600 + currentDate.getMinutes()*60;
        updateidostimeview();
    }
    printcurrentsection();
}

function printwalkable(stationID){
    _walkables.innerHTML = "";

    let div = document.createElement("div");
    div.innerText = timetable.stations[stationID].name;
    div.classList = "whiteheader";
    _walkables.appendChild(div);
    if (stationID == -1){
        let d = document.createElement("div");
        d.innerText = "Jsi ve vlaku, nikam nejdeš!"
        d.classList = "reddishinfo";
        _walkables.appendChild(d);
        return;
    }
    let stationiwd = timetable.stations[stationID].iwd;
    console.log(stationiwd);
    if (stationiwd.length == 0){
        let d = document.createElement("div");
        d.innerText = "Nikam odtud nelze dojít"
        d.classList = "reddishinfo";
        _walkables.appendChild(d);
        return;
    }
    let i = 0;
    stationiwd.forEach(iwd => {
        let options = document.createElement("div");
        options.classList = "whiteheader";
        if (i%2 == 0){
            options.classList.add("whiteheaderlightbg");
        }

        let name = document.createElement("div");
        name.innerText = timetable.stations[iwd.id].name;

        let time = document.createElement("div");
        time.innerText = String(Math.round(iwd.dist*8))+" min";

        let go = document.createElement("div");
        go.innerText = "JÍT";
        go.className = "selected";

        go.onclick = function() {
            changetransporttype(2);
            currentposition.goalStatID = iwd.id;
            currentposition.time = getCurrentTimeInMs();
            updatepositionlocalstorage();
            changecurrentsection(0);
        }
        name.onclick = function(){
            section1id = iwd.id;
            changecurrentsection(1);
        }
        options.appendChild(name);
        options.appendChild(time);
        options.appendChild(go);

        options.style.padding = "0.5rem";
        _walkables.appendChild(options);
        i++;
    });
}

function printwalkprogress(table){
    let startstat = timetable.stations[currentposition.statID];
    let endstat = timetable.stations[currentposition.goalStatID];
    let dist = getiwddistance(currentposition.statID, currentposition.goalStatID);
    let mstime = dist*8*60*1000;
    let timeelapsed = getCurrentTimeInMs()-currentposition.time;
    let timetogo = mstime-timeelapsed;
    let mins = Math.ceil(timetogo/(60*1000));
    _mintogoal.innerText = String(mins);
    if (mins <= 1){
        _mintogoal.innerText += " minuta";
    }
    else if (mins <= 4){
        _mintogoal.innerText += " minuty";
    }
    else{
        _mintogoal.innerText += " minut";
    }
    _mintogoal.innerText += " do cíle";
    if (timeelapsed >= mstime){
        changetransporttype(0);
        currentposition.statID = currentposition.goalStatID;
        updatepositionlocalstorage();
        printcurrentsection();
        return;
    }
    updatetrackprogress(2, timeelapsed/mstime, currentposition.goalStatID, currentposition.statID);
    _turnbtn.onclick = function(){
        currentposition.time = getCurrentTimeInMs()-timetogo;
        console.log(currentposition.time);
        console.log(timetogo);
        let tmp = currentposition.statID;
        currentposition.statID = currentposition.goalStatID;
        currentposition.goalStatID = tmp;
        updatepositionlocalstorage();
        printcurrentsection();
    }
    table.innerHTML = "";
}

function updatepositionlocalstorage(){
    let tmp = { ...currentposition};
    tmp.statID = timetable.stations[currentposition.statID].lonlat;
    tmp.goalStatID = timetable.stations[currentposition.goalStatID].lonlat;
    console.log(tmp, "saved");
    localStorage.setItem("_currentposition", JSON.stringify(tmp));
}

function getiwddistance(fromID, toID){
    let dist = 0;
    timetable.stations[fromID].iwd.forEach(iw => {
        if (iw.id == toID){
            dist = iw.dist;
        }
    });
    return dist;
}

function printcurrentsection(force = false){
    console.log(currentposition);
    _start.style.display = "none";
    _tables.style.display = "none";
    if (currentposition == null){
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
    _subsection5.style.display = "none";
    _tab0.className = currentsection == 0 ? "chosen" : "unchosen";
    _tab1.className = currentsection == 1 ? "chosen" : "unchosen";
    _tab2.className = currentsection == 2 ? "chosen" : "unchosen";
    _tab4.className = currentsection == 4 ? "chosen" : "unchosen";
    _tab5.className = currentsection == 5 ? "chosen" : "unchosen";
    _tab5.style.display = currentposition.transporttype == 0 ? "block" : "none";
    if (currentsection == 0){
        if (currentposition.transporttype == 0){
            printtimetable(currentposition.statID, true, _timetable, true, 15, 0, force);
        }
        if (currentposition.transporttype == 1){
            _section0.style.display = "none";
            _section2.style.display = "block";
            currentposition.hidesinfront = true;
            printschedule(_traintimetable, currentposition, true, true);
        }
        if (currentposition.transporttype == 2){
            _section0.style.display = "none";
            _section2.style.display = "block";
            _subsection5.style.display = "block";
            printwalkprogress(_traintimetable);
        }
    }
    if (currentsection == 1){
        printtimetable(section1id, false, _timetable, true, 15, 0, force);
    }
    if (currentsection == 2){
        printschedule(_traintimetable, section2data);
    }
    if (currentsection == 5){
        printwalkable(currentposition.transporttype == 2 ? -1 : currentposition.statID);
    }

    currentposition.iswifi = false;
    if (currentposition.transporttype == 0){
        currentposition.iswifi = havewifistation(currentposition.statID, currentposition.day);
    }
    if (currentposition.transporttype == 1){
        currentposition.iswifi = havewifi(currentposition.lineID, currentposition.tripID, currentposition.day, timetable.lines[currentposition.lineID].type);
    }
    if (currentposition.transporttype == 2){
        let start = currentposition.time;
        let dist = getiwddistance(currentposition.statID, currentposition.goalStatID);
        let mstime = dist*8*60*1000;
        let end = start+mstime;
        let current = getCurrentTimeInMs();
        if (Math.abs(current - start) < 60000){
            currentposition.iswifi = havewifistation(currentposition.statID, currentposition.day);
        }
        if (Math.abs(current - end) < 60000){
            currentposition.iswifi = havewifistation(currentposition.goalStatID, currentposition.day);
        }
    }
    if (currentposition.iswifi){
        _wifi.className = "wifi";
    }
    else{
        _wifi.className = "nowifi";
    }
}

function loadfromlocalstorage(){
    currentposition = JSON.parse(localStorage.getItem("_currentposition"));
    if (currentposition == null){
        return;
    }
    currentposition.iswifi = false;
    if (!Object.keys(currentposition).includes("statID")){
        console.log("statID not found");
        currentposition = null;
        return;
    }
    if (!Object.keys(currentposition).includes("transporttype")){
        changetransporttype(0);
    }
    if (!(parseInt(currentposition.statID) <= 10000)){
        currentposition.statID = lonlattoid[currentposition.statID];
        if (currentposition.statID == null){
            console.log("statID");
            currentposition = null;
            return;
        }
    }
    if (!Object.keys(currentposition).includes("goalStatID")){
        if (currentposition.transporttype == 2){
            changetransporttype(0);
        }
        return;
    }
    currentposition.goalStatID = lonlattoid[currentposition.goalStatID];
    pinnedstations = localStorage.getItem("_pinnedstations") == null ? [] :
                    JSON.parse(localStorage.getItem("_pinnedstations"));
}

console.log(localStorage.getItem("test"));
localStorage.setItem("test", "value");

let isOpen = false;
let justClosed = false;

_destinations.addEventListener('click', () => {
    if (justClosed){
        return;
    }
    isOpen = !isOpen; 
    console.log(isOpen ? "Opened" : "Closed");
});

_destinations.addEventListener('blur', () => {
    isOpen = false;
    console.log("Closed (lost focus)");
});

_destinations.addEventListener('change', () => {
    isOpen = false;
    console.log("Closed (item selected)");
    justClosed = true;
    setTimeout(() => { justClosed = false; }, 10);
});

window.addEventListener('scroll', () => {
    if (isOpen){
        isOpen = false;
        console.log("Closed (item scrolled)");
    }
});

//generateTimeTables();
let openeddetail = "";
let connstruct = {};
let idostime = 0;
let filters = {"departures": true, "types": [true, true, true, true, true, true], "statid": -1};
// 0 - in station, 1 - on train, 2 - walking
let currentposition = null;
let pinnedstations = [];
loadfromlocalstorage();
let pinnedstationsopened = false;
let currentsection = 0;
let section1id = 200;
let section4ids = [69, 420];
let startid = -1;
let wifiluckboost = 0;
let section2data = {"lineID": 1, "tripID": 1, "day": 0, "hidesinfront": true};
printcurrentsection();
setInterval(updateclock, 1000);
setInterval(printcurrentsection, 5000);
let m = timetable.stations.length;