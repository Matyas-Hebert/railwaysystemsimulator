const settings = (() => {
    function render() {
        const developerButton = document.querySelector("#_developer");
        const autoUpdateRow = document.querySelector("#_autoupdaterow");
        const autoUpdateButton = document.querySelector("#_autoupdate");
        const teleportRow = document.querySelector("#_teleportrow");
        const teleportInput = document.querySelector("#_teleportid");
        const teleportButton = document.querySelector("#_teleportbtn");
        const moneyRow = document.querySelector("#_moneyrow");
        const moneyInput = document.querySelector("#_moneyamount");
        const moneyButton = document.querySelector("#_moneybtn");
        const moneyDisplay = document.querySelector("#_money");
        const developerEnabled = gameState.getSettings().developer === true;

        developerButton.innerText = developerEnabled ? "ZAPNUTO" : "VYPNUTO";
        developerButton.className = developerEnabled ? "on" : "off";
        autoUpdateRow.style.display = developerEnabled ? "flex" : "none";
        autoUpdateButton.innerText = gameState.getSettings().autoUpdatesPaused === true ? "OBNOVIT" : "ZASTAVIT";
        autoUpdateButton.className = gameState.getSettings().autoUpdatesPaused === true ? "off" : "on";
        teleportRow.style.display = developerEnabled ? "flex" : "none";
        teleportInput.disabled = !developerEnabled;
        teleportButton.disabled = !developerEnabled;
        moneyRow.style.display = developerEnabled ? "flex" : "none";
        moneyInput.disabled = !developerEnabled;
        moneyButton.disabled = !developerEnabled;
        moneyDisplay.innerText = String(Math.floor(gameState.getMoney())) + ",-";
    }

    function toggleDeveloper() {
        const developerEnabled = gameState.getSettings().developer === true;
        gameState.updateSettings({
            developer: !developerEnabled,
            autoUpdatesPaused: developerEnabled ? false : gameState.getSettings().autoUpdatesPaused === true
        });
        render();
        renderCurrentSection();
    }

    function toggleAutoUpdates() {
        if (gameState.getSettings().developer !== true) return;
        const paused = gameState.getSettings().autoUpdatesPaused === true;
        gameState.updateSettings({ autoUpdatesPaused: !paused });
        render();
    }

    function areAutoUpdatesPaused() {
        return gameState.getSettings().autoUpdatesPaused === true;
    }

    function resetGame() {
        gameState.setMoney(0);
        gameState.setSettings({ developer: false, autoUpdatesPaused: false });
        gameState.setPinnedStations([]);
        gameState.setVisitedLines([]);
        gameState.setCollectedDelayReasons([]);
        foodora.reset();
        stationVisits.reset();
        gameState.setCurrentPosition(null);
        currentsection = 0;
        section1id = 200;
        startid = -1;
        render();
        renderCurrentSection();
    }

    function addDeveloperMoney() {
        if (gameState.getSettings().developer !== true) return;
        const input = document.querySelector("#_moneyamount");
        const amount = parseInt(input.value, 10);
        if (Number.isNaN(amount)) return;
        gameState.setMoney(gameState.getMoney() + amount);
        input.value = "";
        render();
    }

    function teleportToStation() {
        if (gameState.getSettings().developer !== true) return;
        const input = document.querySelector("#_teleportid");
        const stationId = parseInt(input.value, 10);
        if (Number.isNaN(stationId) || !timetable.stations[stationId]) return;

        gameState.setCurrentPosition({
            transporttype: TRANSPORT_TYPE.STATION,
            statID: stationId,
            goalStatID: stationId,
            time: getCurrentTimeInMilliseconds()
        });
        currentsection = 0;
        section1id = stationId;
        input.value = "";
        renderCurrentSection();
    }

    function getStationName(station) {
        return gameState.getSettings().developer === true
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
        element.textContent = prefix + getStationName(station) + suffix;
        element.classList.add("station-name");
        element.classList.toggle("station-name-visited", visited);
        element.classList.toggle("station-name-unvisited", !visited);
    }

    return {
        render,
        toggleDeveloper,
        toggleAutoUpdates,
        areAutoUpdatesPaused,
        resetGame,
        addDeveloperMoney,
        teleportToStation,
        getStationName,
        getStationNameMarkup,
        setStationName
    };
})();
