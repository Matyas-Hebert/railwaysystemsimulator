const schedule = (() => {
function toggle(clickedrow, stopsdata, conn = null, allowAutoBoard = false){
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

    let detailOffset = 1;
    if (allowAutoBoard && conn !== null) {
        const actionRow = _timetable.insertRow(clickedrow.rowIndex + 1);
        actionRow.className = "detail auto-board-detail-row";
        const actionCell = actionRow.insertCell(0);
        actionCell.colSpan = 3;

        const selected = isAutoBoardSelection(conn);
        const button = document.createElement("button");
        button.className = selected
            ? "auto-board-btn selected"
            : "auto-board-btn";
        button.textContent = selected
            ? "S AUTOMATICKÝM NÁSTUPEM"
            : "BEZ AUTOMATICKÉHO NÁSTUPU";
        button.onclick = event => {
            event.stopPropagation();
            toggleAutoBoardSelection(conn);
        };
        actionCell.appendChild(button);
        detailOffset++;
    }

    let i = detailOffset;
    stopsdata.forEach(stopdata => {
        let detailrow = _timetable.insertRow(clickedrow.rowIndex+1+i);
        detailrow.className = "detail";

        let c1 = detailrow.insertCell(0);
        let c2 = detailrow.insertCell(1);
        let c3 = detailrow.insertCell(2);
        //let c4 = detailrow.insertCell(3);

        if (stopdata.station.length >= 17){
            c1.innerHTML = `<div class="scroll-container"><div class="scroll-text">${settings.getStationNameMarkup(timetable.stations[stopdata.id])}</div></div><div class="subtext">${timetable.stations[stopdata.id].district}</div>`;
        }
        else{
            c1.innerHTML = `<div>${settings.getStationNameMarkup(timetable.stations[stopdata.id])}</div></div><div class="subtext">${timetable.stations[stopdata.id].district}</div>`;
        }
        c2.innerText = stopdata.arr;
        c3.innerText = stopdata.dep;
        //c4.innerText = stopdata.dist;

        if (stopdata.id == filters.statid){
            c1.className = "delayed";
        }

        c1.onclick = function() {
            section1id = stopdata.id;
            changeCurrentSection(1);
        };
        i++;
    });
}

function updateTrackProgress(status, progress, station1, station2){
    _doublestop.className = "inactive";
    _singlestop.className = "inactive";
    _firststop.className = "inactive";
    _laststop.className = "inactive";
    if (status === TRAIN_STATUS.CANCELLED_BEFORE_TARGET || status === TRAIN_STATUS.CANCELLED_AFTER_TARGET){
        _singlestop.className = "active";
        settings.setStationName(_sss1, timetable.stations[station1]);
        _sss1.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
    if (status === TRAIN_STATUS.NOT_DEPARTED){
        _firststop.className = "active";
        settings.setStationName(_fss1, timetable.stations[station1]);
        _fss1.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
    if (status === TRAIN_STATUS.FINISHED){
        _laststop.className = "active";
        settings.setStationName(_lss1, timetable.stations[station1]);
        _lss1.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
    if (status === TRAIN_STATUS.STOPPED_BEFORE_TARGET || status === TRAIN_STATUS.STOPPED_AT_TARGET || status === TRAIN_STATUS.STOPPED_PAST_TARGET){
        _singlestop.className = "active";
        settings.setStationName(_sss1, timetable.stations[station1]);
        _sss1.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
    if (status === TRAIN_STATUS.TRAVELLING_TO_TARGET || status === TRAIN_STATUS.TRAVELLING_PAST_TARGET){
        _doublestop.className = "active";
        progress = Math.floor(progress*100);
        _dspt.style.setProperty("width", `${progress}%`, "important");
        settings.setStationName(_dss1, timetable.stations[station2]);
        settings.setStationName(_dss2, timetable.stations[station1]);
        _dss1.onclick = function(){
            section1id = station2;
            changeCurrentSection(1);
        };
        _dss2.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
}

function print(table=_information, conns=connstruct, checkifkick=false, getoffbutton=false){
    if (Object.keys(conns).length == 0){
        return;
    }
    let lineID = conns.lineID;
    let tripID = conns.tripID;
    let dayssinceepoch = Math.floor(getCurrentTimeInMilliseconds() / MILLISECONDS_PER_DAY);
    let day = conns.day;
    if (day >= 100){
        day = day-dayssinceepoch;
    }
    let hidesinfront = conns.hidesinfront;
    if (lineID == null || tripID == null){
        return;
    }
    let time = getCurrentTimeInSeconds();
    table.innerHTML = "";
    _traintimetableheader.innerHTML = "";
    let line = timetable.lines[lineID];
    let stops = line.stops;
    let delay = delays.get(lineID, tripID, time, stops[stops.length-1], day);
    if (checkifkick){
        if (delay.status === TRAIN_STATUS.FINISHED){
            changeTransportType(0);
            gameState.updateCurrentPosition({statID: stops[stops.length-1].sid});
            renderCurrentSection();
        }
        if (delay.status === TRAIN_STATUS.CANCELLED_BEFORE_TARGET || delay.status === TRAIN_STATUS.CANCELLED_AFTER_TARGET){
            changeTransportType(0);
            gameState.updateCurrentPosition({statID: delay.station});
            renderCurrentSection();
        }
    }
    if (delay.station == null){
        hidesinfront = false;
    }
    let hideuntil = delay.station;
    if (currentsection == 2 || currentsection == 0){
        let secst = stops[stops.length-1].sid;
        if (delay.status === TRAIN_STATUS.TRAVELLING_TO_TARGET || delay.status === TRAIN_STATUS.TRAVELLING_PAST_TARGET){
            for(let i=0; i<stops.length; i++){
                if (stops[i].sid == delay.station){
                    break;
                }
                secst = stops[i].sid
                hideuntil = secst;
            }
        }
        if (delay.station == null){
            updateTrackProgress(delay.status, delay.progress, secst, 1);
        }
        else{
            updateTrackProgress(delay.status, delay.progress, delay.station, secst);
        }
    }
    let delaystring = "+"+String(Math.floor(delay.delay/60));
    let delayreason = (delay.delay >= 300 ? delays.getReason(lineID, tripID, day) : "");

    let row = addRow({
        "table": _traintimetableheader,
        "c1t": "Vlak",
        "c2t": "Z/DO",
        "c3t": delaystring,
        "subtexttime": delayreason,
        "includered": delay.delay>=60 || delay.status === TRAIN_STATUS.CANCELLED_BEFORE_TARGET,
        "onlythreecols": true});

    row = addRow({
        "table": _traintimetableheader,
        "c1t": getTrainName(line),
        "c2t": "Z "+settings.getStationNameMarkup(timetable.stations[stops[0].sid]),
        "subtexttrain": line.nickname,
        "subtextdest": "Do "+settings.getStationNameMarkup(timetable.stations[stops[stops.length-1].sid]),
        "noclasssubtextdest": true,
        "includered": false,
        "onlythreecols": true});

    row.cells[0].onclick = function(){
        section2data = conns;
        changeCurrentSection(2);
    }

    row.deleteCell(2);
    row.cells[1].colSpan = 2;
    if (getoffbutton && delay.status === TRAIN_STATUS.STOPPED_BEFORE_TARGET || delay.status === TRAIN_STATUS.STOPPED_AT_TARGET || delay.status === TRAIN_STATUS.STOPPED_PAST_TARGET){
        row.cells[1].innerHTML = "VYSTOUPIT";
        row.cells[1].style.backgroundColor = "#861313";
        row.cells[1].onclick = function(){
            changeTransportType(0);
            gameState.updateCurrentPosition({statID: delay.station});
            renderCurrentSection();
        };
    }

    if (currentsection == 2){
        row = addRow({
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
            renderCurrentSection();
        };
        row.cells[1].onclick = function(){
            section2data = {"lineID": lineID, "tripID": tripID, "day": day, "hidesinfront": !hidesinfront};
            renderCurrentSection();
        }
        row.cells[2].style.backgroundColor = "green";
        row.cells[2].onclick = function(){
            let newtripid = tripID == line.trips-1 ? 0 : tripID+1;
            let newday = tripID == line.trips-1 ? day+1 : day;
            section2data = {"lineID": lineID, "tripID": newtripid, "day": newday, "hidesinfront": hidesinfront};
            renderCurrentSection();
        };
    }

    row = addRow({
        "table": table
    });
    row.className = "border";

    addRow({
        "table": table,
        "c1t": "Stanice",
        "c2t": "Příjezd",
        "c3t": "Odjezd",
        "c4t": "Vzdálenost",
        "includered": false});

    let starttime = line.starttime + day*SECONDS_PER_DAY + tripID*line.interval;

    let distacc = 0;
    let i = 0;
    let visibleStopIndex = 0;
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
            let stname = settings.getStationName(timetable.stations[stop.sid]);
            row = addRow({
                "table": table,
                "c1t": settings.getStationNameMarkup(timetable.stations[stop.sid]),
                "visibleoverflow": true
            });
            row.cells[0].onclick = function(){
                section1id = stop.sid;
                changeCurrentSection(1);
            }

            if (getoffbutton && currentsection === 0 && visibleStopIndex > 0) {
                const selected = isAutoExitSelection(stop.sid);
                if (selected) row.classList.add("auto-exit-selected-row");

                const actionCell = row.cells[3];
                actionCell.classList.add("auto-exit-cell");
                const button = document.createElement("button");
                button.className = selected
                    ? "auto-exit-btn selected"
                    : "auto-exit-btn";
                button.textContent = "🏁";
                button.title = selected
                    ? "Zrušit automatický výstup v této stanici"
                    : "Automaticky vystoupit v této stanici";
                button.setAttribute("aria-label", button.title);
                button.setAttribute("aria-pressed", String(selected));
                button.onclick = event => {
                    event.stopPropagation();
                    toggleAutoExitSelection(stop.sid);
                };
                actionCell.appendChild(button);
            }

            row.cells[0].style.textWrap = "nowrap";
            row = addRow({
                "table": table,
                "c2t": arrstr,
                "c3t": depstr,
                "c4t": String(Math.round(distacc))+"km",
                "scrollingfirstcol": stname.length>=12,
                "includered": false});
            if (stop.sid == delay.station){
                if (delay.status === TRAIN_STATUS.STOPPED_BEFORE_TARGET){
                    row.cells[1].classList.add("lime");
                }
                tocolor = false;
            }
            if (tocolor){
                row.cells[1].classList.add("lime");
                row.cells[2].classList.add("lime");
            }
            visibleStopIndex++;
        }
        i++;
    });
}

    return { toggle, print, updateTrackProgress: updateTrackProgress };
})();
