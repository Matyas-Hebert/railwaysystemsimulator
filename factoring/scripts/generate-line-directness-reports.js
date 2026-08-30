const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP_DIRECTORY = path.resolve(__dirname, "..");
const TIMETABLE_PATH = path.join(APP_DIRECTORY, "json", "timetable_data.js");
const OUTPUT_DIRECTORY = path.join(APP_DIRECTORY, "reports", "line-directness");
const LINE_TYPE_CONFIG_PATH = path.join(APP_DIRECTORY, "config", "line-types.json");
const EARTH_RADIUS_KM = 6371;
const TRAIN_TYPE_NAMES = Object.freeze(
    JSON.parse(fs.readFileSync(LINE_TYPE_CONFIG_PATH, "utf8")).map(type => type.code)
);

function loadTimetable() {
    const source = fs.readFileSync(TIMETABLE_PATH, "utf8");
    const context = {};
    vm.createContext(context);
    vm.runInContext(source + ";globalThis.__timetable = timetable;", context);
    return context.__timetable;
}

function getStraightLineDistance(firstStation, secondStation) {
    const toRadians = degrees => degrees * Math.PI / 180;
    const latitudeDifference = toRadians(secondStation.lat - firstStation.lat);
    const longitudeDifference = toRadians(secondStation.lon - firstStation.lon);
    const firstLatitude = toRadians(firstStation.lat);
    const secondLatitude = toRadians(secondStation.lat);
    const haversine = Math.sin(latitudeDifference / 2) ** 2
        + Math.cos(firstLatitude) * Math.cos(secondLatitude)
            * Math.sin(longitudeDifference / 2) ** 2;
    return EARTH_RADIUS_KM * 2
        * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getLineMetrics(line, stations) {
    const firstStop = line.stops[0];
    const lastStop = line.stops[line.stops.length - 1];
    const origin = stations[firstStop.sid];
    const destination = stations[lastStop.sid];
    const routeDistanceKm = line.stops.reduce(
        (total, stop) => total + (Number(stop.dist) || 0),
        0
    );
    const directDistanceKm = getStraightLineDistance(origin, destination);
    return {
        line,
        routeDistanceKm,
        directDistanceKm,
        directnessRatio: routeDistanceKm > 0
            ? directDistanceKm / routeDistanceKm
            : null,
        origin: origin?.name ?? `Stanice ${firstStop.sid}`,
        destination: destination?.name ?? `Stanice ${lastStop.sid}`
    };
}

function formatRatio(ratio) {
    if (ratio === null) return "nelze vypočítat";
    return `${ratio.toFixed(4)} (${(ratio * 100).toFixed(2)} %)`;
}

function formatEntry(entry, rank, typeName) {
    const nickname = entry.line.nickname ? ` — ${entry.line.nickname}` : "";
    return [
        `${String(rank).padStart(4, " ")}. ${typeName} ${entry.line.number}${nickname}`,
        `      Dopravce: ${entry.line.company} | ID linky: ${entry.line.id}`,
        `      Trasa: ${entry.origin} → ${entry.destination}`,
        `      Délka linky: ${entry.routeDistanceKm.toFixed(2)} km | Přímá vzdálenost: ${entry.directDistanceKm.toFixed(2)} km`,
        `      Poměr přímé vzdálenosti k délce: ${formatRatio(entry.directnessRatio)}`
    ].join("\n");
}

function createReport(entries, typeName) {
    const separator = "=".repeat(96);
    const header = [
        separator,
        `LINKY TYPU ${typeName} — POMĚR PŘÍMÉ VZDÁLENOSTI K DÉLCE LINKY`,
        `Počet linek: ${entries.length} | Řazení: od nejvyššího poměru po nejnižší`,
        separator,
        ""
    ].join("\n");
    const body = entries
        .map((entry, index) => formatEntry(entry, index + 1, typeName))
        .join("\n\n");
    return header + body + "\n";
}

function writeReports() {
    const timetable = loadTimetable();
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

    TRAIN_TYPE_NAMES.forEach((typeName, type) => {
        const entries = timetable.lines
            .filter(line => line.type === type)
            .map(line => getLineMetrics(line, timetable.stations))
            .sort((first, second) => {
                if (first.directnessRatio === null
                    && second.directnessRatio === null) {
                    return first.line.id - second.line.id;
                }
                if (first.directnessRatio === null) return 1;
                if (second.directnessRatio === null) return -1;
                return second.directnessRatio - first.directnessRatio
                    || second.routeDistanceKm - first.routeDistanceKm
                    || first.line.id - second.line.id;
            });

        fs.writeFileSync(
            path.join(OUTPUT_DIRECTORY, `${typeName}-podle-pomeru.txt`),
            createReport(entries, typeName),
            "utf8"
        );
    });
}

writeReports();
