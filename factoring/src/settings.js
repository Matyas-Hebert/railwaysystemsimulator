import * as foodora from "./foodora.js";
import * as stationVisits from "./station-visits.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as config from "../generated/config.js";
import * as constants from "./constants.js";
import * as ta from "./timetable-analysis.js"

    const APP_VERSION = "1.4.0.1";

    function renderMoney() {
        const moneyDisplay = document.querySelector("#_money");
        if (moneyDisplay === null) return;
        let amount = Math.floor(runtime.getGameState().getMoney());
        if (amount > 10000){
            amount = Math.floor(amount/1000)+"K";
        }
        else if (amount > 1000){
            amount = Math.floor(amount/100)/10+"K";
        }
        moneyDisplay.innerText = amount + ",-";
    }

    function renderEnergy() {
        const energyDisplay = document.querySelector("#_energy");
        if (energyDisplay === null) return;
        let current = runtime.getGameState().getEnergy();
        let max = runtime.getGameState().getMaxEnergy();
        energyDisplay.innerText = "⚡"+Math.floor((current*100)/max)+"%";
    }

    function render() {
        const developerButton = document.querySelector("#_developer");
        const autoUpdateRow = document.querySelector("#_autoupdaterow");
        const autoUpdateButton = document.querySelector("#_autoupdate");
        const teleportRow = document.querySelector("#_teleportrow");
        const teleportInput = document.querySelector("#_teleportid");
        const teleportButton = document.querySelector("#_teleportbtn");
        const timeTravelRow = document.querySelector("#_timetravelrow");
        const moneyRow = document.querySelector("#_moneyrow");
        const moneyInput = document.querySelector("#_moneyamount");
        const moneyButton = document.querySelector("#_moneybtn");
        const versionDisplay = document.querySelector("#_appversion");
        const developerEnabled = runtime.getGameState().getSettings().developer === true;

        developerButton.innerText = developerEnabled ? "ZAPNUTO" : "VYPNUTO";
        developerButton.className = developerEnabled ? "on" : "off";
        autoUpdateRow.style.display = developerEnabled ? "flex" : "none";
        autoUpdateButton.innerText = runtime.getGameState().getSettings().autoUpdatesPaused === true ? "OBNOVIT" : "ZASTAVIT";
        autoUpdateButton.className = runtime.getGameState().getSettings().autoUpdatesPaused === true ? "off" : "on";
        teleportRow.style.display = developerEnabled ? "flex" : "none";
        teleportInput.disabled = !developerEnabled;
        timeTravelRow.style.display = developerEnabled ? "flex" : "none";
        teleportButton.disabled = !developerEnabled;
        moneyRow.style.display = developerEnabled ? "flex" : "none";
        moneyInput.disabled = !developerEnabled;
        moneyButton.disabled = !developerEnabled;
        renderMoney();
        renderEnergy();
        versionDisplay.innerText = "Verze " + APP_VERSION;
    }

    function toggleDeveloper() {
        const developerEnabled = runtime.getGameState().getSettings().developer === true;
        runtime.getGameState().updateSettings({
            developer: !developerEnabled,
            autoUpdatesPaused: developerEnabled ? false : runtime.getGameState().getSettings().autoUpdatesPaused === true
        });
        render();
        app.renderCurrentSection();
    }

    function toggleAutoUpdates() {
        if (runtime.getGameState().getSettings().developer !== true) return;
        const paused = runtime.getGameState().getSettings().autoUpdatesPaused === true;
        runtime.getGameState().updateSettings({ autoUpdatesPaused: !paused });
        render();
    }

    function areAutoUpdatesPaused() {
        return runtime.getGameState().getSettings().autoUpdatesPaused === true;
    }

    function resetGame() {
        runtime.getGameState().setMoney(0);
        runtime.getGameState().setTimeState(0, 1);
        runtime.getGameState().setSettings({ developer: false, autoUpdatesPaused: false });
        runtime.getGameState().setSelectedOperator(0);
        runtime.getGameState().setUsesRemaining(config.dataOperators.map(() => 0));
        runtime.getGameState().setPinnedStations([]);
        runtime.getGameState().setVisitedLines([]);
        runtime.getGameState().setCollectedDelayReasons([]);
        runtime.getGameState().setAutoBoardSelection(null);
        runtime.getGameState().setAutoExitStationId(null);
        runtime.getGameState().setEnergy(5000);
        runtime.getGameState().setMaxEnergy(5000);
        runtime.getGameState().setEnergySnapshot(null, constants.ENERGY_RESTORATION_IDLE, 5000, null, app.getCurrentTimeInMilliseconds());
        foodora.reset();
        stationVisits.reset();
        runtime.getGameState().setCurrentPosition(null);
        runtime.setCurrentSection(0);
        runtime.setStationSectionId(200);
        runtime.setStartStationId(-1);
        render();
        app.renderCurrentSection();
    }

    function addDeveloperMoney() {
        if (runtime.getGameState().getSettings().developer !== true) return;
        const input = document.querySelector("#_moneyamount");
        const amount = parseInt(input.value, 10);
        if (Number.isNaN(amount)) return;
        runtime.getGameState().setMoney(runtime.getGameState().getMoney() + amount);
        input.value = "";
    }

    function teleportToStation() {
        if (runtime.getGameState().getSettings().developer !== true) return;
        const input = document.querySelector("#_teleportid");
        const stationId = parseInt(input.value, 10);
        if (Number.isNaN(stationId) || !data.timetable.stations[stationId]) return;

        runtime.getGameState().setCurrentPosition({
            transporttype: constants.TRANSPORT_TYPE.STATION,
            statID: stationId,
            goalStatID: stationId,
            time: app.getCurrentTimeInMilliseconds()
        });
        runtime.setCurrentSection(0);
        runtime.setStationSectionId(stationId);
        input.value = "";
        app.renderCurrentSection();
    }

    function timeTravel(){
        if (runtime.getGameState().getSettings().developer !== true) return;
        const input = document.querySelector("#_timetravelduration");
        const seconds = parseInt(input.value, 10);
        if (Number.isNaN(seconds)) return;

        runtime.getGameState().timeTravel(seconds);
        ta.updateClock();
    }

    function getStationName(station) {
        return runtime.getGameState().getSettings().developer === true
            ? station.name + " (" + String(station.id) + ")"
            : station.name;
    }

    function getStationNameMarkup(station) {
        const element = document.createElement("span");
        element.className = stationVisits.isVisited(station.id)
            ? "station-name station-name-visited"
            : "station-name station-name-unvisited";
        element.textContent = getStationName(station);
        return element.outerHTML;
    }

    function setStationName(element, station, prefix = "", suffix = "") {
        const visited = stationVisits.isVisited(station.id);
        element.innerHTML = "";

        const prefixElement = document.createElement("span");
        prefixElement.className = "station-name-prefix";
        prefixElement.textContent = prefix;
        element.appendChild(prefixElement);

        const stationNameElement = document.createElement("span");
        stationNameElement.classList.add("station-name-value");
        stationNameElement.textContent = getStationName(station) + suffix;
        stationNameElement.classList.add("station-name");
        stationNameElement.classList.toggle("station-name-visited", visited);
        stationNameElement.classList.toggle("station-name-unvisited", !visited);
        element.appendChild(stationNameElement);
    }

    export {
    render,
    renderMoney,
    renderEnergy,
    toggleDeveloper,
    toggleAutoUpdates,
    areAutoUpdatesPaused,
    resetGame,
    addDeveloperMoney,
    teleportToStation,
    getStationName,
    getStationNameMarkup,
    setStationName,
    timeTravel
};
