import * as delays from "./delays.js";
import * as lineVisits from "./line-visits.js";
import * as settings from "./settings.js";
import * as stationVisits from "./station-visits.js";
import * as tripRoutes from "./trip-routes.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as config from "../generated/config.js";
import * as constants from "./constants.js";

    const state = {
        activeCategory: "stations",
        selectedDistrict: null,
        selectedCountry: null,
        districtSort: "alphabetical",
        selectedCompany: null,
        selectedTrainType: null,
        lineFilter: "all",
        stationFilter: "all",
        selectedDelayType: null,
        selectedDelayReason: null,
        delayFilter: "all"
    };

    const COUNTRY_NAMES = Object.freeze({
        CZ: "Česko",
        SK: "Slovensko",
        AT: "Rakousko",
        DE: "Německo",
        PL: "Polsko",
        HU: "Maďarsko",
        UA: "Ukrajina"
    });

    function getCountryName(country) {
        return COUNTRY_NAMES[country] ?? country;
    }

    const TRAIN_TYPE_NAMES = Object.freeze(config.lineTypes.map(type => type.code));
    const DELAY_TYPE_NAMES = Object.freeze(["Běžné", "Vtipné", "Závažné", "Letecké", "Lodní"]);
    const stationsByCountry = new Map();
    const stationsByCountryAndDistrict = new Map();
    const linesByCompany = new Map();
    const linesByCompanyAndType = new Map();

    data.timetable.stations.forEach(station => {
        if (!station?.country) return;
        if (!stationsByCountry.has(station.country)) {
            stationsByCountry.set(station.country, []);
            stationsByCountryAndDistrict.set(station.country, new Map());
        }
        stationsByCountry.get(station.country).push(station);
        const districts = stationsByCountryAndDistrict.get(station.country);
        if (!station.district) return;
        if (!districts.has(station.district)) districts.set(station.district, []);
        districts.get(station.district).push(station);
    });
    stationsByCountry.forEach(stations => {
        stations.sort((a, b) => a.name.localeCompare(b.name, "cs"));
    });
    stationsByCountryAndDistrict.forEach(districts => {
        districts.forEach(stations => {
            stations.sort((a, b) => a.name.localeCompare(b.name, "cs"));
        });
    });

    data.timetable.lines.forEach(line => {
        if (!line?.company) return;
        if (!linesByCompany.has(line.company)) {
            linesByCompany.set(line.company, []);
            linesByCompanyAndType.set(line.company, new Map());
        }
        linesByCompany.get(line.company).push(line);
        const typeGroups = linesByCompanyAndType.get(line.company);
        if (!typeGroups.has(line.type)) typeGroups.set(line.type, []);
        typeGroups.get(line.type).push(line);
    });
    linesByCompanyAndType.forEach(typeGroups => {
        typeGroups.forEach(lines => {
            lines.sort((a, b) => String(a.number).localeCompare(String(b.number), "cs", {
                numeric: true,
                sensitivity: "base"
            }));
        });
    });

    function selectCompany(company) {
        state.selectedCompany = company;
        state.selectedTrainType = null;
        state.lineFilter = "all";
        render();
    }

    function selectTrainType(type) {
        state.selectedTrainType = type;
        state.lineFilter = "all";
        render();
    }

    function getLinesForCompany(company) {
        return linesByCompany.get(company) ?? [];
    }

    function getLinesForCompanyAndType(company, type) {
        return linesByCompanyAndType.get(company)?.get(type) ?? [];
    }

    function setLineProgress(button, lines, visitedCount) {
        const percentage = lines.length === 0 ? 0 : visitedCount / lines.length * 100;
        button.style.setProperty("--visited-percentage", String(percentage) + "%");
    }

    function createBackButton(label, onClick) {
        const button = document.createElement("button");
        button.className = "collection-back-btn";
        button.textContent = label;
        button.onclick = onClick;
        return button;
    }

    function renderCompanyList(content) {
        const companies = [...linesByCompany.keys()]
            .sort((a, b) => a.localeCompare(b, "cs"));

        companies.forEach(company => {
            const button = document.createElement("button");
            const lines = getLinesForCompany(company);
            button.className = "collection-company-btn collection-line-progress-btn";
            const visitedCount = runtime.getGameState().getVisitedLineCountForCompany(company);
            setLineProgress(button, lines, visitedCount);
            button.textContent = company + " (" + String(visitedCount) + "/" + String(lines.length) + ")";
            button.onclick = () => selectCompany(company);
            content.appendChild(button);
        });
    }

    function renderTrainTypeList(content) {
        content.appendChild(createBackButton("← Zpět na dopravce", () => selectCompany(null)));

        const heading = document.createElement("div");
        heading.className = "collection-section-title";
        heading.textContent = state.selectedCompany;
        content.appendChild(heading);

        TRAIN_TYPE_NAMES.forEach((typeName, type) => {
            const lines = getLinesForCompanyAndType(state.selectedCompany, type);
            if (lines.length === 0) return;

            const button = document.createElement("button");
            button.className = "collection-type-btn collection-line-progress-btn";
            const visitedCount = runtime.getGameState().getVisitedLineCountForCompanyAndType(
                state.selectedCompany,
                type
            );
            setLineProgress(button, lines, visitedCount);
            button.textContent = typeName + " (" + String(visitedCount) + "/" + String(lines.length) + ")";
            button.onclick = () => selectTrainType(type);
            content.appendChild(button);
        });
    }

    function setLineFilter(filter) {
        state.lineFilter = filter;
        render();
    }

    function createLineFilterControls() {
        const controls = document.createElement("div");
        controls.className = "collection-sort";
        const options = [
            ["all", "Všechny"],
            ["visited", "Navštívené"],
            ["unvisited", "Nenavštívené"]
        ];

        options.forEach(([value, label]) => {
            const button = document.createElement("button");
            button.className = state.lineFilter === value
                ? "collection-sort-btn active"
                : "collection-sort-btn";
            button.textContent = label;
            button.onclick = () => setLineFilter(value);
            controls.appendChild(button);
        });

        return controls;
    }

    function filterLines(lines) {
        if (state.lineFilter === "visited") {
            return lines.filter(line => lineVisits.isVisited(line.id));
        }
        if (state.lineFilter === "unvisited") {
            return lines.filter(line => !lineVisits.isVisited(line.id));
        }
        return lines;
    }
    function openLine(line) {
        const currentTime = app.getCurrentTimeInSeconds();
        const firstStationId = line.stops[0].sid;
        const nextTrip = app.getTripNumberByTime(line, firstStationId, currentTime);
        runtime.setTrainSectionData({
            lineID: line.id,
            tripID: nextTrip.trip,
            day: nextTrip.day,
            hidesinfront: false
        });
        app.changeCurrentSection(2);
    }

    function renderLineList(content) {
        content.appendChild(createBackButton("← Zpět na typy vlaků", () => selectTrainType(null)));

        const heading = document.createElement("div");
        heading.className = "collection-section-title";
        heading.textContent = state.selectedCompany + " — " + TRAIN_TYPE_NAMES[state.selectedTrainType];
        content.appendChild(heading);
        content.appendChild(createLineFilterControls());

        const lines = filterLines(getLinesForCompanyAndType(state.selectedCompany, state.selectedTrainType));
        if (lines.length === 0) {
            renderEmptyState(content);
            return;
        }

        lines.forEach(line => {
            const start = data.timetable.stations[line.stops[0].sid];
            const destination = data.timetable.stations[line.stops[line.stops.length - 1].sid];
            const button = document.createElement("button");
            const visited = lineVisits.isVisited(line.id);
            button.className = visited
                ? "collection-line-btn visited"
                : "collection-line-btn";
            const nickname = line.nickname ? " " + line.nickname : "";
            button.innerHTML = '<span class="collection-line-number">'
                + (visited ? "✓ " : "")
                + TRAIN_TYPE_NAMES[line.type] + " " + line.number + nickname
                + '</span><span class="collection-line-route">'
                + settings.getStationNameMarkup(start) + " → "
                + settings.getStationNameMarkup(destination) + "</span>";
            button.onclick = () => openLine(line);
            content.appendChild(button);
        });
    }

    function renderLines(content) {
        if (state.selectedCompany === null) {
            renderCompanyList(content);
        }
        else if (state.selectedTrainType === null) {
            renderTrainTypeList(content);
        }
        else {
            renderLineList(content);
        }
    }

    function selectDelayType(type) {
        state.selectedDelayType = type;
        state.selectedDelayReason = null;
        state.delayFilter = "all";
        render();
    }

    function getReasonsByType(type) {
        return config.delayReasons.filter(reason => reason[2] === type);
    }
    function isDelayReasonCollected(reason) {
        return runtime.getGameState().getCollectedDelayReasons().includes(reason[3]);
    }
    function setDelayFilter(filter) {
        state.delayFilter = filter;
        render();
    }

    function createDelayFilterControls() {
        const controls = document.createElement("div");
        controls.className = "collection-sort";
        const options = [
            ["all", "Všechny"],
            ["found", "Nalezené"],
            ["missing", "Nenalezené"]
        ];

        options.forEach(([value, label]) => {
            const button = document.createElement("button");
            button.className = state.delayFilter === value
                ? "collection-sort-btn active"
                : "collection-sort-btn";
            button.textContent = label;
            button.onclick = () => setDelayFilter(value);
            controls.appendChild(button);
        });

        return controls;
    }

    function filterDelayReasons(delayReasons) {
        if (state.delayFilter === "found") {
            return delayReasons.filter(isDelayReasonCollected);
        }
        if (state.delayFilter === "missing") {
            return delayReasons.filter(reason => !isDelayReasonCollected(reason));
        }
        return delayReasons;
    }

    function renderDelayTypes(content) {
        DELAY_TYPE_NAMES.forEach((typeName, type) => {
            const matchingReasons = getReasonsByType(type);
            const button = document.createElement("button");
            const collectedCount = matchingReasons.filter(isDelayReasonCollected).length;
            button.className = "collection-type-btn collection-line-progress-btn";
            button.style.setProperty(
                "--visited-percentage",
                String(matchingReasons.length === 0 ? 0 : collectedCount / matchingReasons.length * 100) + "%"
            );
            button.textContent = typeName + " (" + String(collectedCount) + "/" + String(matchingReasons.length) + ")";
            button.onclick = () => selectDelayType(type);
            content.appendChild(button);
        });
    }

    function selectDelayReason(delayReason) {
        state.selectedDelayReason = delayReason;
        render();
    }

    function isActiveTrainStatus(status) {
        return status === constants.TRAIN_STATUS.STOPPED_BEFORE_TARGET
            || status === constants.TRAIN_STATUS.TRAVELLING_TO_TARGET
            || status === constants.TRAIN_STATUS.STOPPED_AT_TARGET
            || status === constants.TRAIN_STATUS.TRAVELLING_PAST_TARGET
            || status === constants.TRAIN_STATUS.STOPPED_PAST_TARGET;
    }

    function getCurrentTrainsWithReason(delayReasonId) {
        const time = app.getCurrentTimeInSeconds();
        const matchingTrains = [];

        data.timetable.lines.forEach(line => {
            for (let day = -1; day <= 0; day++) {
                for (let tripID = 0; tripID < line.trips; tripID++) {
                    const route = tripRoutes.getTripRoute(line.id, tripID);
                    if (route === null) continue;
                    const currentDelay = delays.get(
                        line.id,
                        tripID,
                        time,
                        route.destinationStationId,
                        day,
                        route.endIndex
                    );
                    if (!isActiveTrainStatus(currentDelay.status)
                        || currentDelay.delay <= 5 * 60
                        || delays.getReason(line.id, tripID, day) !== delayReasonId) {
                        continue;
                    }
                    const tripStart = line.starttime + day * constants.SECONDS_PER_DAY + tripID * line.interval;
                    const plannedDeparture = tripStart + route.stops[0].dep;
                    const plannedArrival = tripStart + route.stops[route.stops.length - 1].arr;
                    const delayedJourneyDuration = currentDelay.delay + plannedArrival - plannedDeparture;
                    const progressPercentage = delayedJourneyDuration <= 0
                        ? 0
                        : Math.min(100, Math.max(
                            0,
                            (time - plannedDeparture) / delayedJourneyDuration * 100
                        ));
                    matchingTrains.push({
                        line,
                        tripID,
                        day,
                        currentDelay,
                        progressPercentage,
                        route
                    });
                }
            }
        });

        return matchingTrains.sort((a, b) => b.currentDelay.delay - a.currentDelay.delay);
    }

    function openCurrentTrain(train) {
        runtime.setTrainSectionData({
            lineID: train.line.id,
            tripID: train.tripID,
            day: train.day,
            hidesinfront: true
        });
        app.changeCurrentSection(2);
    }

    function renderCurrentTrainsForDelay(content) {
        content.appendChild(createBackButton("← Zpět na důvody zpoždění", () => selectDelayReason(null)));

        const heading = document.createElement("div");
        heading.className = "collection-section-title";
        heading.textContent = delays.getReasonName(state.selectedDelayReason);
        content.appendChild(heading);

        const matchingTrains = getCurrentTrainsWithReason(state.selectedDelayReason);
        if (matchingTrains.length === 0) {
            renderEmptyState(content);
            return;
        }

        matchingTrains.forEach(train => {
            const line = train.line;
            const start = data.timetable.stations[train.route.originStationId];
            const destination = data.timetable.stations[train.route.destinationStationId];
            const button = document.createElement("button");
            button.className = "collection-line-btn collection-line-progress-btn";
            button.style.setProperty(
                "--visited-percentage",
                String(train.progressPercentage) + "%"
            );
            button.innerHTML = '<span class="collection-line-number">'
                + app.getTrainName(line, false, false)
                + " · +" + String(Math.floor(train.currentDelay.delay / 60)) + " min"
                + '</span><span class="collection-line-route">'
                + settings.getStationNameMarkup(start) + " → "
                + settings.getStationNameMarkup(destination) + "</span>";
            button.onclick = () => openCurrentTrain(train);
            content.appendChild(button);
        });
    }
    function renderDelayReasons(content) {
        content.appendChild(createBackButton("← Zpět na typy zpoždění", () => selectDelayType(null)));

        const heading = document.createElement("div");
        heading.className = "collection-section-title";
        heading.textContent = DELAY_TYPE_NAMES[state.selectedDelayType];
        content.appendChild(heading);
        content.appendChild(createDelayFilterControls());

        const delayReasons = filterDelayReasons(getReasonsByType(state.selectedDelayType));
        if (delayReasons.length === 0) {
            renderEmptyState(content);
            return;
        }

        delayReasons.forEach(reason => {
            const collected = isDelayReasonCollected(reason);
            const button = document.createElement("button");
            button.className = collected
                ? "collection-line-btn visited"
                : "collection-line-btn";
            button.textContent = (collected ? "✓ " : "") + reason[0];
            button.onclick = () => selectDelayReason(reason[3]);
            content.appendChild(button);
        });
    }

    function renderDelays(content) {
        if (state.selectedDelayType === null) {
            renderDelayTypes(content);
        }
        else if (state.selectedDelayReason === null) {
            renderDelayReasons(content);
        }
        else {
            renderCurrentTrainsForDelay(content);
        }
    }
    function selectCategory(category) {
        state.activeCategory = category;
        state.selectedCountry = null;
        state.selectedDistrict = null;
        state.selectedCompany = null;
        state.selectedTrainType = null;
        state.lineFilter = "all";
        state.stationFilter = "all";
        state.selectedDelayType = null;
        state.selectedDelayReason = null;
        state.delayFilter = "all";
        render();
    }

    function selectCountry(country) {
        state.selectedCountry = country;
        state.selectedDistrict = null;
        state.stationFilter = "all";
        render();
    }

    function selectDistrict(district) {
        state.selectedDistrict = district;
        state.stationFilter = "all";
        render();
    }

    function setDistrictSort(sortMode) {
        state.districtSort = sortMode;
        render();
    }

    function getDistrictProgress(country, district) {
        const stations = getStationsForDistrict(country, district);
        return stations.length === 0 ? 0 : getVisitedCount(country, district) / stations.length;
    }

    function sortDistricts(country, districts) {
        return [...districts].sort((a, b) => {
            if (state.districtSort === "station-count") {
                const countDifference = getStationsForDistrict(country, b).length - getStationsForDistrict(country, a).length;
                if (countDifference !== 0) return countDifference;
            }
            if (state.districtSort === "progress") {
                const progressDifference = getDistrictProgress(country, b) - getDistrictProgress(country, a);
                if (progressDifference !== 0) return progressDifference;
            }
            return a.localeCompare(b, "cs");
        });
    }

    function createDistrictSortControls() {
        const controls = document.createElement("div");
        controls.className = "collection-sort";

        const options = [
            ["alphabetical", "Abecedně"],
            ["station-count", "Počet stanic"],
            ["progress", "Postup"]
        ];

        options.forEach(([value, label]) => {
            const button = document.createElement("button");
            button.className = state.districtSort === value
                ? "collection-sort-btn active"
                : "collection-sort-btn";
            button.textContent = label;
            button.onclick = () => setDistrictSort(value);
            controls.appendChild(button);
        });

        return controls;
    }

    function getCountries() {
        return [...stationsByCountry.keys()];
    }

    function getStationsForCountry(country) {
        return stationsByCountry.get(country) ?? [];
    }

    function sortCountries(countries) {
        return [...countries].sort((a, b) => {
            const stationsA = getStationsForCountry(a);
            const stationsB = getStationsForCountry(b);
            if (state.districtSort === "station-count") {
                const difference = stationsB.length - stationsA.length;
                if (difference !== 0) return difference;
            }
            if (state.districtSort === "progress") {
                const progressA = stationsA.length === 0 ? 0 : getVisitedCount(a) / stationsA.length;
                const progressB = stationsB.length === 0 ? 0 : getVisitedCount(b) / stationsB.length;
                if (progressB !== progressA) return progressB - progressA;
            }
            return getCountryName(a).localeCompare(getCountryName(b), "cs");
        });
    }

    function getDistricts(country) {
        return [...(stationsByCountryAndDistrict.get(country)?.keys() ?? [])];
    }

    function getStationsForDistrict(country, district) {
        return stationsByCountryAndDistrict.get(country)?.get(district) ?? [];
    }

    function getVisitedCount(country, district = null) {
        const gameState = runtime.getGameState();
        return district === null
            ? gameState.getVisitedStationCountForCountry(country)
            : gameState.getVisitedStationCountForCountryAndDistrict(country, district);
    }

    function createNavigation() {
        const navigation = document.createElement("div");
        navigation.className = "collection-nav";

        const stationsButton = document.createElement("button");
        stationsButton.className = state.activeCategory === "stations"
            ? "collection-nav-btn active"
            : "collection-nav-btn";
        stationsButton.textContent = "Stanice";
        stationsButton.onclick = () => selectCategory("stations");

        const linesButton = document.createElement("button");
        linesButton.className = state.activeCategory === "lines"
            ? "collection-nav-btn active"
            : "collection-nav-btn";
        linesButton.textContent = "Linky";
        linesButton.onclick = () => selectCategory("lines");

        const goodsButton = document.createElement("button");
        goodsButton.className = state.activeCategory === "config.goods"
            ? "collection-nav-btn active"
            : "collection-nav-btn";
        goodsButton.textContent = "Zboží";
        goodsButton.onclick = () => selectCategory("config.goods");

        const delaysButton = document.createElement("button");
        delaysButton.className = state.activeCategory === "delays"
            ? "collection-nav-btn active"
            : "collection-nav-btn";
        delaysButton.textContent = "Zpoždění";
        delaysButton.onclick = () => selectCategory("delays");

        navigation.append(stationsButton, linesButton, goodsButton, delaysButton);
        return navigation;
    }

    function renderDistrictList(content, country) {
        content.appendChild(createBackButton("← Zpět na země", () => selectCountry(null)));
        const heading = document.createElement("div");
        heading.className = "collection-section-title";
        heading.textContent = getCountryName(country);
        content.appendChild(heading);
        const districts = sortDistricts(country, getDistricts(country));
        content.appendChild(createDistrictSortControls());
        if (districts.length === 0) {
            renderEmptyState(content);
            return;
        }

        districts.forEach(district => {
            const stations = getStationsForDistrict(country, district);
            const button = document.createElement("button");
            const visitedCount = getVisitedCount(country, district);
            const visitedPercentage = stations.length === 0
                ? 0
                : Math.min(100, Math.max(0, visitedCount / stations.length * 100));
            button.className = "collection-district-btn";
            button.style.setProperty("--visited-percentage", String(visitedPercentage) + "%");
            button.textContent = district + " (" + String(visitedCount) + "/" + String(stations.length) + ")";
            button.onclick = () => selectDistrict(district);
            content.appendChild(button);
        });
    }

    function renderCountryList(content) {
        const countries = sortCountries(getCountries());
        content.appendChild(createDistrictSortControls());
        if (countries.length === 0) {
            renderEmptyState(content);
            return;
        }

        countries.forEach(country => {
            const stations = getStationsForCountry(country);
            const button = document.createElement("button");
            const visitedCount = getVisitedCount(country);
            const visitedPercentage = stations.length === 0
                ? 0
                : Math.min(100, Math.max(0, visitedCount / stations.length * 100));
            button.className = "collection-district-btn";
            button.style.setProperty("--visited-percentage", String(visitedPercentage) + "%");
            button.textContent = getCountryName(country) + " (" + String(visitedCount) + "/" + String(stations.length) + ")";
            button.onclick = () => selectCountry(country);
            content.appendChild(button);
        });
    }

    function setStationFilter(filter) {
        state.stationFilter = filter;
        render();
    }

    function createStationFilterControls() {
        const controls = document.createElement("div");
        controls.className = "collection-sort";
        const options = [
            ["all", "Všechny"],
            ["visited", "Navštívené"],
            ["unvisited", "Nenavštívené"]
        ];

        options.forEach(([value, label]) => {
            const button = document.createElement("button");
            button.className = state.stationFilter === value
                ? "collection-sort-btn active"
                : "collection-sort-btn";
            button.textContent = label;
            button.onclick = () => setStationFilter(value);
            controls.appendChild(button);
        });

        return controls;
    }

    function filterStations(stations) {
        if (state.stationFilter === "visited") {
            return stations.filter(station => stationVisits.isVisited(station.id));
        }
        if (state.stationFilter === "unvisited") {
            return stations.filter(station => !stationVisits.isVisited(station.id));
        }
        return stations;
    }

    function renderStationList(content, country) {
        const hasDistricts = country === "CZ" || country === "SK";
        content.appendChild(createBackButton(
            hasDistricts ? "← Zpět na okresy" : "← Zpět na země",
            () => hasDistricts ? selectDistrict(null) : selectCountry(null)
        ));

        const heading = document.createElement("div");
        heading.className = "collection-section-title";
        heading.textContent = hasDistricts ? state.selectedDistrict : getCountryName(country);
        content.appendChild(heading);
        content.appendChild(createStationFilterControls());

        const stations = filterStations(hasDistricts
            ? getStationsForDistrict(country, state.selectedDistrict)
            : getStationsForCountry(country));
        if (stations.length === 0) {
            renderEmptyState(content);
            return;
        }

        stations.forEach(station => {
            const visited = stationVisits.isVisited(station.id);
            const button = document.createElement("button");
            button.className = visited
                ? "collection-station-btn visited"
                : "collection-station-btn";
            settings.setStationName(button, station, visited ? "\u2713 " : "");
            button.onclick = () => {
                runtime.setStationSectionId(station.id);
                app.changeCurrentSection(1);
            };
            content.appendChild(button);
        });
    }

    function renderEmptyState(content) {
        const emptyState = document.createElement("div");
        emptyState.className = "collection-empty";
        emptyState.textContent = "Zatím tu nic není";
        content.appendChild(emptyState);
    }

    function render() {
        const section = document.querySelector("#_section7");
        section.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.className = "collection-tab";
        wrapper.appendChild(createNavigation());

        const content = document.createElement("div");
        content.className = "collection-content";

        if (state.activeCategory === "stations") {
            if (state.selectedCountry === null) {
                renderCountryList(content);
            }
            else if ((state.selectedCountry === "CZ" || state.selectedCountry === "SK")
                && state.selectedDistrict === null) {
                renderDistrictList(content, state.selectedCountry);
            }
            else {
                renderStationList(content, state.selectedCountry);
            }
        }
        else if (state.activeCategory === "lines") {
            renderLines(content);
        }
        else if (state.activeCategory === "delays") {
            renderDelays(content);
        }
        else {
            renderEmptyState(content);
        }

        wrapper.appendChild(content);
        section.appendChild(wrapper);
    }

    document.addEventListener("delay-reason-collected", () => {
        if (runtime.getCurrentSection() === 7) render();
    });

    document.addEventListener("line-visited", () => {
        if (runtime.getCurrentSection() === 7) render();
    });

    document.addEventListener("station-visited", () => {
        if (runtime.getCurrentSection() === 7) render();
    });

    export {
    render
};
