const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP_DIRECTORY = path.resolve(__dirname, "..");
const TIMETABLE_PATH = path.join(APP_DIRECTORY, "json", "timetable_data.js");
const LINE_TYPE_CONFIG_PATH = path.join(APP_DIRECTORY, "config", "line-types.json");
const JSON_OUTPUT_PATH = path.join(APP_DIRECTORY, "json", "ps-systems.json");
const JS_OUTPUT_PATH = path.join(APP_DIRECTORY, "json", "ps-systems.js");

function loadTimetable() {
    const source = fs.readFileSync(TIMETABLE_PATH, "utf8");
    const context = {};
    vm.createContext(context);
    vm.runInContext(source + ";globalThis.__timetable = timetable;", context);
    return context.__timetable;
}

function getPsTypeID() {
    const config = JSON.parse(fs.readFileSync(LINE_TYPE_CONFIG_PATH, "utf8"));
    const psType = config.types.find(type => type.code === "Ps");
    if (!psType) throw new Error("The line type configuration does not contain Ps.");
    return psType.id;
}

function validateTimetable(timetable) {
    if (!Array.isArray(timetable?.stations) || !Array.isArray(timetable?.lines)) {
        throw new TypeError("Timetable must contain stations and lines arrays.");
    }
    timetable.lines.forEach((line, lineIndex) => {
        if (!Array.isArray(line.stops) || line.stops.length === 0) {
            throw new TypeError(`Line ${line.id ?? lineIndex} has no stops.`);
        }
        line.stops.forEach(stop => {
            if (!Number.isInteger(stop.sid) || !timetable.stations[stop.sid]) {
                throw new TypeError(`Line ${line.id ?? lineIndex} has an invalid station ID.`);
            }
        });
    });
}

function createDisjointSet(size) {
    const parent = Array.from({ length: size }, (_, index) => index);
    const rank = new Uint8Array(size);

    function find(value) {
        let root = value;
        while (parent[root] !== root) root = parent[root];
        while (parent[value] !== value) {
            const next = parent[value];
            parent[value] = root;
            value = next;
        }
        return root;
    }

    function union(first, second) {
        let firstRoot = find(first);
        let secondRoot = find(second);
        if (firstRoot === secondRoot) return;
        if (rank[firstRoot] < rank[secondRoot]) {
            [firstRoot, secondRoot] = [secondRoot, firstRoot];
        }
        parent[secondRoot] = firstRoot;
        if (rank[firstRoot] === rank[secondRoot]) rank[firstRoot]++;
    }

    return { find, union };
}

function getSystemName(stationIDs, stations) {
    const prefixCounts = new Map();
    stationIDs.forEach(stationID => {
        const stationName = stations[stationID].name;
        const separatorIndex = stationName.indexOf("-");
        if (separatorIndex === -1) return;
        const prefix = stationName.slice(0, separatorIndex).trim();
        if (prefix.length === 0) return;
        prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
    });

    const cities = [...prefixCounts.entries()]
        .filter(([, count]) => count >= 2)
        .sort((first, second) => second[1] - first[1]
            || first[0].localeCompare(second[0], "cs"))
        .map(([city]) => city);

    if (cities.length > 0) return cities.join("-") + " System";
    const fallbackStation = stationIDs
        .map(stationID => stations[stationID].name)
        .sort((first, second) => first.localeCompare(second, "cs"))[0];
    return fallbackStation + " System";
}

function generatePsSystems(timetable, psTypeID) {
    validateTimetable(timetable);
    const psLines = timetable.lines.filter(line => line.type === psTypeID);
    const disjointSet = createDisjointSet(timetable.stations.length);
    const psStationIDs = new Set();

    psLines.forEach(line => {
        line.stops.forEach((stop, index) => {
            psStationIDs.add(stop.sid);
            if (index > 0) disjointSet.union(line.stops[index - 1].sid, stop.sid);
        });
    });

    const systemsByRoot = new Map();
    psStationIDs.forEach(stationID => {
        const root = disjointSet.find(stationID);
        if (!systemsByRoot.has(root)) {
            systemsByRoot.set(root, { stationIDs: [], lineIDs: [] });
        }
        systemsByRoot.get(root).stationIDs.push(stationID);
    });

    psLines.forEach((line, lineIndex) => {
        const root = disjointSet.find(line.stops[0].sid);
        systemsByRoot.get(root).lineIDs.push(line.id ?? lineIndex);
    });

    return [...systemsByRoot.values()]
        .map(system => {
            system.stationIDs.sort((first, second) => first - second);
            system.lineIDs.sort((first, second) => first - second);
            return {
                name: getSystemName(system.stationIDs, timetable.stations),
                stationIDs: system.stationIDs,
                lineIDs: system.lineIDs
            };
        })
        .sort((first, second) => first.name.localeCompare(second.name, "cs")
            || first.stationIDs[0] - second.stationIDs[0]);
}

function assignPsSystemIDs(timetable, systems) {
    timetable.stations.forEach(station => delete station.psSystemID);
    systems.forEach((system, systemID) => {
        system.stationIDs.forEach(stationID => {
            const station = timetable.stations[stationID];
            if (!station) {
                throw new Error(
                    "Ps system "+String(systemID)+" contains station "
                        +String(stationID)+", which does not exist."
                );
            }
            if (station.psSystemID !== undefined) {
                throw new Error(
                    "Station "+String(stationID)+" belongs to more than one Ps system."
                );
            }
            station.psSystemID = systemID;
        });
    });
}

function writePsSystems() {
    const timetable = loadTimetable();
    const systems = generatePsSystems(timetable, getPsTypeID());
    const json = JSON.stringify(systems, null, 2);
    fs.writeFileSync(JSON_OUTPUT_PATH, json + "\n", "utf8");
    fs.writeFileSync(JS_OUTPUT_PATH, "const psSystems = " + json + ";\n", "utf8");
    console.log(`Written ${systems.length} Ps systems to ${JSON_OUTPUT_PATH}`);
    return systems;
}

if (require.main === module) writePsSystems();

module.exports = { assignPsSystemIDs, generatePsSystems, writePsSystems };
