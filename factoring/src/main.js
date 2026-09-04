import * as runtime from "./runtime.js";
import * as gameStateModule from "./game-state.js";
import * as app from "./timetable-analysis.js";
import * as connection from "./connection.js";
import * as foodora from "./foodora.js";
import * as idos from "./idos.js";
import * as settings from "./settings.js";
import * as stationSearch from "./search.js";
import * as data from "../generated/timetable.js";
import * as lonlat from "../generated/lonlat.js";
import * as config from "../generated/config.js";

runtime.initializeGameState(new gameStateModule.GameState(
    data.timetable.stations,
    lonlat.lonLatToId,
    data.timetable.lines,
    config.dataOperators.length
));

runtime.getFilters().types = config.lineTypes.map(() => true);
runtime.getGameState().setPositionChangeHandler(() => {
    runtime.setCurrentSection(0);
});
runtime.getGameState().setConnectionStateChangeHandler(() => {
    connection.refresh();
});

function element(id) {
    const value = document.getElementById(id);
    if (value === null) throw new Error(`Missing required element #${id}`);
    return value;
}

function bindEvents() {
    const startInput = element("_startstart");
    const startOptions = element("_startoptions");
    startInput.addEventListener("click", () =>
        stationSearch.show(startInput.value, startOptions, false, 0, startInput, true, true));
    startInput.addEventListener("input", () =>
        stationSearch.show(startInput.value, startOptions, false, 0, startInput, false, true));
    element("_startsearch").addEventListener("click", app.startGame);
    element("_wifi").addEventListener("click", connection.handleIconClick);

    [[0,"_tab0"],[5,"_tab5"],[1,"_tab1"],[10,"_tab10"],[2,"_tab2"],[3,"_tab3"],
     [4,"_tab4"],[6,"_tab6"],[7,"_tab7"],[8,"_tab8"],[9,"_tab9"]]
        .forEach(([section,id]) => element(id).addEventListener("click", () => app.selectSection(section)));

    element("_developer").addEventListener("click", settings.toggleDeveloper);
    element("_newgame").addEventListener("click", settings.resetGame);
    element("_autoupdate").addEventListener("click", settings.toggleAutoUpdates);
    element("_teleportbtn").addEventListener("click", settings.teleportToStation);
    element("_moneybtn").addEventListener("click", settings.addDeveloperMoney);
    element("_timetravelbtn").addEventListener("click", settings.timeTravel);
    element("_pinnedlisttoggle").addEventListener("click", app.togglePinnedList);

    const stationInput = element("_searchstation");
    const stationOptions = element("_s1options");
    stationInput.addEventListener("click", () =>
        stationSearch.show(stationInput.value, stationOptions, false, 0, stationInput, true));
    stationInput.addEventListener("input", () =>
        stationSearch.show(stationInput.value, stationOptions, false, 0, stationInput, false));
    element("_s1optionsclose").addEventListener("click", stationSearch.closeStationOptions);
    element("_arrivals").addEventListener("click", () => app.selectFilter("arrivals"));
    element("_departures").addEventListener("click", () => app.selectFilter("departures"));
    element("_destinations").addEventListener("change", event => app.selectDestination(event.target.value));

    element("_section4").querySelector(".idossearchh").addEventListener("click", idos.switchLocations);
    const idosOptions = element("_section4options");
    const idosStart = element("_idosstart");
    const idosEnd = element("_idosend");
    idosStart.addEventListener("click", () =>
        stationSearch.show(idosStart.value, idosOptions, true, 0, idosStart, true));
    idosStart.addEventListener("input", () =>
        stationSearch.show(idosStart.value, idosOptions, true, 0, idosStart));
    idosEnd.addEventListener("click", () =>
        stationSearch.show(idosEnd.value, idosOptions, true, 1, idosEnd, true));
    idosEnd.addEventListener("input", () =>
        stationSearch.show(idosEnd.value, idosOptions, true, 1, idosEnd));
    const timeControls = element("_idostime").parentElement.querySelectorAll("div");
    timeControls[0].addEventListener("click", idos.decreaseTime);
    element("_idostime").addEventListener("input", idos.updateTime);
    timeControls[1].addEventListener("click", idos.increaseTime);
    element("_idosairroutes").addEventListener("change", event => idos.setIncludeAirRoutes(event.target.checked));
    element("_section4").querySelector(".idossearchs").addEventListener("click", idos.print);
}

bindEvents();
foodora.initialize();
settings.render();
app.renderCurrentSection();
setInterval(app.updateClock, 1000);
setInterval(() => {
    if (!settings.areAutoUpdatesPaused()) app.renderCurrentSection();
}, 5000);

// Expose modules to the browser DevTools console
window.runtime = runtime;
window.gameStateModule = gameStateModule;
window.app = app;