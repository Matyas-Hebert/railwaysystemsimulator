(function (global) {
    let collectionTabState = {
        activeCategory: "stations",
        selectedDistrict: null
    };
    let visitedStations = [];
    global.stationVisitStartedAt = null;

    function selectCollectionCategory(category) {
        collectionTabState.activeCategory = category;
        collectionTabState.selectedDistrict = null;
        renderCollectionTab();
    }

    function selectDistrict(district) {
        collectionTabState.selectedDistrict = district;
        renderCollectionTab();
    }

    function loadVisitedStations() {
        try {
            const stored = localStorage.getItem("_visitedstations");
            if (!stored) {
                visitedStations = [];
                return;
            }
            const parsed = JSON.parse(stored);
            visitedStations = Array.isArray(parsed) ? parsed : [];
        }
        catch (error) {
            visitedStations = [];
        }
    }

    function saveVisitedStations() {
        localStorage.setItem("_visitedstations", JSON.stringify(visitedStations));
    }

    function isStationVisited(stationId) {
        if (stationId == null || stationId === -1) {
            return false;
        }
        return visitedStations.includes(Number(stationId));
    }

    function markStationVisited(stationId, force = false) {
        if (stationId == null || stationId === -1) {
            return;
        }
        const normalizedStationId = Number(stationId);
        if (Number.isNaN(normalizedStationId)) {
            return;
        }
        if (force || !visitedStations.includes(normalizedStationId)) {
            visitedStations.push(normalizedStationId);
            saveVisitedStations();
            if (typeof global.renderCollectionTab === "function") {
                global.renderCollectionTab();
            }
        }
    }

    function startStationVisitTimer(stationId) {
        global.stationVisitStartedAt = Date.now();
        if (stationId != null && !isStationVisited(stationId)) {
            markStationVisited(stationId, false);
        }
    }

    function maybeTrackStationVisit() {
        if (!currentposition || currentposition.transporttype !== 0) {
            return;
        }
        const stationId = Number(currentposition?.statID);
        if (Number.isNaN(stationId) || stationId === -1 || isStationVisited(stationId)) {
            return;
        }
        if (global.stationVisitStartedAt == null) {
            global.stationVisitStartedAt = Date.now();
            return;
        }
        if (Date.now() - global.stationVisitStartedAt >= 180000) {
            markStationVisited(stationId, true);
            global.stationVisitStartedAt = Date.now();
        }
    }

    function changeStation(stationId, options = {}) {
        console.log(currentposition);
        if (!currentposition) {
            return;
        }
        console.log("a");
        const normalizedStationId = Number(stationId);
        if (Number.isNaN(normalizedStationId)) {
            return;
        }
        console.log("b");
        const previousStationId = Number(currentposition.statID);
        currentposition.statID = normalizedStationId;
        if (options.transportType != null) {
            currentposition.transporttype = options.transportType;
        }
        if (options.goalStatID != null) {
            currentposition.goalStatID = options.goalStatID;
        }
        if (options.time != null) {
            currentposition.time = options.time;
        }

        if (options.transportType === 0 || previousStationId !== normalizedStationId) {
            global.stationVisitStartedAt = Date.now();
        }

        if (options.forceVisit === true) {
            markStationVisited(normalizedStationId, true);
        }
        if (typeof global.updatepositionlocalstorage === "function") {
            global.updatepositionlocalstorage();
        }
        if (typeof global.printcurrentsection === "function") {
            global.printcurrentsection();
        }
    }

    function getDistricts() {
        const stations = Array.isArray(timetable?.stations) ? timetable.stations : [];
        const districtMap = {};

        stations.forEach((station) => {
            if (!station || !station.district) {
                return;
            }
            if (!districtMap[station.district]) {
                districtMap[station.district] = [];
            }
            districtMap[station.district].push(station);
        });

        return Object.keys(districtMap).sort((a, b) => a.localeCompare(b, "cs"));
    }

    function getStationsForDistrict(district) {
        const stations = Array.isArray(timetable?.stations) ? timetable.stations : [];
        return stations.filter((station) => station && station.district === district);
    }

    function getVisitedStationCountForDistrict(district) {
        return getStationsForDistrict(district).filter((station) => isStationVisited(station.id)).length;
    }

    function renderCollectionTab() {
        const section = document.getElementById("_section7");
        if (!section) {
            return;
        }

        section.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.className = "collection-tab";

        const nav = document.createElement("div");
        nav.className = "collection-nav";

        const stationsButton = document.createElement("button");
        stationsButton.className = collectionTabState.activeCategory === "stations"
            ? "collection-nav-btn active"
            : "collection-nav-btn";
        stationsButton.textContent = "Stanice";
        stationsButton.onclick = function () {
            selectCollectionCategory("stations");
        };

        const linesButton = document.createElement("button");
        linesButton.className = collectionTabState.activeCategory === "lines"
            ? "collection-nav-btn active"
            : "collection-nav-btn";
        linesButton.textContent = "Linky";
        linesButton.onclick = function () {
            selectCollectionCategory("lines");
        };

        nav.appendChild(stationsButton);
        nav.appendChild(linesButton);

        const content = document.createElement("div");
        content.className = "collection-content";

        if (collectionTabState.activeCategory === "stations") {
            if (!collectionTabState.selectedDistrict) {
                const districts = getDistricts();
                if (districts.length === 0) {
                    const emptyState = document.createElement("div");
                    emptyState.className = "collection-empty";
                    emptyState.textContent = "Zatím tu nic není";
                    content.appendChild(emptyState);
                }
                else {
                    districts.forEach((district) => {
                        const districtButton = document.createElement("button");
                        districtButton.className = "collection-district-btn";
                        districtButton.textContent = `${district} (${getVisitedStationCountForDistrict(district)}/${getStationsForDistrict(district).length})`;
                        districtButton.onclick = function () {
                            selectDistrict(district);
                        };
                        content.appendChild(districtButton);
                    });
                }
            }
            else {
                const backButton = document.createElement("button");
                backButton.className = "collection-back-btn";
                backButton.textContent = "← Zpět na kraje";
                backButton.onclick = function () {
                    selectCollectionCategory("stations");
                };
                content.appendChild(backButton);

                const heading = document.createElement("div");
                heading.className = "collection-section-title";
                heading.textContent = collectionTabState.selectedDistrict;
                content.appendChild(heading);

                const stations = getStationsForDistrict(collectionTabState.selectedDistrict);
                stations.forEach((station) => {
                    const stationButton = document.createElement("button");
                    stationButton.className = isStationVisited(station.id) ? "collection-station-btn visited" : "collection-station-btn";
                    stationButton.textContent = `${isStationVisited(station.id) ? "✓ " : ""}${getstationname(station) || station.id}`;
                    stationButton.onclick = function () {
                        if (station.id != null) {
                            section1id = station.id;
                            changecurrentsection(1);
                        }
                    };
                    content.appendChild(stationButton);
                });
            }
        }
        else {
            const emptyState = document.createElement("div");
            emptyState.className = "collection-empty";
            emptyState.textContent = "Zatím tu nic není";
            content.appendChild(emptyState);
        }

        wrapper.appendChild(nav);
        wrapper.appendChild(content);
        section.appendChild(wrapper);
    }

    loadVisitedStations();
    setInterval(maybeTrackStationVisit, 1000);

    global.renderCollectionTab = renderCollectionTab;
    global.selectCollectionCategory = selectCollectionCategory;
    global.selectDistrict = selectDistrict;
    global.changeStation = changeStation;
    global.markStationVisited = markStationVisited;
    global.isStationVisited = isStationVisited;
})(window);
