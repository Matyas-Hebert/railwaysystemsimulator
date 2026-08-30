const psSystemOverview = (() => {
    const LINE_TYPE_CODES = Object.freeze(lineTypeConfig.map(type => type.code));
    const sourceOptions = new Map();

    function formatDuration(seconds) {
        if (!Number.isFinite(seconds)) return "—";
        const roundedSeconds = Math.round(seconds);
        const hours = Math.floor(roundedSeconds / 3600);
        const minutes = Math.floor((roundedSeconds % 3600) / 60);
        const remainingSeconds = roundedSeconds % 60;
        const parts = [];
        if (hours > 0) parts.push(String(hours) + " h");
        if (minutes > 0) parts.push(String(minutes) + " min");
        if (remainingSeconds > 0 && hours === 0) {
            parts.push(String(remainingSeconds) + " s");
        }
        return parts.length > 0 ? parts.join(" ") : "0 min";
    }

    function formatDistance(distance) {
        return distance.toLocaleString("cs-CZ", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }) + " km";
    }

    function getLineName(line) {
        const typeCode = LINE_TYPE_CODES[line.type] || "?";
        const nickname = line.nickname ? " — " + line.nickname : "";
        return typeCode + " " + String(line.number) + nickname;
    }

    function getSystemLabel(system, systemID) {
        return LINE_TYPE_CODES[system.type] + " | "
            + system.name + " (#" + String(systemID) + ")";
    }

    function getStationLabel(station) {
        const district = station.district ? " · " + station.district : "";
        return station.name + district + " (#" + String(station.id) + ")";
    }

    function renderSourceOptions() {
        const sourceType = document.querySelector("#_sourcetype").value;
        const input = document.querySelector("#_sourcevalue");
        const datalist = document.querySelector("#_sourceoptions");
        const options = sourceType === "system"
            ? psSystems.map((system, systemID) => ({
                id: systemID,
                label: getSystemLabel(system, systemID)
            }))
            : timetable.stations.map(station => ({
                id: station.id,
                label: getStationLabel(station)
            }));

        sourceOptions.clear();
        datalist.replaceChildren();
        options.forEach(option => {
            const element = document.createElement("option");
            element.value = option.label;
            datalist.appendChild(element);
            sourceOptions.set(option.label, option.id);
        });
        input.value = "";
        input.placeholder = sourceType === "system"
            ? "Začněte psát název systému"
            : "Začněte psát název stanice";
    }

    function getClosestEndpointPair(
        line,
        firstStationIDs,
        secondStationIDs,
        startIndex,
        endIndex
    ) {
        const firstIndices = [];
        const secondIndices = [];

        for (let stopIndex = startIndex; stopIndex <= endIndex; stopIndex++) {
            const stationID = line.stops[stopIndex].sid;
            if (firstStationIDs.has(stationID)) firstIndices.push(stopIndex);
            if (secondStationIDs.has(stationID)) secondIndices.push(stopIndex);
        }

        let closestPair = null;
        firstIndices.forEach(firstIndex => {
            secondIndices.forEach(secondIndex => {
                const stopDistance = Math.abs(firstIndex - secondIndex);
                if (stopDistance === 0) return;
                if (closestPair === null || stopDistance < closestPair.stopDistance) {
                    closestPair = { firstIndex, secondIndex, stopDistance };
                }
            });
        });
        return closestPair;
    }

    function analyzeLine(line, firstStationIDs, secondStationIDs) {
        const travelTimes = [];
        const firstStops = new Set();
        const secondStops = new Set();

        for (let tripID = 0; tripID < line.trips; tripID++) {
            const route = tripRoutes.getTripRoute(line.id, tripID);
            if (route === null) continue;
            const endpointPair = getClosestEndpointPair(
                line,
                firstStationIDs,
                secondStationIDs,
                route.startIndex,
                route.endIndex
            );
            if (endpointPair === null) continue;

            const segmentStart = Math.min(
                endpointPair.firstIndex,
                endpointPair.secondIndex
            );
            const segmentEnd = Math.max(
                endpointPair.firstIndex,
                endpointPair.secondIndex
            );
            travelTimes.push(
                line.stops[segmentEnd].arr - line.stops[segmentStart].dep
            );
            firstStops.add(line.stops[endpointPair.firstIndex].sid);
            secondStops.add(line.stops[endpointPair.secondIndex].sid);
        }

        if (travelTimes.length === 0) return null;
        return {
            directConnectionsPerDay: travelTimes.length,
            effectiveIntervalSeconds:
                line.interval * line.trips / travelTimes.length,
            travelTimes,
            firstStops: [...firstStops],
            secondStops: [...secondStops]
        };
    }

    function getRadians(value) {
        return value * Math.PI / 180;
    }

    function getStraightLineDistance(firstStation, secondStation) {
        const latDifference = getRadians(secondStation.lat - firstStation.lat);
        const lonDifference = getRadians(secondStation.lon - firstStation.lon);
        const firstLat = getRadians(firstStation.lat);
        const secondLat = getRadians(secondStation.lat);
        const a = Math.sin(latDifference / 2) ** 2
            + Math.cos(firstLat) * Math.cos(secondLat)
                * Math.sin(lonDifference / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function findClosestStations(firstSystem, secondSystem) {
        let closest = null;
        firstSystem.stationIDs.forEach(firstStationID => {
            const firstStation = timetable.stations[firstStationID];
            secondSystem.stationIDs.forEach(secondStationID => {
                const secondStation = timetable.stations[secondStationID];
                const distance = getStraightLineDistance(
                    firstStation,
                    secondStation
                );
                if (closest === null || distance < closest.distance) {
                    closest = {
                        distance,
                        firstStationID,
                        secondStationID
                    };
                }
            });
        });
        return closest;
    }

    function analyzeSystem(
        firstSystem,
        secondSystem,
        systemID,
        allowedLineTypes = null
    ) {
        const firstStationIDs = new Set(firstSystem.stationIDs);
        const secondStationIDs = new Set(secondSystem.stationIDs);
        const lines = timetable.lines
            .filter(line => line.id % 2 === 1
                && (allowedLineTypes === null
                    || allowedLineTypes.has(line.type)))
            .map(line => ({
                line,
                analysis: analyzeLine(
                    line,
                    firstStationIDs,
                    secondStationIDs
                )
            }))
            .filter(result => result.analysis !== null)
            .map(result => ({ line: result.line, ...result.analysis }))
            .sort((firstResult, secondResult) => {
                return firstResult.line.company.localeCompare(
                    secondResult.line.company,
                    "cs"
                )
                    || firstResult.line.type - secondResult.line.type
                    || String(firstResult.line.number).localeCompare(
                        String(secondResult.line.number),
                        "cs",
                        { numeric: true }
                    )
                    || firstResult.line.id - secondResult.line.id;
            });

        const travelTimes = lines.flatMap(line => line.travelTimes);
        const stationImportances = secondSystem.stationIDs.map(
            stationID => timetable.stations[stationID].importance || 0
        );
        return {
            system: secondSystem,
            systemID,
            closest: findClosestStations(firstSystem, secondSystem),
            lines,
            directConnectionsPerDay: travelTimes.length,
            travelTimes,
            fastestTime: travelTimes.length > 0
                ? Math.min(...travelTimes)
                : null,
            averageTime: getAverage(travelTimes),
            importance: stationImportances.reduce(
                (sum, importance) => sum + importance,
                0
            ),
            averageStationImportance: getAverage(stationImportances) || 0
        };
    }

    function getAverage(values) {
        if (values.length === 0) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function appendDetail(list, label, value) {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value;
        list.append(term, description);
    }

    function getStationNames(stationIDs) {
        return stationIDs
            .map(stationID => timetable.stations[stationID].name)
            .join(", ");
    }

    function renderLinesTable(report) {
        const wrapper = document.createElement("div");
        wrapper.className = "table-wrapper";
        const table = document.createElement("table");
        const head = document.createElement("thead");
        head.innerHTML = "<tr>"
            + "<th>Linka</th><th>Společnost</th><th>Vlaků/den</th>"
            + "<th>Efektivní interval</th><th>Nástupní stanice</th>"
            + "<th>Výstupní stanice</th><th>Nejrychleji</th>"
            + "<th>Průměrně</th><th>Nejpomaleji</th></tr>";
        table.appendChild(head);

        const body = document.createElement("tbody");
        report.lines.forEach(result => {
            const row = document.createElement("tr");
            const values = [
                getLineName(result.line),
                result.line.company,
                String(result.directConnectionsPerDay),
                formatDuration(result.effectiveIntervalSeconds),
                getStationNames(result.firstStops),
                getStationNames(result.secondStops),
                formatDuration(Math.min(...result.travelTimes)),
                formatDuration(getAverage(result.travelTimes)),
                formatDuration(Math.max(...result.travelTimes))
            ];
            values.forEach((value, index) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                if ([2, 3, 6, 7, 8].includes(index)) cell.className = "number";
                row.appendChild(cell);
            });
            body.appendChild(row);
        });
        table.appendChild(body);
        wrapper.appendChild(table);
        return wrapper;
    }

    function renderSystem(report) {
        const details = document.createElement("details");
        details.className = "system-result";
        if (report.directConnectionsPerDay === 0) {
            details.classList.add("no-connections");
        }

        const summary = document.createElement("summary");
        const name = document.createElement("span");
        name.className = "system-name";
        const type = document.createElement("span");
        type.className = "system-type";
        type.textContent = LINE_TYPE_CODES[report.system.type];
        name.append(type, report.system.name + " (#" + String(report.systemID) + ")");

        const distance = document.createElement("span");
        distance.className = "summary-value";
        distance.textContent = formatDistance(report.closest.distance);

        const connections = document.createElement("span");
        connections.className = "summary-value connections-value";
        connections.textContent = String(report.directConnectionsPerDay)
            + " vlaků/den";

        const importance = document.createElement("span");
        importance.className = "summary-value";
        importance.textContent = "důležitost "
            + report.importance.toLocaleString("cs-CZ", {
                maximumFractionDigits: 2
            });

        const fastest = document.createElement("span");
        fastest.className = "summary-value";
        fastest.textContent = report.travelTimes.length > 0
            ? "nejrychleji " + formatDuration(Math.min(...report.travelTimes))
            : "bez přímého spojení";

        summary.append(name, distance, importance, connections, fastest);
        details.appendChild(summary);

        const content = document.createElement("div");
        content.className = "system-details";
        const statistics = document.createElement("dl");
        statistics.className = "system-statistics";
        appendDetail(
            statistics,
            "Nejbližší stanice",
            timetable.stations[report.closest.firstStationID].name + " ↔ "
                + timetable.stations[report.closest.secondStationID].name
        );
        appendDetail(
            statistics,
            "Vzdálenost nejbližších stanic",
            formatDistance(report.closest.distance)
        );
        appendDetail(
            statistics,
            "Přímé linky",
            String(report.lines.length)
        );
        appendDetail(
            statistics,
            "Důležitost systému (součet stanic)",
            report.importance.toLocaleString("cs-CZ", {
                maximumFractionDigits: 2
            })
        );
        appendDetail(
            statistics,
            "Průměrná důležitost stanice",
            report.averageStationImportance.toLocaleString("cs-CZ", {
                maximumFractionDigits: 2
            })
        );
        appendDetail(
            statistics,
            "Přímé vlaky za den",
            String(report.directConnectionsPerDay)
        );
        appendDetail(
            statistics,
            "Průměrný interval mezi přímými vlaky",
            report.directConnectionsPerDay > 0
                ? formatDuration(86400 / report.directConnectionsPerDay)
                : "—"
        );
        appendDetail(
            statistics,
            "Doba jízdy – nejrychlejší / průměrná / nejpomalejší",
            report.travelTimes.length > 0
                ? formatDuration(Math.min(...report.travelTimes)) + " / "
                    + formatDuration(getAverage(report.travelTimes)) + " / "
                    + formatDuration(Math.max(...report.travelTimes))
                : "—"
        );
        content.appendChild(statistics);

        if (report.lines.length > 0) {
            content.appendChild(renderLinesTable(report));
        } else {
            const none = document.createElement("p");
            none.className = "none";
            none.textContent = "Mezi systémy nejezdí žádný přímý vlak.";
            content.appendChild(none);
        }

        details.appendChild(content);
        return details;
    }

    function createOverview() {
        const input = document.querySelector("#_sourcevalue");
        const status = document.querySelector("#_overviewstatus");
        const resultsElement = document.querySelector("#_overviewresults");
        const sourceType = document.querySelector("#_sourcetype").value;
        const sourceID = sourceOptions.get(input.value);

        status.className = "";
        resultsElement.replaceChildren();
        if (sourceID === undefined) {
            status.className = "error";
            status.textContent = "Vyberte výchozí bod ze seznamu nabízených možností.";
            return;
        }

        const source = sourceType === "system"
            ? psSystems[sourceID]
            : { stationIDs: [sourceID] };
        const allowedLineTypes = new Set(
            [...document.querySelectorAll("#_traintypeoptions input:checked")]
                .map(input => Number(input.value))
        );
        const allReports = psSystems
            .map((system, systemID) => ({ system, systemID }))
            .filter(result => sourceType !== "system"
                || result.systemID !== sourceID)
            .map(result => analyzeSystem(
                source,
                result.system,
                result.systemID,
                allowedLineTypes
            ));

        const readLimit = id => {
            const value = document.querySelector(id).value;
            return value === "" ? null : Number(value);
        };
        const limits = {
            minConnections: readLimit("#_minconnections"),
            maxConnections: readLimit("#_maxconnections"),
            minDistance: readLimit("#_mindistance"),
            maxDistance: readLimit("#_maxdistance"),
            minImportance: readLimit("#_minimportance"),
            maxImportance: readLimit("#_maximportance")
        };
        const isWithinLimits = (value, minimum, maximum) => {
            return (minimum === null || value >= minimum)
                && (maximum === null || value <= maximum);
        };
        const sortBy = document.querySelector("#_sortby").value;
        const direction = document.querySelector("#_sortdirection").value
            === "ascending" ? 1 : -1;
        const getSortValue = report => ({
            distance: report.closest.distance,
            connections: report.directConnectionsPerDay,
            fastestTime: report.fastestTime,
            averageTime: report.averageTime,
            importance: report.importance,
            importancePerDistance: report.closest.distance === 0
                ? Infinity
                : report.importance / report.closest.distance
        })[sortBy];

        const reports = allReports
            .filter(report => {
                return isWithinLimits(
                    report.directConnectionsPerDay,
                    limits.minConnections,
                    limits.maxConnections
                ) && isWithinLimits(
                    report.closest.distance,
                    limits.minDistance,
                    limits.maxDistance
                ) && isWithinLimits(
                    report.importance,
                    limits.minImportance,
                    limits.maxImportance
                );
            })
            .sort((first, second) => {
                const firstValue = getSortValue(first);
                const secondValue = getSortValue(second);
                if (firstValue === null && secondValue !== null) return 1;
                if (firstValue !== null && secondValue === null) return -1;
                if (firstValue !== secondValue) {
                    return (firstValue - secondValue) * direction;
                }
                return first.system.name.localeCompare(second.system.name, "cs");
            });

        const connectedSystems = reports.filter(
            report => report.directConnectionsPerDay > 0
        ).length;
        const sourceLabel = sourceType === "system"
            ? getSystemLabel(psSystems[sourceID], sourceID)
            : getStationLabel(timetable.stations[sourceID]);
        status.textContent = sourceLabel
            + ": zobrazeno " + String(reports.length) + " z "
            + String(allReports.length) + " ostatních systémů; "
            + String(connectedSystems)
            + " zobrazených systémů má přímé spojení.";
        reports.forEach(report => {
            resultsElement.appendChild(renderSystem(report));
        });
    }

    function initialize() {
        document.querySelector("#_sourcetype").addEventListener(
            "change",
            renderSourceOptions
        );
        renderSourceOptions();

        const typeOptions = document.querySelector("#_traintypeoptions");
        lineTypeConfig.forEach((type, typeID) => {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = typeID;
            checkbox.checked = true;
            label.append(checkbox, type.code);
            typeOptions.appendChild(label);
        });

        document.querySelector("#_createoverview").addEventListener(
            "click",
            createOverview
        );
    }

    return { createOverview, initialize };
})();

document.addEventListener("DOMContentLoaded", psSystemOverview.initialize);
