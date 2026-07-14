const walking = (() => {
function printOptions(stationID){
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
            gameState.updateCurrentPosition({goalStatID: iwd.id, time: getCurrentTimeInMs()});
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

function printProgress(table){
    let startstat = timetable.stations[gameState.getCurrentPosition().statID];
    let endstat = timetable.stations[gameState.getCurrentPosition().goalStatID];
    let dist = getDistance(gameState.getCurrentPosition().statID, gameState.getCurrentPosition().goalStatID);
    let mstime = dist*8*60*1000;
    let timeelapsed = getCurrentTimeInMs()-gameState.getCurrentPosition().time;
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
        gameState.updateCurrentPosition({statID: gameState.getCurrentPosition().goalStatID});
        printcurrentsection();
        return;
    }
    schedule.updateTrackProgress(2, timeelapsed/mstime, gameState.getCurrentPosition().goalStatID, gameState.getCurrentPosition().statID);
    _turnbtn.onclick = function(){
        const position = gameState.getCurrentPosition();
        const newTime = getCurrentTimeInMs()-timetogo;
        console.log(newTime);
        console.log(timetogo);
        gameState.updateCurrentPosition({time: newTime, statID: position.goalStatID, goalStatID: position.statID});
        printcurrentsection();
    }
    table.innerHTML = "";
}

function getDistance(fromID, toID){
    let dist = 0;
    timetable.stations[fromID].iwd.forEach(iw => {
        if (iw.id == toID){
            dist = iw.dist;
        }
    });
    return dist;
}

    return { printOptions, printProgress, getDistance };
})();
