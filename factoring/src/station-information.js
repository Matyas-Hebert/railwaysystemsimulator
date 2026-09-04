import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as constants from "./constants.js";

    let stationId = null;

    function open(nextStationId) {
        stationId = Number(nextStationId);
        app.renderCurrentSection(true);
    }

    function close() {
        stationId = null;
        app.renderCurrentSection(true);
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
        if (runtime.getCurrentSection() === 1) return Number(runtime.getStationSectionId());
        const position = runtime.getGameState().getCurrentPosition();
        if (runtime.getCurrentSection() === 0 && position?.transporttype === constants.TRANSPORT_TYPE.STATION) {
            return Number(position.statID);
        }
        return null;
    }

    function printInfo(infoStationId) {
        const content = document.querySelector(
            "#_stationinformation .station-information-content"
        );
        content.replaceChildren();

        const paragraph = document.createElement("p");
        paragraph.textContent = "Stanice byla postavena "
            + runtime.getGameState().getDateOfCreation(infoStationId);
        content.appendChild(paragraph);
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
        if (isOpen) {
            printInfo(stationId);
        }
        runtime.getFilters().hidden = isOpen;
        timetableElement.hidden = isOpen;
        if (runtime.getCurrentSection() === 1) {
            stationControls.style.display = isOpen ? "none" : "block";
        }
    }

    export {
    addButton,
    printInfo,
    render
};
