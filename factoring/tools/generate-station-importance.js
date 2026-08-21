const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ITERATIONS = 10;
const ITERATION_INFLUENCE = 0.35;
const STOP_DECAY = 0.9;
const SCORE_SPREAD_POWER = 3;
const BASE_IMPORTANCE = 1;
const { PS, OS } = require("../config/line-type-constants");
const APP_DIRECTORY = path.resolve(__dirname, "..");
const TIMETABLE_PATH = path.join(APP_DIRECTORY, "json", "timetable_data.js");
const OUTPUT_PATH = path.join(APP_DIRECTORY, "reports", "station-importance.txt");
const LINE_TYPE_CONFIG_PATH = path.join(APP_DIRECTORY, "config", "line-types.json");
const LINE_TYPE_CONFIG = JSON.parse(fs.readFileSync(LINE_TYPE_CONFIG_PATH, "utf8"));
const LINE_TYPES = Object.freeze(LINE_TYPE_CONFIG);
const TRAIN_TYPE_IMPORTANCE = Object.freeze(
    LINE_TYPES.map(type => type.stationImportance)
);
const IMPORTANCE_WITHOUT_PS_OS = Object.freeze(
    LINE_TYPES.map(type => type.id === PS || type.id === OS
        ? 0
        : type.stationImportance)
);

function loadTimetable() {
    const source = fs.readFileSync(TIMETABLE_PATH, "utf8");
    const context = {};
    vm.createContext(context);
    vm.runInContext(source + ";globalThis.__timetable = timetable;", context);
    return context.__timetable;
}

function validateTimetable(timetable) {
    if (!Array.isArray(timetable?.stations) || !Array.isArray(timetable?.lines)) throw new Error("Timetable must contain stations and lines arrays.");
    timetable.lines.forEach(line => {
        if (!Array.isArray(line.stops)) throw new Error(`Line ${line.id} does not contain a stops array.`);
        if (!Number.isFinite(line.interval) || line.interval <= 0) throw new Error(`Line ${line.id} has an invalid interval.`);
    });
}

function calculateStationImportance(timetable, typeWeights) {
    let importance = timetable.stations.map(() => BASE_IMPORTANCE);
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const propagated = timetable.stations.map(() => 0);
        timetable.lines.forEach(line => {
            const frequency = 3600 / line.interval;
            const typeImportance = typeWeights[line.type] ?? 0;
            const lineWeight = typeImportance * frequency;
            let upcomingImportance = 0;
            for (let stopIndex = line.stops.length - 1; stopIndex >= 0; stopIndex--) {
                const stationID = line.stops[stopIndex].sid;
                propagated[stationID] += upcomingImportance * lineWeight;
                upcomingImportance = importance[stationID] + STOP_DECAY * upcomingImportance;
            }
        });
        const averagePropagated = propagated.reduce((total, value) => total + value, 0) / propagated.length;
        const normalizedPropagated = averagePropagated === 0 ? propagated.map(() => BASE_IMPORTANCE) : propagated.map(value => value / averagePropagated);
        importance = normalizedPropagated.map(value => (1 - ITERATION_INFLUENCE) * BASE_IMPORTANCE + ITERATION_INFLUENCE * value);
    }
    return importance;
}

function getRanks(importance) {
    const stationIDs = importance.map((_, stationID) => stationID);
    stationIDs.sort((a, b) => importance[b] - importance[a] || a - b);
    const ranks = [];
    stationIDs.forEach((stationID, index) => { ranks[stationID] = index + 1; });
    return ranks;
}

function spreadImportanceScores(importance) {
    const spreadScores = importance.map(value => value ** SCORE_SPREAD_POWER);
    const averageScore = spreadScores.reduce((total, value) => total + value, 0)
        / spreadScores.length;
    return spreadScores.map(value => value / averageScore);
}

function createReport(timetable, allImportance, importanceWithoutPsOs) {
    const allRanks = getRanks(allImportance);
    const withoutRanks = getRanks(importanceWithoutPsOs);
    const rankedStations = timetable.stations.map((station, stationID) => ({ station, stationID })).sort((a, b) => allImportance[b.stationID] - allImportance[a.stationID] || a.station.name.localeCompare(b.station.name, "cs") || a.stationID - b.stationID);
    const weights = LINE_TYPES
        .map(type => `${type.code}=${type.stationImportance}`)
        .join(", ");
    const separator = "=".repeat(130);
    const header = [
        separator,
        "STATION IMPORTANCE - WEIGHTED, DAMPED AND STOP-DECAYED",
        `Stations: ${rankedStations.length} | Iterations: ${ITERATIONS}`,
        `Iteration influence: ${ITERATION_INFLUENCE} | Stop decay: ${STOP_DECAY}`,
        `Final score spread power: ${SCORE_SPREAD_POWER}`,
        `Weights: ${weights}`,
        "The no-Ps/Os score is a separately normalized run. Compare its rank and score, but do not treat the score difference as a literal contribution percentage.",
        separator,
        ""
    ];
    const rows = rankedStations.map(({ station, stationID }, index) => {
        const district = station.district || "No district";
        const all = allImportance[stationID];
        const without = importanceWithoutPsOs[stationID];
        const rankDifference = allRanks[stationID] - withoutRanks[stationID];
        const rankMovement = rankDifference > 0
            ? `up ${rankDifference}`
            : rankDifference < 0
                ? `down ${Math.abs(rankDifference)}`
                : "unchanged";
        return `${String(index + 1).padStart(5)}. ${station.name} [${district}] | ID: ${stationID}\n       all lines: ${all.toFixed(8)} | without Ps/Os: ${without.toFixed(8)} | without Ps/Os rank: ${withoutRanks[stationID]} | movement: ${rankMovement}`;
    });
    return [...header, ...rows, ""].join("\n");
}

function assignStationImportance(timetable) {
    validateTimetable(timetable);
    const allImportance = spreadImportanceScores(
        calculateStationImportance(timetable, TRAIN_TYPE_IMPORTANCE)
    );
    timetable.stations.forEach((station, stationID) => {
        station.importance = allImportance[stationID];
    });
    return allImportance;
}

function generateReport() {
    const timetable = loadTimetable();
    const allImportance = assignStationImportance(timetable);
    const importanceWithoutPsOs = spreadImportanceScores(
        calculateStationImportance(timetable, IMPORTANCE_WITHOUT_PS_OS)
    );
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, createReport(timetable, allImportance, importanceWithoutPsOs), "utf8");
    console.log(`Written ${OUTPUT_PATH}`);
}

module.exports = { assignStationImportance, generateReport };

if (require.main === module) {
    generateReport();
}