import * as playerLocation from "./player-location.js";
import * as schedule from "./schedule.js";
import * as settings from "./settings.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as constants from "./constants.js";
import * as clock from "./clock.js";
import * as energy from "./energy.js"

function getTimeString(minutes){
    if (minutes < 59.5){
        return String(Math.round(minutes)) + " min";
    }
    let hours = Math.floor(minutes/60);
    minutes -= hours*60;
    return String(hours) + " hod " + String(Math.floor(minutes)) + " min";
}

function getClosestStationIds(coords, limit = 5) {
    return data.timetable.stations
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
    const position = runtime.getGameState().getCurrentPosition();
    const isField = position.transporttype === constants.TRANSPORT_TYPE.FIELD;
    const startCoords = isField ? position.coords : data.timetable.stations[stationID];

    let div = document.createElement("div");
    settings.setStationName(
        div,
        isField ? data.timetable.stations[position.iwd[0]] : data.timetable.stations[stationID],
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
        : [...data.timetable.stations[stationID].iwd];
    const openedStationId = Number(runtime.getStationSectionId());
    if (data.timetable.stations[openedStationId]
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
        settings.setStationName(name, data.timetable.stations[walkableStationId]);

        let time = document.createElement("div");
        const distance = getDistance(
            startCoords,
            data.timetable.stations[walkableStationId]
        );
        time.innerText = getTimeString(distance/getSpeedFromTransportType(constants.TRANSPORT_TYPE.WALKING) * 60);

        let go = document.createElement("div");
        go.innerText = "JÍT";
        go.className = "selected";

        go.onclick = function() {
            energy.updateEnergy();
            if (runtime.getGameState().getEnergy() <= 0.1){
                return;
            }
            const goalStation = data.timetable.stations[walkableStationId];
            runtime.getGameState().updateCurrentPosition({
                transporttype: constants.TRANSPORT_TYPE.WALKING,
                coords: { lat: startCoords.lat, lon: startCoords.lon },
                statID: isField ? null : Number(stationID),
                goalCoords: { lat: goalStation.lat, lon: goalStation.lon },
                goalStatID: walkableStationId,
                time: app.getCurrentTimeInMilliseconds()
            });
            runtime.getGameState().setEnergySnapshotObject(
                getEnergySnapshot(constants.TRANSPORT_TYPE.WALKING, startCoords, walkableStationId, { lat: goalStation.lat, lon: goalStation.lon }));
            app.changeCurrentSection(0);
        }


        name.onclick = function(){
            runtime.setStationSectionId(walkableStationId);
            app.changeCurrentSection(1);
        }
        options.appendChild(name);
        options.appendChild(time);
        options.appendChild(go);

        options.style.padding = "0.5rem";
        _walkables.appendChild(options);
        i++;
    });
}

export function getSpeedFromTransportType(transporttype){
    return constants.SPEEDS[transporttype];
}

export function getConsumptionFromTransportType(transporttype){
    return constants.CONSUMPTION[transporttype];
}

function getEnergySnapshot(transporttype, startCoords, goalStatId, goalCoords){
    let gs = runtime.getGameState();
    return {
        lastEnergy: runtime.getGameState().getEnergy(),
        energyRate: -getConsumptionFromTransportType(transporttype),
        savedAt: clock.getCurrentTimeInMilliseconds(),
        positionAtIdleStart: getPositionAtIdleStart( gs.getEnergy(), 
                            transporttype,
                            startCoords,
                            goalStatId,
                            goalCoords
                        ),
        idleStartTime: getIdleStartTime(gs.getEnergy(), 
                            transporttype,
                            startCoords,
                            goalCoords
                        )
    }
}

function getPositionAtIdleStart(energy, transportype, startCoords, endStat, endCoords){
    let speedkmh = getSpeedFromTransportType(transportype);
    let ratekjs = getConsumptionFromTransportType(transportype);
    let distkm = getDistance(startCoords, endCoords);
    let times = (distkm/speedkmh)*3600;
    let totalConsumption = times*ratekjs;
    if (totalConsumption <= energy){
        return {"statID": endStat, "coords": endCoords, "transporttype": constants.TRANSPORT_TYPE.STATION,
            "goalCoords": null, "goalStatID": null
        };
    }
    let percTraversed = energy/totalConsumption;
    return {"stat": null, "coords": playerLocation.interpolateCoords(startCoords, endCoords, percTraversed),
         "transporttype": constants.TRANSPORT_TYPE.FIELD, "goalCoords": null, "goalStatID": null
    };
}

