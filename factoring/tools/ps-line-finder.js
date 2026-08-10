const psLineFinder = (() => {
    const LINE_TYPE_CODES = ["Ps", "Os", "Sp", "R", "Sh", "EC"];
    const endpointOptions = new Map();

    function formatInterval(seconds) {
        const roundedSeconds = Math.round(seconds);
        const hours = Math.floor(roundedSeconds / 3600);
        const minutes = Math.floor((roundedSeconds % 3600) / 60);
        const remainingSeconds = roundedSeconds % 60;
        const parts = [];
        if (hours > 0) parts.push(String(hours) + " h");
        if (minutes > 0) parts.push(String(minutes) + " min");
        if (remainingSeconds > 0) parts.push(String(remainingSeconds) + " s");
        return parts.length > 0 ? parts.join(" ") : "0 min";
    }

    function getLineName(line) {
        const typeCode = LINE_TYPE_CODES[line.type] || "?";
        const nickname = line.nickname ? " — " + line.nickname : "";
        return typeCode + " " + String(line.number) + nickname;
    }

    function getStationLabel(station) {
        const district = station.district ? " · " + station.district : "";
        return station.name + district + " (#" + String(station.id) + ")";
    }

    function getSystemLabel(system, systemID) {
        return system.name + " (#" + String(systemID) + ")";
    }

    function getOptions(type) {
        if (type === "system") {
            return psSystems.map((system, systemID) => ({
                id: systemID,
                label: getSystemLabel(system, systemID)
            }));
        }
        return timetable.stations.map(station => ({
            id: station.id,
            label: getStationLabel(station)
        }));
    }

    function renderOptions(endpointName) {
        const type = document.querySelector("#_" + endpointName + "type").value;
        const input = document.querySelector("#_" + endpointName + "value");
        const datalist = document.querySelector("#_" + endpointName + "options");
        const options = getOptions(type);
        const optionsByLabel = new Map();

        datalist.replaceChildren();
        options.forEach(option => {
            const element = document.createElement("option");
            element.value = option.label;
            datalist.appendChild(element);
            optionsByLabel.set(option.label, option.id);
        });
        endpointOptions.set(endpointName, optionsByLabel);
        input.value = "";
        input.placeholder = type === "system"
            ? "Začněte psát název Ps systému"
            : "Začněte psát název stanice";
    }

    function readEndpoint(endpointName) {
        const type = document.querySelector("#_" + endpointName + "type").value;
        const input = document.querySelector("#_" + endpointName + "value");
        const id = endpointOptions.get(endpointName).get(input.value);
        if (id === undefined) return null;
        const stationIDs = type === "system" ? psSystems[id].stationIDs : [id];
        return {
            type,
            id,
            name: type === "system" ? psSystems[id].name : timetable.stations[id].name,
            stationIDs: new Set(stationIDs)
        };
    }

    function getMatchingStops(line, endpoint) {
        const seen = new Set();
        return line.stops
            .filter(stop => {
                if (!endpoint.stationIDs.has(stop.sid) || seen.has(stop.sid)) return false;
                seen.add(stop.sid);
                return true;
            })
            .map(stop => stop.sid);
    }

    function getClosestEndpointPair(line, first, second) {
        const firstIndices = [];
        const secondIndices = [];
        line.stops.forEach((stop, index) => {
            if (first.stationIDs.has(stop.sid)) firstIndices.push(index);
            if (second.stationIDs.has(stop.sid)) secondIndices.push(index);
        });
        let closestPair = null;
        firstIndices.forEach(firstIndex => {
            secondIndices.forEach(secondIndex => {
                const distance = Math.abs(firstIndex - secondIndex);
                if (distance === 0) return;
                if (closestPair === null || distance < closestPair.distance) {
                    closestPair = { firstIndex, secondIndex, distance };
                }
            });
        });
        return closestPair;
    }

    function findConnectingLines(first, second) {
        return timetable.lines
            .filter(line => line.id % 2 === 1)
            .map(line => ({ line, endpointPair: getClosestEndpointPair(line, first, second) }))
            .filter(result => result.endpointPair !== null)
            .map(result => {
                const { line, endpointPair } = result;
                const segmentStart = Math.min(endpointPair.firstIndex, endpointPair.secondIndex);
                const segmentEnd = Math.max(endpointPair.firstIndex, endpointPair.secondIndex);
                return {
                    line,
                    firstStops: getMatchingStops(line, first),
                    secondStops: getMatchingStops(line, second),
                    intermediateStationIDs: line.stops
                        .slice(segmentStart + 1, segmentEnd)
                        .map(stop => stop.sid)
                };
            })
            .sort((firstResult, secondResult) => {
                const firstLine = firstResult.line;
                const secondLine = secondResult.line;
                return firstLine.company.localeCompare(secondLine.company, "cs")
                    || firstLine.type - secondLine.type
                    || String(firstLine.number).localeCompare(String(secondLine.number), "cs", {
                        numeric: true
                    })
                    || firstLine.id - secondLine.id;
            });
    }

    function appendDetail(list, label, value) {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value;
        list.append(term, description);
    }

    function appendSystemStops(card, endpoint, stationIDs) {
        if (endpoint.type !== "system") return;
        const paragraph = document.createElement("p");
        paragraph.className = "system-stops";
        const names = stationIDs.map(stationID => timetable.stations[stationID].name);
        paragraph.textContent = stationIDs.length === 1
            ? endpoint.name + ": zastavuje ve stanici " + names[0]
            : endpoint.name + ": zastavuje v " + String(stationIDs.length)
                + " stanicích — " + names.join(", ");
        card.appendChild(paragraph);
    }

    function renderResult(result, first, second) {
        const line = result.line;
        const card = document.createElement("article");
        card.className = "line-result";
        const heading = document.createElement("h2");
        heading.textContent = getLineName(line);
        card.appendChild(heading);

        const details = document.createElement("dl");
        details.className = "line-details";
        appendDetail(details, "ID linky", String(line.id));
        appendDetail(details, "Společnost", line.company);
        appendDetail(details, "Interval", formatInterval(line.interval));
        appendDetail(details, "Výchozí stanice", timetable.stations[line.stops[0].sid].name);
        appendDetail(
            details,
            "Konečná stanice",
            timetable.stations[line.stops[line.stops.length - 1].sid].name
        );
        card.appendChild(details);
        appendSystemStops(card, first, result.firstStops);
        appendSystemStops(card, second, result.secondStops);
        const intermediateStops = document.createElement("p");
        intermediateStops.className = "intermediate-stops";
        const intermediateNames = result.intermediateStationIDs
            .map(stationID => timetable.stations[stationID].name);
        intermediateStops.textContent = intermediateNames.length > 0
            ? "Mezistanice: " + intermediateNames.join(" → ")
            : "Mezistanice: žádné";
        card.appendChild(intermediateStops);
        return card;
    }

    function renderIntervalSummary(results) {
        const summary = document.createElement("section");
        summary.className = "interval-summary";
        const intervals = document.createElement("p");
        intervals.textContent = "Intervaly: " + results
            .map(result => getLineName(result.line) + " — "
                + formatInterval(result.line.interval))
            .join("; ");
        const combinedFrequency = results.reduce(
            (frequency, result) => frequency + 1 / result.line.interval,
            0
        );
        const average = document.createElement("p");
        average.textContent = "Průměrný interval mezi vlaky: "
            + formatInterval(1 / combinedFrequency);
        summary.append(intervals, average);
        return summary;
    }

    function search() {
        const status = document.querySelector("#_linefinderstatus");
        const resultsElement = document.querySelector("#_linefinderresults");
        status.className = "";
        resultsElement.replaceChildren();

        const first = readEndpoint("first");
        const second = readEndpoint("second");
        if (first === null || second === null) {
            status.className = "error";
            status.textContent = "Vyberte oba body ze seznamu nabízených možností.";
            return;
        }
        if (first.type === second.type && first.id === second.id) {
            status.className = "error";
            status.textContent = "Vyberte dva různé body.";
            return;
        }

        const results = findConnectingLines(first, second);
        status.textContent = "Nalezeno linek: " + String(results.length);
        if (results.length > 0) {
            resultsElement.appendChild(renderIntervalSummary(results));
        }
        results.forEach(result => {
            resultsElement.appendChild(renderResult(result, first, second));
        });
    }

    function initialize() {
        ["first", "second"].forEach(endpointName => {
            document.querySelector("#_" + endpointName + "type").addEventListener(
                "change",
                () => renderOptions(endpointName)
            );
            renderOptions(endpointName);
        });
        document.querySelector("#_findlines").addEventListener("click", search);
    }

    return { findConnectingLines, initialize };
})();

document.addEventListener("DOMContentLoaded", psLineFinder.initialize);
