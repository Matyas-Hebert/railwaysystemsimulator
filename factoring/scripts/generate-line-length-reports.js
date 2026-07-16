const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP_DIRECTORY = path.resolve(__dirname, "..");
const TIMETABLE_PATH = path.join(APP_DIRECTORY, "json", "timetable_data.js");
const OUTPUT_DIRECTORY = path.join(APP_DIRECTORY, "reports", "line-lengths");
const TRAIN_TYPE_NAMES = Object.freeze(["Ps", "Os", "Sp", "R", "Sh", "EC"]);

function loadTimetable() {
    const source = fs.readFileSync(TIMETABLE_PATH, "utf8");
    const context = {};
    vm.createContext(context);
    vm.runInContext(source + ";globalThis.__timetable = timetable;", context);
    return context.__timetable;
}

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const remainingSeconds = seconds % 60;
    return [hours, minutes, remainingSeconds]
        .map(value => String(value).padStart(2, "0"))
        .join(":");
}

function getLineMetrics(line, stations) {
    const firstStop = line.stops[0];
    const lastStop = line.stops[line.stops.length - 1];
    const distanceKm = line.stops.reduce(
        (total, stop) => total + (Number(stop.dist) || 0),
        0
    );
    const durationSeconds = Math.max(0, lastStop.arr - firstStop.dep);
    return {
        line,
        distanceKm,
        durationSeconds,
        origin: stations[firstStop.sid]?.name ?? `Stanice ${firstStop.sid}`,
        destination: stations[lastStop.sid]?.name ?? `Stanice ${lastStop.sid}`
    };
}

function formatEntry(entry, rank, typeName) {
    const nickname = entry.line.nickname ? ` — ${entry.line.nickname}` : "";
    return [
        `${String(rank).padStart(4, " ")}. ${typeName} ${entry.line.number}${nickname}`,
        `      Dopravce: ${entry.line.company} | ID linky: ${entry.line.id}`,
        `      Trasa: ${entry.origin} → ${entry.destination}`,
        `      Délka: ${entry.distanceKm.toFixed(2)} km | Jízdní doba: ${formatDuration(entry.durationSeconds)}`
    ].join("\n");
}

function createReport(entries, typeName, sortLabel) {
    const separator = "=".repeat(88);
    const header = [
        separator,
        `LINKY TYPU ${typeName} — ${sortLabel}`,
        `Počet linek: ${entries.length} | Řazení: od nejdelší po nejkratší`,
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
            .map(line => getLineMetrics(line, timetable.stations));

        const byDistance = [...entries].sort((a, b) =>
            b.distanceKm - a.distanceKm
            || b.durationSeconds - a.durationSeconds
            || a.line.id - b.line.id
        );
        const byDuration = [...entries].sort((a, b) =>
            b.durationSeconds - a.durationSeconds
            || b.distanceKm - a.distanceKm
            || a.line.id - b.line.id
        );

        fs.writeFileSync(
            path.join(OUTPUT_DIRECTORY, `${typeName}-podle-km.txt`),
            createReport(byDistance, typeName, "PODLE VZDÁLENOSTI"),
            "utf8"
        );
        fs.writeFileSync(
            path.join(OUTPUT_DIRECTORY, `${typeName}-podle-casu.txt`),
            createReport(byDuration, typeName, "PODLE JÍZDNÍ DOBY"),
            "utf8"
        );
    });
}

writeReports();
