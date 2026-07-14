const idos = (() => {
    let locations = [69, 420];
    let departureTime = 0;

function findPath(startstationID, endstationID, time=-1){
    const currentDate = new Date();
    if (time == -1){
        time = currentDate.getHours()*3600 + currentDate.getMinutes()*60 + currentDate.getSeconds();
    }
    //time = 14*3600+40*60;
    console.log("starttime", formatTime(time));
    const checkedstations = {};
    const uncheckedstations = {};
    const checkedlines = new Set();

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
                        const stop = lstop;
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

function print(){
    _idosstats.style.display = "none";
    if (!gameState.getCurrentPosition().iswifi){
        _idosresults.innerHTML = "Žádné připojení k Wi-Fi<br>Spojení nebylo možné nalézt!";
        _idosresults.className = "nowifiinfo";
        return;
    }
    _idosstats.style.display = "flex";
    let res = findPath(locations[0], locations[1], departureTime);
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

function switchLocations(){
    console.log("switching");
    let tmp = locations[0];
    locations[0] = locations[1];
    locations[1] = tmp;
    let tmpvalue = _idosstart.value;
    let tmphtml = _idosstart.innerHTML;
    _idosstart.value = _idosend.value;
    _idosstart.innerHTML = _idosend.innerHTML;
    _idosend.value = tmpvalue;
    _idosend.innerHTML = tmphtml;
    printcurrentsection();
}

function decreaseTime(){
    departureTime -= 60*30;
    updatedepartureTimeview();
}

function increaseTime(){
    departureTime += 60*30;
    updatedepartureTimeview();
}

function updateTime(){
    let parts = _departureTime.value.split(":");
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
    departureTime = hours*3600+minutes*60;
    updatedepartureTimeview();
}

function updateTimeView(){
    _departureTime.value = formatTime(departureTime, false, false);
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
