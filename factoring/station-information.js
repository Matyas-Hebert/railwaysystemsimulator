const stationInformation = (() => {
    let stationId = null;

    function open(nextStationId) {
        stationId = Number(nextStationId);
        renderCurrentSection(true);
    }

    function close() {
        stationId = null;
        renderCurrentSection(true);
    }

    function toggle(nextStationId) {
        const normalizedStationId = Number(nextStationId);
        if (stationId === normalizedStationId) {
            close();
        }
        else {
            open(normalizedStationId);
        }
    }

    function addButton(header, headerStationId) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "station-information-button";
        button.textContent = "(i)";
        button.setAttribute("aria-label", "Station information");
        button.onclick = event => {
            event.stopPropagation();
            toggle(headerStationId);
        };
        header.appendChild(button);
    }

    function getDisplayedStationId() {
        if (currentsection === 1) return Number(section1id);
        const position = gameState.getCurrentPosition();
        if (currentsection === 0 && position?.transporttype === TRANSPORT_TYPE.STATION) {
            return Number(position.statID);
        }
        return null;
    }

    function render() {
        const displayedStationId = getDisplayedStationId();
        if (stationId !== null && stationId !== displayedStationId) {
            stationId = null;
        }

        const isOpen = stationId !== null;
        const panel = document.querySelector("#_stationinformation");
        const filters = document.querySelector("#_section0 .filters");
        const timetableElement = document.querySelector("#_timetable");
        const stationControls = document.querySelector("#_section1");

        panel.hidden = !isOpen;
        filters.hidden = isOpen;
        timetableElement.hidden = isOpen;
        if (currentsection === 1) {
            stationControls.style.display = isOpen ? "none" : "block";
        }
    }

    return { addButton, render };
})();