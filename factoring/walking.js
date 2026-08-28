const walking = (() => {
function getTimeString(minutes){
    if (minutes < 59.5){
        return String(Math.round(minutes)) + " min";
    }
    let hours = Math.floor(minutes/60);
    minutes -= hours*60;
    return String(hours) + " hod " + String(Math.floor(minutes)) + " min";
}

function getClosestStationIds(coords, limit = 5) {
    return timetable.stations
        .map(station => ({
            stationId: station.id,
            distance: getDistance(coords, station)
        }))
        .sort((first, second) =>
            first.distance - second.distance
            || first.stationId - second.stationId
        )
        .slice(0, limit)
        .map(result => result.stationId);
}

function printOptions(stationID){
    _walkables.innerHTML = "";
    const position = gameState.getCurrentPosition();
    const isField = position.transporttype === TRANSPORT_TYPE.FIELD;
    const startCoords = isField ? position.coords : timetable.stations[stationID];

    let div = document.createElement("div");
    settings.setStationName(
        div,
        isField ? timetable.stations[position.iwd[0]] : timetable.stations[stationID],
        isField ? "Pole u stanice " : ""
    );
    div.classList = "whiteheader";
    _walkables.appendChild(div);
    if (stationID == -1){
        let d = document.createElement("div");
        d.innerText = "Jsi ve vlaku, nikam nejdeš!"
        d.classList = "reddishinfo";
        _walkables.appendChild(d);
        return;
    }
    const walkableStationIds = isField
        ? [...position.iwd]
        : [...timetable.stations[stationID].iwd];
    const openedStationId = Number(section1id);
    if (timetable.stations[openedStationId]
        && openedStationId !== Number(stationID)
        && !walkableStationIds.includes(openedStationId)) {
        walkableStationIds.push(openedStationId);
    }
    if (walkableStationIds.length == 0){
        let d = document.createElement("div");
        d.innerText = "Nikam odtud nelze dojít"
        d.classList = "reddishinfo";
        _walkables.appendChild(d);
        return;
    }
    let i = 0;
    walkableStationIds.forEach(walkableStationId => {
        let options = document.createElement("div");
        options.classList = "whiteheader";
        if (i%2 == 0){
            options.classList.add("whiteheaderlightbg");
        }

        let name = document.createElement("div");
        settings.setStationName(name, timetable.stations[walkableStationId]);

        let time = document.createElement("div");
        const distance = getDistance(
            startCoords,
            timetable.stations[walkableStationId]
        );
        time.innerText = getTimeString(distance*8);

        let go = document.createElement("div");
        go.innerText = "JÍT";
        go.className = "selected";

        go.onclick = function() {
            const goalStation = timetable.stations[walkableStationId];
            gameState.updateCurrentPosition({
                transporttype: TRANSPORT_TYPE.WALKING,
                coords: { lat: startCoords.lat, lon: startCoords.lon },
                statID: isField ? null : Number(stationID),
                goalCoords: { lat: goalStation.lat, lon: goalStation.lon },
                goalStatID: walkableStationId,
                time: getCurrentTimeInMilliseconds()
            });
            changeCurrentSection(0);
        }
        name.onclick = function(){
            section1id = walkableStationId;
            changeCurrentSection(1);
        }
        options.appendChild(name);
        options.appendChild(time);
        options.appendChild(go);

        options.style.padding = "0.5rem";
        _walkables.appendChild(options);
        i++;
    });
}

function printProgress(table){
    const position = gameState.getCurrentPosition();
    _traintimetableheader.innerHTML = "";
    table.innerHTML = "";
    let dist = getDistance(position.coords, position.goalCoords);
    let mstime = dist*8*60*1000;
    let timeelapsed = getCurrentTimeInMilliseconds()-gameState.getCurrentPosition().time;
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
        gameState.updateCurrentPosition({
            transporttype: TRANSPORT_TYPE.STATION,
            coords: position.goalCoords,
            statID: position.goalStatID,
            goalCoords: null,
            goalStatID: null
        });
        renderCurrentSection();
        return;
    }
    const displayedStartStationId = position.statID ?? position.iwd[0];
    const displayedGoalStationId = position.goalStatID
        ?? getClosestStationIds(position.goalCoords, 1)[0];
    schedule.updateTrackProgress(
        2,
        timeelapsed/mstime,
        displayedGoalStationId,
        displayedStartStationId,
        position.goalStatID === null ? "Pole u stanice " : "Stanice",
        position.statID === null ? "Pole u stanice " : "Stanice"
    );
    _turnbtn.onclick = function(){
        const position = gameState.getCurrentPosition();
        const newTime = getCurrentTimeInMilliseconds()-timetogo;
        const newStartStationId = position.goalStatID;
        const newIwd = newStartStationId === null
            ? getClosestStationIds(position.goalCoords)
            : [...timetable.stations[newStartStationId].iwd];
        gameState.updateCurrentPosition({
            time: newTime,
            coords: position.goalCoords,
            statID: newStartStationId,
            iwd: newIwd,
            goalCoords: position.coords,
            goalStatID: position.statID
        });
        renderCurrentSection();
    }
    table.innerHTML = "";
    _stopbtn.onclick = function(){
        const currentCoords = playerLocation.getCurrentPlayerCoords();
        gameState.updateCurrentPosition({
            transporttype: TRANSPORT_TYPE.FIELD,
            coords: currentCoords,
            statID: null,
            goalCoords: null,
            goalStatID: null,
            time: getCurrentTimeInMilliseconds()
        });
        changeCurrentSection(5);
    }
}

function getDistance(fromCoords, toCoords){
    const earthRadius = 6371;
    const latitudeDifference = (toCoords.lat - fromCoords.lat) * Math.PI / 180;
    const longitudeDifference = (toCoords.lon - fromCoords.lon) * Math.PI / 180;
    const value = Math.sin(latitudeDifference / 2) ** 2
        + Math.cos(fromCoords.lat * Math.PI / 180)
        * Math.cos(toCoords.lat * Math.PI / 180)
        * Math.sin(longitudeDifference / 2) ** 2;

    return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

    return { printOptions, printProgress, getDistance, getClosestStationIds };
})();
