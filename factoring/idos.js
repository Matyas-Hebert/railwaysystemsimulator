const idos = (() => {
    let locations = [69, 420];
    let departureTime = 0;

function findPath(startstationID, endstationID, time=-1){
    const currentDate = new Date();
    if (time == -1){
        time = currentDate.getHours()*3600 + currentDate.getMinutes()*60 + currentDate.getSeconds();
    }
    //time = 14*3600+40*60;
    const checkedstations = {};
    const uncheckedstations = {};
    const checkedlines = new Set();

    uncheckedstations[startstationID] = {"from": undefined, "line": null, "trip": null, "day": null, "time": {"time": time, "day": 0}};

    while(Object.keys(uncheckedstations).length > 0){
        let mintime = Infinity;
        let stationID = null;

        for (const id in uncheckedstations){
            let time = uncheckedstations[id].time.time + uncheckedstations[id].time.day*SECONDS_PER_DAY;
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
                let tripStartTime = line.starttime + data.trip * line.interval + data.time.day*SECONDS_PER_DAY;
                if (tripStartTime > data.time.time + data.time.day*SECONDS_PER_DAY){
                    tripStartTime -= SECONDS_PER_DAY;
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
                    fromName: settings.getStationName(timetable.stations[data.from]),
                    fromID: data.from,
                    toName: settings.getStationName(timetable.stations[currentId]),
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
            let p = "";
            path.forEach((step, index) => {
                p += `${index + 1}. ${step.train}: ${step.fromName.padEnd(30, " ")} [${String(step.fromID).padStart(4, '0')}] (${step.dep}) -> ${step.toName.padEnd(30, " ")} [${String(step.toID).padStart(4, '0')}] (${step.arr})` + "\n";
            });

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
                        const stop = lstop;
                        let tripo = getTripNumberByTime(line, stationID, mintime);
                        if (mintime > SECONDS_PER_DAY && tripo.day > 1){
                        }
                        day += tripo.day;
                        trip = tripo.trip;
                    }
                    else if (found){
                        let newarrtime = lstop.arr + trip*line.interval + line.starttime;
                        let tmpday = day;
                        if (newarrtime >= SECONDS_PER_DAY){
                            newarrtime -= SECONDS_PER_DAY;
                            tmpday++;
                        }
                        if (tmpday > 1){
                        }
                        if (!Object.keys(checkedstations).includes(String(lstop.sid))){
                            let foundinunchecked = Object.keys(uncheckedstations).includes(String(lstop.sid));
                            if (!foundinunchecked){
                                uncheckedstations[lstop.sid] = {"from": stationID, "line": lineID, "trip": trip, "time": {"time": newarrtime, "day": tmpday}};
                            }
                            else if (uncheckedstations[lstop.sid].time.time + uncheckedstations[lstop.sid].time.day*SECONDS_PER_DAY > newarrtime + tmpday*SECONDS_PER_DAY){
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

        //return;
    }
}

function print(){
    _idosstats.style.display = "none";
    if (!gameState.getCurrentPosition().iswifi){
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
        const currentDate = new Date();
        departureTime = currentDate.getHours()*3600 + currentDate.getMinutes()*60;
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