function getIdleStartTime(energy, transportype, startCoords, endCoords){
    let speedkmh = getSpeedFromTransportType(transportype);
    let ratekjs = getConsumptionFromTransportType(transportype);
    let distkm = getDistance(startCoords, endCoords);
    let times = (distkm/speedkmh)*3600;
    let totalConsumption = times*ratekjs;
    let percTraversed = energy/totalConsumption;
    console.log("pt", percTraversed, energy, totalConsumption);
    if (percTraversed >= 1){
        return clock.getCurrentTimeInMilliseconds() + times*1000;
    }
    return clock.getCurrentTimeInMilliseconds() + times*1000*percTraversed;
}

function getTimeFromDistAndSpeedMs(distKm, speedKmH){
    return (distKm/speedKmH)*3600*1000;
}

function switchMovementType(newTransportType) {
    const gameState = runtime.getGameState();

    energy.updateEnergy();

    const position = gameState.getCurrentPosition();
    const currentCoords = playerLocation.getWalkingCoords(position);
    const currentTime = app.getCurrentTimeInMilliseconds();

    gameState.updateCurrentPosition({
        transporttype: newTransportType,
        coords: currentCoords,
        statID: null,
        time: currentTime
    });

    gameState.setEnergySnapshotObject(
        getEnergySnapshot(
            newTransportType,
            currentCoords,
            position.goalStatID,
            position.goalCoords
        )
    );

    app.renderCurrentSection();
}

function printProgress(table){
    let gs = runtime.getGameState();
    const position = gs.getCurrentPosition();
    _traintimetableheader.innerHTML = "";
    _trainbuffoptions.style.display = "none";
    table.innerHTML = "";
    let dist = getDistance(position.coords, position.goalCoords);
    let mstime = getTimeFromDistAndSpeedMs(dist, getSpeedFromTransportType(position.transporttype));
    let timeelapsed = app.getCurrentTimeInMilliseconds()-gs.getCurrentPosition().time;
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
        energy.updateEnergy();
        const position = runtime.getGameState().getCurrentPosition();
        const newTime = app.getCurrentTimeInMilliseconds()-timetogo;
        const newStartStationId = position.goalStatID;
        runtime.getGameState().updateCurrentPosition({
            time: newTime,
            coords: position.goalCoords,
            statID: newStartStationId,
            goalCoords: position.coords,
            goalStatID: position.statID
        });
        runtime.getGameState().setEnergySnapshotObject(getEnergySnapshot(constants.TRANSPORT_TYPE.WALKING,
            position.goalCoords,
            position.statID,
            position.coords
        ));
        app.renderCurrentSection();
    }
    table.innerHTML = "";
    _walkOption.className = "movement-option";
    _runOption.className = "movement-option";
    _sprintOption.className = "movement-option";
    if (position.transporttype == constants.TRANSPORT_TYPE.WALKING){
        _walkOption.classList.add("selected");
    }
    if (position.transporttype == constants.TRANSPORT_TYPE.RUNNING){
        _runOption.classList.add("selected");
    }
    if (position.transporttype == constants.TRANSPORT_TYPE.SPRINTING){
        _sprintOption.classList.add("selected");
    }
    _walkOption.onclick = function(){
        switchMovementType(constants.TRANSPORT_TYPE.WALKING);
    }
    _runOption.onclick = function(){
        switchMovementType(constants.TRANSPORT_TYPE.RUNNING);
    }
    _sprintOption.onclick = function(){
        switchMovementType(constants.TRANSPORT_TYPE.SPRINTING);
    }
    _stopbtn.onclick = function(){
        const currentCoords = playerLocation.getCurrentPlayerCoords();
        runtime.getGameState().updateCurrentPosition({
            transporttype: constants.TRANSPORT_TYPE.FIELD,
            coords: currentCoords,
            statID: null,
            goalCoords: null,
            goalStatID: null,
            time: app.getCurrentTimeInMilliseconds()
        });
        app.changeCurrentSection(5);
        runtime.getGameState().setEnergySnapshot(
            null,
            constants.ENERGY_RESTORATION_IDLE,
            runtime.getGameState().getEnergy(),
            null,
            clock.getCurrentTimeInMilliseconds()
        );
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

    export {
    printOptions,
    printProgress,
    getDistance,
    getClosestStationIds
};
