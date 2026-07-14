const schedule = (() => {
function toggle(clickedrow, stopsdata){
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

    let i = 1;
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

function print(table=_information, conns=connstruct, checkifkick=false, getoffbutton=false){
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
    let delay = delays.get(lineID, tripID, time, stops[stops.length-1], day);
    if (checkifkick){
        if (delay.status == 6){
            changetransporttype(0);
            gameState.updateCurrentPosition({statID: stops[stops.length-1].sid});
            printcurrentsection();
        }
        if (delay.status == -1 || delay.status == 7){
            changetransporttype(0);
            gameState.updateCurrentPosition({statID: delay.station});
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
    let delayreason = (delay.delay >= 300 ? delays.getReason(lineID, tripID, day) : "");

    let row = addrow({
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
            changetransporttype(0);
            gameState.updateCurrentPosition({statID: delay.station});
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

    return { toggle, print, updateTrackProgress: updatetrackprogress };
})();
