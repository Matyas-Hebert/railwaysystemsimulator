const collectionTab = (() => {
    const state = {
        activeCategory: "stations",
        selectedDistrict: null,
        districtSort: "alphabetical"
    };

    function selectCategory(category) {
        state.activeCategory = category;
        state.selectedDistrict = null;
        render();
    }

    function selectDistrict(district) {
        state.selectedDistrict = district;
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

        navigation.append(stationsButton, linesButton);
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

        getStationsForDistrict(state.selectedDistrict).forEach(station => {
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
        else {
            renderEmptyState(content);
        }

        wrapper.appendChild(content);
        section.appendChild(wrapper);
    }

    document.addEventListener("station-visited", () => {
        if (currentsection === 7) render();
    });

    return { render };
})();
