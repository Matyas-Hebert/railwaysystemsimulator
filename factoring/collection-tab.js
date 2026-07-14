const collectionTab = (() => {
    const state = {
        activeCategory: "stations",
        selectedDistrict: null,
        districtSort: "alphabetical",
        selectedCompany: null,
        selectedTrainType: null,
        lineFilter: "all",
        stationFilter: "all",
        selectedDelayType: null,
        selectedDelayReason: null,
        delayFilter: "all"
    };

    const TRAIN_TYPE_NAMES = Object.freeze(["Ps", "Os", "Sp", "R", "Sh", "EC"]);
    const DELAY_TYPE_NAMES = Object.freeze(["Běžné", "Vtipné", "Závažné"]);

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
        return timetable.lines.filter(line => line?.company === company);
    }

    function getLinesForCompanyAndType(company, type) {
        return getLinesForCompany(company)
            .filter(line => line.type === type)
            .sort((a, b) => String(a.number).localeCompare(String(b.number), "cs", {
                numeric: true,
                sensitivity: "base"
            }));
    }

    function getVisitedLineCount(lines) {
        return lines.filter(line => lineVisits.isVisited(line.id)).length;
    }

    function setLineProgress(button, lines) {
        const visitedCount = getVisitedLineCount(lines);
        const percentage = lines.length === 0 ? 0 : visitedCount / lines.length * 100;
        button.style.setProperty("--visited-percentage", String(percentage) + "%");
        return visitedCount;
    }
    function createBackButton(label, onClick) {
        const button = document.createElement("button");
        button.className = "collection-back-btn";
        button.textContent = label;
        button.onclick = onClick;
        return button;
    }

    function renderCompanyList(content) {
        const companies = [...new Set(timetable.lines.map(line => line.company).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "cs"));

        companies.forEach(company => {
            const button = document.createElement("button");
            const lines = getLinesForCompany(company);
            button.className = "collection-company-btn collection-line-progress-btn";
            const visitedCount = setLineProgress(button, lines);
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
            const visitedCount = setLineProgress(button, lines);
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
        const now = new Date();
        const currentTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const firstStationId = line.stops[0].sid;
        const nextTrip = getTripNumberByTime(line, firstStationId, currentTime);
        section2data = {
            lineID: line.id,
            tripID: nextTrip.trip,
            day: nextTrip.day,
            hidesinfront: false
        };
        changeCurrentSection(2);
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
            const start = timetable.stations[line.stops[0].sid];
            const destination = timetable.stations[line.stops[line.stops.length - 1].sid];
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
        return reasons.filter(reason => reason[2] === type);
    }
    function isDelayReasonCollected(reason) {
        return gameState.getCollectedDelayReasons().includes(reason[0]);
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
        return status === TRAIN_STATUS.STOPPED_BEFORE_TARGET
            || status === TRAIN_STATUS.TRAVELLING_TO_TARGET
            || status === TRAIN_STATUS.STOPPED_AT_TARGET
            || status === TRAIN_STATUS.TRAVELLING_PAST_TARGET
            || status === TRAIN_STATUS.STOPPED_PAST_TARGET;
    }

    function getCurrentTrainsWithReason(delayReason) {
        const now = new Date();
        const time = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const matchingTrains = [];

        timetable.lines.forEach(line => {
            for (let day = -1; day <= 0; day++) {
                for (let tripID = 0; tripID < line.trips; tripID++) {
                    const currentDelay = delays.get(
                        line.id,
                        tripID,
                        time,
                        line.stops[line.stops.length - 1].sid,
                        day
                    );
                    if (!isActiveTrainStatus(currentDelay.status)
                        || currentDelay.delay <= 5 * 60
                        || delays.getReason(line.id, tripID, day) !== delayReason) {
                        continue;
                    }
                    const tripStart = line.starttime + day * SECONDS_PER_DAY + tripID * line.interval;
                    const plannedDeparture = tripStart + line.stops[0].dep;
                    const plannedArrival = tripStart + line.stops[line.stops.length - 1].arr;
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
                        progressPercentage
                    });
                }
            }
        });

        return matchingTrains.sort((a, b) => b.currentDelay.delay - a.currentDelay.delay);
    }

    function openCurrentTrain(train) {
        section2data = {
            lineID: train.line.id,
            tripID: train.tripID,
            day: train.day,
            hidesinfront: true
        };
        changeCurrentSection(2);
    }

    function renderCurrentTrainsForDelay(content) {
        content.appendChild(createBackButton("← Zpět na důvody zpoždění", () => selectDelayReason(null)));

        const heading = document.createElement("div");
        heading.className = "collection-section-title";
        heading.textContent = state.selectedDelayReason;
        content.appendChild(heading);

        const matchingTrains = getCurrentTrainsWithReason(state.selectedDelayReason);
        if (matchingTrains.length === 0) {
            renderEmptyState(content);
            return;
        }

        matchingTrains.forEach(train => {
            const line = train.line;
            const start = timetable.stations[line.stops[0].sid];
            const destination = timetable.stations[line.stops[line.stops.length - 1].sid];
            const button = document.createElement("button");
            button.className = "collection-line-btn collection-line-progress-btn";
            button.style.setProperty(
                "--visited-percentage",
                String(train.progressPercentage) + "%"
            );
            button.innerHTML = '<span class="collection-line-number">'
                + getTrainName(line, false, false)
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
            button.onclick = () => selectDelayReason(reason[0]);
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

    function selectDistrict(district) {
        state.selectedDistrict = district;
        state.stationFilter = "all";
        render();
    }

    function setDistrictSort(sortMode) {
        state.districtSort = sortMode;
        render();
    }

    function getDistrictProgress(district) {
        const stations = getStationsForDistrict(district);
        return stations.length === 0 ? 0 : getVisitedCount(district) / stations.length;
    }

    function sortDistricts(districts) {
        return [...districts].sort((a, b) => {
            if (state.districtSort === "station-count") {
                const countDifference = getStationsForDistrict(b).length - getStationsForDistrict(a).length;
                if (countDifference !== 0) return countDifference;
            }
            if (state.districtSort === "progress") {
                const progressDifference = getDistrictProgress(b) - getDistrictProgress(a);
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

    function getDistricts() {
        const districts = new Set();
        timetable.stations.forEach(station => {
            if (station?.district) districts.add(station.district);
        });
        return [...districts].sort((a, b) => a.localeCompare(b, "cs"));
    }

    function getStationsForDistrict(district) {
        return timetable.stations
            .filter(station => station?.district === district)
            .sort((a, b) => a.name.localeCompare(b.name, "cs"));
    }

    function getVisitedCount(district) {
        return getStationsForDistrict(district).filter(station => stationVisits.isVisited(station.id)).length;
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
        goodsButton.className = state.activeCategory === "goods"
            ? "collection-nav-btn active"
            : "collection-nav-btn";
        goodsButton.textContent = "Zboží";
        goodsButton.onclick = () => selectCategory("goods");

        const delaysButton = document.createElement("button");
        delaysButton.className = state.activeCategory === "delays"
            ? "collection-nav-btn active"
            : "collection-nav-btn";
        delaysButton.textContent = "Zpoždění";
        delaysButton.onclick = () => selectCategory("delays");

        navigation.append(stationsButton, linesButton, goodsButton, delaysButton);
        return navigation;
    }

    function renderDistrictList(content) {
        const districts = sortDistricts(getDistricts());
        content.appendChild(createDistrictSortControls());
        if (districts.length === 0) {
            renderEmptyState(content);
            return;
        }

        districts.forEach(district => {
            const stations = getStationsForDistrict(district);
            const button = document.createElement("button");
            const visitedCount = getVisitedCount(district);
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
    function renderStationList(content) {
        const backButton = document.createElement("button");
        backButton.className = "collection-back-btn";
        backButton.textContent = "← Zpět na okresy";
        backButton.onclick = () => selectCategory("stations");
        content.appendChild(backButton);

        const heading = document.createElement("div");
        heading.className = "collection-section-title";
        heading.textContent = state.selectedDistrict;
        content.appendChild(heading);
        content.appendChild(createStationFilterControls());

        const stations = filterStations(getStationsForDistrict(state.selectedDistrict));
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
                section1id = station.id;
                changeCurrentSection(1);
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
            if (state.selectedDistrict === null) {
                renderDistrictList(content);
            }
            else {
                renderStationList(content);
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
        if (currentsection === 7) render();
    });

    document.addEventListener("line-visited", () => {
        if (currentsection === 7) render();
    });

    document.addEventListener("station-visited", () => {
        if (currentsection === 7) render();
    });

    return { render };
})();
