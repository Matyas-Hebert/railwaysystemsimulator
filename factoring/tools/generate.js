const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { promises as fs } from 'node:fs';
import path from 'node:path';
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { generateDistrictBorders } from './generate-district-borders.js';
import { assignPsSystemIDs, generatePsSystems } from './generate-ps-systems.js';
import { assignStationImportance } from './generate-station-importance.js';
import { dataOperators } from '../generated/config.js';
import * as constants from "../src/constants.js";
let PS, PX, OS, OX, SP, R, SH, IC, EC, NJ, AR, AJ;

let lineTypeConfig;
let journeyPricingConfig;


async function loadTestJson() {
    const filePath = path.join(__dirname, '../../json/metronew.json');
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

function parseTimingRule(expression) {
    const ustMatch = expression.match(/^([><]?)\[(\d+)\]=(\d+)$/);
    if (ustMatch !== null) {
        return {
            direction: ustMatch[1] || "both",
            stationIndex: Number.parseInt(ustMatch[2], 10),
            source: {
                type: "ust",
                offsetMinutes: Number.parseInt(ustMatch[3], 10)
            }
        };
    }

    const referenceMatch = expression.match(
        /^([><]?)\[(\d+)\]=([A-Za-z][A-Za-z0-9_-]*)([><]?)\[(\d+)\](?:([+-])(\d+))?$/
    );
    if (referenceMatch === null) return null;

    const offset = Number.parseInt(referenceMatch[7] || "0", 10);
    return {
        direction: referenceMatch[1] || "both",
        stationIndex: Number.parseInt(referenceMatch[2], 10),
        source: {
            type: "line",
            code: referenceMatch[3],
            direction: referenceMatch[4] || null,
            stationIndex: Number.parseInt(referenceMatch[5], 10),
            offsetMinutes: referenceMatch[6] === "-" ? -offset : offset
        }
    };
}

function parseTimingConfig(value, lineName) {
    if (typeof value !== "string" || value.trim() === "") {
        return { code: null, timingRules: [] };
    }

    const sections = value.split(";").map(section => section.trim());
    const codePattern = /^code=([A-Za-z][A-Za-z0-9_-]*)$/;
    const containsValidDirective = sections.some((section, index) =>
        index === 0
            ? codePattern.test(section)
            : parseTimingRule(section) !== null
    );

    if (!containsValidDirective) {
        return { code: null, timingRules: [] };
    }
    if (sections.length !== 3) {
        throw new Error(
            "Timing configuration must contain exactly three semicolon-separated sections on line "
            + lineName
        );
    }

    let code = null;
    if (sections[0] !== "") {
        const codeMatch = sections[0].match(codePattern);
        if (codeMatch === null) {
            throw new Error("Invalid line code configuration on line " + lineName);
        }
        code = codeMatch[1];
    }

    const timingRules = sections.slice(1).filter(Boolean).map(section => {
        const rule = parseTimingRule(section);
        if (rule === null) {
            throw new Error(
                "Invalid timing rule \"" + section + "\" on line " + lineName
            );
        }
        return rule;
    });

    const configuredDirections = new Set();
    for (const rule of timingRules) {
        if (rule.direction === "both") {
            if (configuredDirections.size > 0 || timingRules.length > 1) {
                throw new Error(
                    "A bidirectional timing rule cannot be combined with another rule on line "
                    + lineName
                );
            }
            if (rule.source.type === "line"
                && rule.source.direction !== null) {
                throw new Error(
                    "A bidirectional rule must use a bidirectional line reference on line "
                    + lineName
                );
            }
            configuredDirections.add(">");
            configuredDirections.add("<");
            continue;
        }

        if (configuredDirections.has(rule.direction)) {
            throw new Error(
                "Direction " + rule.direction
                + " has more than one timing rule on line " + lineName
            );
        }
        configuredDirections.add(rule.direction);
    }

    return { code, timingRules };
}

function parseLineName(name){
    //"[ZSSK] R 0160b (2) | Bílá Paní | 72 | code=BREZNO;>[0]=0;<[5]=0 | Brezno-Ilava |"
    const parts = name.split('|').map(item => item.trim());
    const part1parts = parts[0].split(' ').map(item => item.trim());
    const writtenType = part1parts[1];
    const shorteningDisabled = writtenType.startsWith("u");
    const intervalParts = parts[2].split("+");
    const timingConfig = parseTimingConfig(parts[3] || "", name);
    let companynumber = "";

    let data = {
        "company": part1parts[0].substring(1, part1parts[0].length-1),
        "type": shorteningDisabled ? writtenType.slice(1) : writtenType,
        "number": part1parts[2],
        "interval": parseInt(intervalParts[0])*60,
        "timingRules": timingConfig.timingRules
    }

    if (timingConfig.code !== null) {
        data.code = timingConfig.code;
    }

    if (intervalParts.length > 1) {
        data.offset = parseInt(intervalParts[1]) * 60;
    }
    if (data.offset !== undefined && data.timingRules.length > 0) {
        throw new Error(
            "Legacy interval offset and fourth-field timing cannot be combined on line "
            + name
        );
    }

    if (shorteningDisabled) {
        data.shorteningDisabled = true;
    }

    if (part1parts.length >= 4){
        companynumber = part1parts[3].substring(1, part1parts[3].length-1) || "";
        data["companynumber"] = companynumber;
    }
    if (parts[1] != ""){
        data["nickname"] = parts[1];
    }
    return data;
}

function getStartTime() {
    return 13200 + Math.round(Math.random()*6600);
}

function getTrips(startTime, interval, traintype){
    let randomEnd = 21*3600 + Math.floor(Math.random() * (23*3600-21*3600));
    if (interval > 40*60){
        randomEnd += Math.floor(Math.random() * (5400));
    }
    if (traintype == AR || traintype == AJ) {
        randomEnd = 86400;
    }

    const availableTime = randomEnd - startTime;
    return Math.ceil(availableTime / interval);
}

function resolveLineStartTimes(
    lines,
    schedulingDefinitions,
    universalStartTime
) {
    const linesByCode = new Map();
    const definitionByLineId = new Map();
    const timingRuleByLineId = new Map();

    for (const definition of schedulingDefinitions) {
        definitionByLineId.set(definition.forwardLineId, definition);
        definitionByLineId.set(definition.reverseLineId, definition);

        if (definition.code !== null) {
            if (linesByCode.has(definition.code)) {
                throw new Error("Duplicate line timing code " + definition.code);
            }
            linesByCode.set(definition.code, definition);
        }

        for (const rule of definition.timingRules) {
            const directions = rule.direction === "both"
                ? [">", "<"]
                : [rule.direction];
            for (const direction of directions) {
                const lineId = direction === ">"
                    ? definition.forwardLineId
                    : definition.reverseLineId;
                timingRuleByLineId.set(lineId, {
                    ...rule,
                    direction
                });
            }
        }
    }

    function getLineIdForDirection(definition, direction) {
        return direction === ">"
            ? definition.forwardLineId
            : definition.reverseLineId;
    }

    function getStop(lineId, originalStopIndex, context) {
        const line = lines[lineId];
        if (!Number.isInteger(originalStopIndex)
            || originalStopIndex < 0
            || originalStopIndex >= line.stops.length) {
            throw new Error(
                "Invalid timetable stop index [" + originalStopIndex
                + "] in " + context
            );
        }

        const directionalStopIndex = lineId % 2 === 0
            ? originalStopIndex
            : line.stops.length - 1 - originalStopIndex;
        return line.stops[directionalStopIndex];
    }

    function getLineLabel(lineId) {
        const line = lines[lineId];
        return (line.code || line.number)
            + (lineId % 2 === 0 ? ">" : "<");
    }

    const resolving = [];
    const resolved = new Set();

    function resolve(lineId) {
        if (resolved.has(lineId)) return;
        const cycleIndex = resolving.indexOf(lineId);
        if (cycleIndex !== -1) {
            const cycle = [...resolving.slice(cycleIndex), lineId]
                .map(getLineLabel)
                .join(" -> ");
            throw new Error("Circular timing dependency: " + cycle);
        }

        resolving.push(lineId);
        const line = lines[lineId];
        const definition = definitionByLineId.get(lineId);
        const rule = timingRuleByLineId.get(lineId);

        if (rule === undefined) {
            if (definition.legacyOffset === undefined) {
                line.starttime = getStartTime();
            }
            else if (lineId === definition.forwardLineId) {
                line.starttime = universalStartTime + definition.legacyOffset;
            }
            else {
                const originalFirstStop = getStop(
                    lineId,
                    0,
                    "legacy timing for " + definition.sourceName
                );
                line.starttime = universalStartTime
                    + definition.legacyOffset
                    - originalFirstStop.dep;
            }
        }
        else {
            let desiredDeparture;
            if (rule.source.type === "ust") {
                desiredDeparture = universalStartTime
                    + rule.source.offsetMinutes * 60;
            }
            else {
                const referencedDefinition = linesByCode.get(rule.source.code);
                if (referencedDefinition === undefined) {
                    throw new Error(
                        "Unknown line timing code " + rule.source.code
                        + " referenced by " + definition.sourceName
                    );
                }

                const referenceDirection = rule.source.direction
                    || rule.direction;
                const referencedLineId = getLineIdForDirection(
                    referencedDefinition,
                    referenceDirection
                );
                resolve(referencedLineId);
                const referencedStop = getStop(
                    referencedLineId,
                    rule.source.stationIndex,
                    "reference " + rule.source.code
                    + referenceDirection + " on " + definition.sourceName
                );
                desiredDeparture = lines[referencedLineId].starttime
                    + referencedStop.dep
                    + rule.source.offsetMinutes * 60;
            }

            const ownStop = getStop(
                lineId,
                rule.stationIndex,
                "timing rule for " + definition.sourceName
            );
            line.starttime = desiredDeparture - ownStop.dep;
        }

        resolving.pop();
        resolved.add(lineId);
    }

    lines.forEach((line, lineId) => resolve(lineId));
    lines.forEach((line, lineId) => {
        line.trips = getTrips(line.starttime, line.interval, line.type);
        if (line.trips <= 2) {
            console.log(
                "low trips",
                line.trips,
                "for",
                schedulingDefinitions[Math.floor(lineId / 2)].sourceName,
                line
            );
        }
        delete line.timingRules;
    });
}

function getStopTimeForType(typeId, uvrat=false){
    const typeConfig = lineTypeConfig[typeId];
    return uvrat
        ? typeConfig.uvratStopTimeSeconds
        : typeConfig.stopTimeSeconds;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  //console.log(c, a, dLat, dLon, lat1, lat2, lon1, lon2);
  return R * c; // Distance in km
}

function addClosestStation(closestStations, stationId, distance, limit) {
    const candidate = { stationId, distance };
    const insertIndex = closestStations.findIndex(closest =>
        distance < closest.distance
        || distance === closest.distance && stationId < closest.stationId
    );

    if (insertIndex === -1) {
        closestStations.push(candidate);
    }
    else {
        closestStations.splice(insertIndex, 0, candidate);
    }
    if (closestStations.length > limit) closestStations.pop();
}

function assignClosestStations(stations, limit = 5) {
    const closestStations = stations.map(() => []);
    for (let firstStationId = 0; firstStationId < stations.length; firstStationId++) {
        const firstStation = stations[firstStationId];
        for (
            let secondStationId = firstStationId + 1;
            secondStationId < stations.length;
            secondStationId++
        ) {
            const secondStation = stations[secondStationId];
            const distance = calculateDistance(
                firstStation.lat,
                firstStation.lon,
                secondStation.lat,
                secondStation.lon
            );
            addClosestStation(
                closestStations[firstStationId],
                secondStationId,
                distance,
                limit
            );
            addClosestStation(
                closestStations[secondStationId],
                firstStationId,
                distance,
                limit
            );
        }
    }

    stations.forEach((station, stationId) => {
        station.iwd = closestStations[stationId].map(closest => closest.stationId);
    });
}

function getTimeFromDistanceAndType(distance, typeID){
    // distance [km], distance/acceleration [hours]
    const typeConfig = lineTypeConfig[typeID];
    const maxspeed = typeConfig.maxSpeedKmh;
    const acc = typeConfig.accelerationKmhPerHourSquared;
    const travelTimeOverhead = typeConfig.travelTimeOverheadSeconds ?? 0;
    const criticaldistance = maxspeed*maxspeed/acc;
    if (distance <= criticaldistance){
        return (2*Math.sqrt(distance/acc))*3600 + travelTimeOverhead; // in seconds
    }
    return (distance/maxspeed + maxspeed/acc)*3600 + travelTimeOverhead; // in seconds
}
function getUvratStopIndices(line, map, stationIDtonewID){
    const overrides = line.waypointOverrides || [];
    const uvrat = [];
    let stopIndex = 0;

    line.stationIds.forEach((stationID, stationIndex) => {
        const station = map.stations[stationID];
        const timetableStationID = stationIDtonewID[stationID];

        if (!overrides.includes(stationID)
            && !station.isWaypoint
            && timetableStationID !== undefined){
            const previousStationID = line.stationIds[stationIndex - 1];
            const nextStationID = line.stationIds[stationIndex + 1];

            if (previousStationID != undefined && previousStationID === nextStationID){
                uvrat.push(stopIndex);
            }

            stopIndex++;
        }
    });

    return { uvrat, stopCount: stopIndex };
}


function getLineMetrics(line, map, stationIDtonewID){
    const overrides = line.waypointOverrides || [];
    const segmentDistances = [];
    let totalDistance = 0;
    let distanceSinceLastStop = 0;
    let previousStation;
    let stopCount = 0;

    line.stationIds.forEach(stationID => {
        const station = map.stations[stationID];
        if (previousStation){
            const distance = calculateDistance(
                previousStation.lat,
                previousStation.lng,
                station.lat,
                station.lng
            );
            totalDistance += distance;
            distanceSinceLastStop += distance;
        }

        const timetableStationID = stationIDtonewID[stationID];
        if (!overrides.includes(stationID)
            && !station.isWaypoint
            && timetableStationID !== undefined){
            if (stopCount > 0){
                segmentDistances.push(distanceSinceLastStop);
            }
            distanceSinceLastStop = 0;
            stopCount++;
        }
        previousStation = station;
    });

    return { totalDistance, stopCount, segmentDistances };
}

function getJourneyTimeForType(metrics, uvrat, type){
    let totalTime = 0;
    for (let stopIndex = 0; stopIndex < metrics.stopCount; stopIndex++){
        if (stopIndex > 0){
            totalTime += getTimeFromDistanceAndType(
                metrics.segmentDistances[stopIndex - 1],
                type
            );
        }
        if (stopIndex < metrics.stopCount - 1){
            totalTime += getStopTimeForType(type, uvrat.includes(stopIndex));
        }
    }
    return totalTime;
}

function selectLineType(writtenType, line, metrics, uvrat){
    const type = writtenType.toUpperCase();
    const hasWaypointOverrides = (line.waypointOverrides || []).length > 0;

    if (type === "PS") return hasWaypointOverrides ? PX : PS;
    if (type === "PX") return PX;
    if (type === "OS") return hasWaypointOverrides ? OX : OS;
    if (type === "OX") return OX;
    if (type === "SP" || type === "R"){
        const averageStopDistance = metrics.stopCount > 1
            ? metrics.totalDistance / (metrics.stopCount - 1)
            : 0;
        return averageStopDistance > 15 ? R : SP;
    }
    if (type === "SH") return SH;
    if (type === "IC" || type === "EC"){
        const icTime = getJourneyTimeForType(metrics, uvrat, IC);
        const ecTime = getJourneyTimeForType(metrics, uvrat, EC);
        return icTime <= ecTime ? IC : EC;
    }
    if (type === "NJ") return NJ;
    if (type === "AR") return AR;
    if (type === "AJ") return AJ;

    throw new Error("Unknown train type " + writtenType + " on line " + line.name);
}

function getStationLineIDs(station) {
    return new Set([
        ...station.arrivals,
        ...station.departures
    ]);
}

function getAdjacentStationIDs(station, lines) {
    const adjacentStationIDs = new Set();

    getStationLineIDs(station).forEach(lineID => {
        const stops = lines[lineID]?.stops;
        if (!Array.isArray(stops)) return;

        stops.forEach((stop, stopIndex) => {
            if (stop.sid !== station.id) return;

            if (stopIndex > 0) {
                adjacentStationIDs.add(stops[stopIndex - 1].sid);
            }
            if (stopIndex < stops.length - 1) {
                adjacentStationIDs.add(stops[stopIndex + 1].sid);
            }
        });
    });

    return adjacentStationIDs;
}

function isTransfer(station, stations, lines) {
    const stationLineIDs = getStationLineIDs(station);
    if (stationLineIDs.size <= 2) return false;

    const adjacentStationIDs = getAdjacentStationIDs(station, lines);
    for (const adjacentStationID of adjacentStationIDs) {
        const adjacentStation = stations[adjacentStationID];
        if (!adjacentStation) continue;

        const adjacentLineIDs = getStationLineIDs(adjacentStation);
        const sharedLineCount = [...adjacentLineIDs]
            .filter(lineID => stationLineIDs.has(lineID))
            .length;

        if (sharedLineCount < stationLineIDs.size) return true;
    }

    return false;
}

function getPossibleRoutes(line, stations) {
    const lastStopIndex = line.stops.length - 1;
    const fullRoute = [[0, lastStopIndex]];
    const typeConfig = lineTypeConfig[line.type];

    const distanceFromStart = [0];
    for (let stopIndex = 1; stopIndex <= lastStopIndex; stopIndex++) {
        distanceFromStart[stopIndex] = distanceFromStart[stopIndex - 1]
            + line.stops[stopIndex].dist;
    }

    if (line.shorteningDisabled
        || !typeConfig.canBeShortened
        || distanceFromStart[lastStopIndex] < typeConfig.minimalLength) {
        return fullRoute;
    }

    const endpointIndices = line.stops
        .map((stop, stopIndex) => ({ stop, stopIndex }))
        .filter(({ stop, stopIndex }) => stopIndex === 0
            || stopIndex === lastStopIndex
            || stations[stop.sid].isTransfer)
        .map(({ stopIndex }) => stopIndex);

    const possibleRoutes = [];
    for (let start = 0; start < endpointIndices.length - 1; start++) {
        for (let end = start + 1; end < endpointIndices.length; end++) {
            const startIndex = endpointIndices[start];
            const endIndex = endpointIndices[end];
            const routeLength = distanceFromStart[endIndex] - distanceFromStart[startIndex];
            if (routeLength >= typeConfig.minimalLength) {
                possibleRoutes.push([startIndex, endIndex]);
            }
        }
    }

    return possibleRoutes;
}

function generateRoutesForTrips(timetable) {
    timetable.lines.forEach(line => {
        const lineStationIDs = line.stops.map(stop => stop.sid);
        const routeSelectionImportanceProperty = line.type === PS || line.type === PX
            ? "localRouteSelectionImportance"
            : "routeSelectionImportance";
        line.routes = [];

        if (line.possibleRoutes.length === 0) {
            line.averageShorteningFactor = 1;
            return;
        }

        const distanceFromStart = [0];
        for (let stopIndex = 1; stopIndex < line.stops.length; stopIndex++) {
            distanceFromStart[stopIndex] = distanceFromStart[stopIndex - 1]
                + Number(line.stops[stopIndex].dist);
        }
        const routeDistances = line.possibleRoutes.map(route =>
            distanceFromStart[route[1]] - distanceFromStart[route[0]]
        );
        const fullRouteDistance = distanceFromStart[line.stops.length - 1] ?? 0;

        const routeImportances = line.possibleRoutes.map((route, routeIndex) => {
            const startImportance = timetable.stations[
                lineStationIDs[route[0]]
            ][routeSelectionImportanceProperty];
            const endImportance = timetable.stations[
                lineStationIDs[route[1]]
            ][routeSelectionImportanceProperty];
            const endpointImportanceSum = startImportance + endImportance;
            const endpointScore = endpointImportanceSum > 0
                ? 2 * startImportance * endImportance / endpointImportanceSum
                : 0;

            let interiorImportance = 0;
            let interiorStopCount = 0;
            for (let stopIndex = route[0] + 1; stopIndex < route[1]; stopIndex++) {
                interiorImportance += timetable.stations[
                    lineStationIDs[stopIndex]
                ][routeSelectionImportanceProperty];
                interiorStopCount++;
            }
            const averageInteriorImportance = interiorStopCount > 0
                ? interiorImportance / interiorStopCount
                : 1;
            const lengthRatio = fullRouteDistance > 0
                ? routeDistances[routeIndex] / fullRouteDistance
                : 1;

            return Math.pow(endpointScore, 1.5)
                * Math.pow(averageInteriorImportance, 0.25)
                * (lengthRatio * lengthRatio);
        });
        const totalImportance = routeImportances.reduce(
            (total, importance) => total + importance,
            0
        );

        const routeProbability = routeIndex => totalImportance > 0
            ? routeImportances[routeIndex] / totalImportance
            : 1 / line.possibleRoutes.length;
        const expectedRouteDistance = routeDistances.reduce(
            (expectedDistance, routeDistance, routeIndex) =>
                expectedDistance
                + routeDistance * routeProbability(routeIndex),
            0
        );
        line.averageShorteningFactor = fullRouteDistance > 0
            && expectedRouteDistance > 0
            ? fullRouteDistance / expectedRouteDistance
            : 1;

        const originalServiceDuration = line.interval * line.trips;
        line.interval /= line.averageShorteningFactor;
        line.trips = Math.ceil(originalServiceDuration / line.interval);

        for (let trip = 0; trip < line.trips; trip++) {
            let selectedRoute = 0;
            if (line.possibleRoutes.length > 1) {
                if (totalImportance > 0) {
                    let selection = Math.random() * totalImportance;
                    for (let routeIndex = 0; routeIndex < routeImportances.length; routeIndex++) {
                        selection -= routeImportances[routeIndex];
                        if (selection < 0) {
                            selectedRoute = routeIndex;
                            break;Fsh
                        }
                    }
                }
                else {
                    selectedRoute = Math.floor(Math.random() * line.possibleRoutes.length);
                }
            }
            line.routes.push(selectedRoute);
        }

        if (line.trips > 0) {
            const fullRoute = [0, line.stops.length - 1];
            let fullRouteIndex = line.possibleRoutes.findIndex(route =>
                route[0] === fullRoute[0] && route[1] === fullRoute[1]
            );
            if (fullRouteIndex === -1) {
                line.possibleRoutes.push(fullRoute);
                fullRouteIndex = line.possibleRoutes.length - 1;
            }

            const fullRouteTrip = Math.floor(Math.random() * line.trips);
            line.routes[fullRouteTrip] = fullRouteIndex;
        }

    });
}

function assignStationCountries(stations, districtBorders) {
    const countryByDistrict = new Map(
        districtBorders.map(district => [district.name, district.country])
    );

    stations.forEach(station => {
        const countryPrefix = /^\[([a-z]{2})\]/i.exec(station.name);
        if (countryPrefix !== null) {
            station.country = countryPrefix[1].toUpperCase();
            return;
        }

        const districtCountry = countryByDistrict.get(station.district);
        if (!districtCountry) {
            throw new Error(
                `Cannot assign a country to station ${station.name}: `
                + `district ${station.district} has no country.`
            );
        }
        station.country = districtCountry;
    });
}

async function generateTimeTables() {
    const universalStartTime = getStartTime();
    const lineTypeConfigPath = path.join(__dirname, "../config/line-types.json");
    const journeyPricingConfigPath = path.join(__dirname, "../config/journey-pricing.json");
    lineTypeConfig = JSON.parse(await fs.readFile(lineTypeConfigPath, "utf8"));
    journeyPricingConfig = JSON.parse(await fs.readFile(journeyPricingConfigPath, "utf8"));
    ({ PS, PX, OS, OX, SP, R, SH, IC, EC, NJ, AR, AJ } = Object.fromEntries(
        lineTypeConfig.map(type => [type.code.toUpperCase(), type.id])
    ));
    const dataOperatorConfig = JSON.parse(
        await fs.readFile(path.join(__dirname, "../config/data-operators.json"), "utf8")
    );
    const goods = JSON.parse(
        await fs.readFile(path.join(__dirname, "../config/goods.json"), "utf8") 
    );
    const delayReasons = JSON.parse(
        await fs.readFile(path.join(__dirname, "../config/delay-reasons.json"), "utf8")
    );
    const map = await loadTestJson();

    let stationIDtonewID = {};

    const stations = [];
    const lines = [];

    let i = 0;

    const citydatapath = path.join(__dirname, "../config/capitals-data.json");
    const raw = await fs.readFile(citydatapath, 'utf8');
    const citydata = JSON.parse(raw);

    const districtcount = {};
    const lonlattoid = {};

    Object.values(map.stations).forEach(async (station, stationID) => {
        if (!station.isWaypoint){
            stationIDtonewID[station.id] = i;
            let name = station.name;
            let lon = Math.round(station.lng*10000);
            let lat = Math.round(station.lat*10000);
            let lonlat = String(lon)+String(lat);

            let closest = Infinity;
            let district = undefined;

            citydata.features.forEach(cd => {
                let name = cd.properties.name;
                let coords = cd.geometry.coordinates;

                let distance = calculateDistance(station.lat, station.lng, coords[1], coords[0]);
                if (distance < closest){
                    closest = distance;
                    district = name;
                }
            });

            name = name.replace(" - ", "-");
            name = name.replace("-", " - ");
            stations.push({
                "id": i,
                "iwd": [],
                "name": name,
                "district": district,
                "lat": station.lat,
                "lon": station.lng,
                "lonlat": lonlat,
                "departures": [],
                "arrivals": [],
                "shops": []
            });
            lonlattoid[lonlat] = i;
            if (Object.keys(districtcount).includes(district)){
                districtcount[district]++;
            }
            else{
                districtcount[district] = 1;
            }
            i++;
        }
    });

    assignClosestStations(stations);

    const districtBorders = generateDistrictBorders(stations, citydata);
    assignStationCountries(stations, districtBorders);

    let sortedEntries = Object.entries(districtcount).sort((a, b) => b[1] - a[1]);
    i = 0;
    sortedEntries.forEach(sortedEntry => {
        i++;
        console.log(i, sortedEntry[0], sortedEntry[1]);
    });

    i = 0;
    let stationssections = {};
    const schedulingDefinitions = [];
    Object.values(map.lines).forEach((line, lineID) => {
        const lineinfo = parseLineName(line.name);
        if (!(lineinfo.company in journeyPricingConfig.companies)) {
            console.log(line.name);
            throw new Error("Missing journey pricing configuration for company " + lineinfo.company + ".");
        }
        const { uvrat, stopCount } = getUvratStopIndices(line, map, stationIDtonewID);
        const metrics = getLineMetrics(line, map, stationIDtonewID);
        lineinfo.type = selectLineType(lineinfo.type, line, metrics, uvrat);
        const reverseUvrat = uvrat
            .map(stopIndex => stopCount - 1 - stopIndex)
            .sort((a, b) => a - b);

        lines.push({...lineinfo, uvrat});
        lines.push({...lineinfo, uvrat: reverseUvrat});
        lines[i]["id"] = i;
        lines[i+1]["id"] = i+1;
        lines[i]["stops"] = [];
        lines[i+1]["stops"] = [];
        schedulingDefinitions.push({
            sourceName: line.name,
            code: lineinfo.code || null,
            timingRules: lineinfo.timingRules,
            legacyOffset: lineinfo.offset,
            forwardLineId: i,
            reverseLineId: i + 1
        });

        let isFirstStationOfLine = true;
        let previousStation = null;
        const overrides = line.waypointOverrides || [];
        let totaltime = 0;
        let distanceacc = 0;
        let lastlat;
        let lastlon;
        let j = 0;
        line.stationIds.forEach(stationID => {
            let station = map.stations[stationID];
            if (!isFirstStationOfLine){
                distanceacc += calculateDistance(lastlat, lastlon, station.lat, station.lng);
            }
            lastlat = station.lat;
            lastlon = station.lng;
            const timetableStationID = stationIDtonewID[stationID];
            if (!overrides.includes(stationID)
                && !station.isWaypoint
                && timetableStationID !== undefined){
                let isuvrat = uvrat.includes(j);
                if (isuvrat){
                    console.log(station.name, "is uvrat");
                }
                if (previousStation != null){
                    stations[stationIDtonewID[previousStation]].departures.push(i);
                    stations[stationIDtonewID[previousStation]].arrivals.push(i+1);
                }
                if (!isFirstStationOfLine){
                    totaltime += getTimeFromDistanceAndType(distanceacc, lineinfo.type);
                    lines[i]["stops"].push({
                        "sid": stationIDtonewID[stationID], "arr": Math.round(totaltime), "dep": Math.round(totaltime+=getStopTimeForType(lineinfo.type, isuvrat)), "dist": distanceacc
                    });
                    stations[stationIDtonewID[stationID]].arrivals.push(i);
                    stations[stationIDtonewID[stationID]].departures.push(i+1);
                    distanceacc = 0;
                }
                else{
                    totaltime += getStopTimeForType(lineinfo.type, isuvrat);
                    lines[i]["orig"] = stationIDtonewID[stationID];
                    lines[i]["stops"].push({
                        "sid": stationIDtonewID[stationID], "arr": 0, "dep": Math.round(totaltime), "dist": distanceacc
                    });
                }
                previousStation = stationID;
                isFirstStationOfLine = false;
                j++;
            }
        });
        lines[i]["dest"] = lines[i]["stops"][lines[i]["stops"].length-1].sid;
        let prevdist = 0;
        lines[i]["stops"].toReversed().forEach(stop => {
            lines[i+1]["stops"].push({
                "sid": stop.sid, "arr": Math.round(totaltime-stop.dep), "dep": Math.round(totaltime-stop.arr), "dist": prevdist
            });
            prevdist = stop.dist;
        });
        lines[i+1]["orig"] = lines[i]["dest"];
        lines[i+1]["dest"] = lines[i]["orig"];
        i+=2;
    });

    resolveLineStartTimes(
        lines,
        schedulingDefinitions,
        universalStartTime
    );

    stations.forEach(station => {
        station.isTransfer = isTransfer(station, stations, lines);
    });
    lines.forEach(line => {
        line.possibleRoutes = getPossibleRoutes(line, stations);
        delete line.shorteningDisabled;
    });

    let timetable = {"lines": lines, "stations": stations};
    assignStationImportance(timetable, {
        routeAware: false,
        property: "routeSelectionImportance"
    });
    assignStationImportance(timetable, {
        routeAware: false,
        property: "localRouteSelectionImportance",
        typeImportanceProperty: "localRouteImportance"
    });

    generateRoutesForTrips(timetable);
    assignStationImportance(timetable);

    const psSystems = generatePsSystems(timetable);
    assignPsSystemIDs(timetable, psSystems);

    //console.log(JSON.stringify(timetable, null, "\t"));
    const trainTypeIds = Object.fromEntries(
        lineTypeConfig.map(type => [type.code.toUpperCase(), type.id])
    );
    const browserConfig = [
        "export const lineTypes = " + JSON.stringify(lineTypeConfig) + ";",
        "export const trainTypeIds = " + JSON.stringify(trainTypeIds) + ";",
        "export const journeyPricing = " + JSON.stringify(journeyPricingConfig) + ";",
        "export const dataOperators = " + JSON.stringify(dataOperatorConfig) + ";",
        "export const goods = " + JSON.stringify(goods) + ";",
        "export const delayReasons = " + JSON.stringify(delayReasons) + ";"
    ].join("\n") + "\n";

    assignShopsToStations(timetable);

    await fs.mkdir("factoring/generated", { recursive: true });
    await Promise.all([
        fs.writeFile("factoring/generated/timetable.js",
            "export const timetable = " + JSON.stringify(timetable) + ";\n"),
        fs.writeFile("factoring/generated/lonlat.js",
            "export const lonLatToId = " + JSON.stringify(lonlattoid) + ";\n"),
        fs.writeFile("factoring/generated/district-borders.json",
            JSON.stringify(districtBorders, null, 2) + "\n"),
        fs.writeFile("factoring/generated/district-borders.js",
            "export const districtBorders = " + JSON.stringify(districtBorders) + ";\n"),
        fs.writeFile("factoring/generated/ps-systems.json",
            JSON.stringify(psSystems, null, 2) + "\n"),
        fs.writeFile("factoring/generated/ps-systems.js",
            "export const psSystems = " + JSON.stringify(psSystems) + ";\n"),
        fs.writeFile("factoring/generated/config.js", browserConfig)
    ]);

    return timetable;
}

function getTypeString(type){
    return lineTypeConfig[type].code.padEnd(2, " ");
}

function assignShopsToStations(timetable){
    let counts = [0,0,0,0,0];
    let max = [0,0,0,0,0];
    let min = [9999,9999,9999,9999,9999];
    timetable.stations.forEach(station => {
        dataOperators.forEach(dataOperator => {
            if (dataOperator.districts.includes(station.district)){
                if (Math.pow(Math.random(), 1/station.importance) >= 0.95){
                    let price = (Math.random()/2 + 0.5)*Math.pow(station.importance, 1/5)*dataOperator.priceMultiplier*18;
                    station.shops.push([constants.SHOP_TYPE.DATA_SHOP, dataOperator.id, price]);
                    console.log("OP: ", station.name, dataOperator.name, station.shops);
                    counts[dataOperator.id] += 1;
                    if (price > max[dataOperator.id]){
                        max[dataOperator.id] = price;
                    }
                    if (price < min[dataOperator.id]){
                        min[dataOperator.id] = price;
                    }
                }
            }
        })
    });
    console.log(counts, min, max);
}

async function checktimetable(){
    let timetable = await generateTimeTables();
    
    const seen = new Set();
    const seennicks = new Set();
    const missingnicknames = [];

    let i = 0;
    console.log("REPEAT LINE NUMBERS/NICKNAMES");
    timetable.lines.forEach(line => {
        if (i%2 == 0){
            if (!line.nickname){
                missingnicknames.push(getTypeString(line.type)+line.number);
            }
            if (seen.has(String(line.type)+line.number)){
                console.log("REPEAT NUMBER:", line.number);
            } else {
                seen.add(String(line.type)+line.number);
            }
            let nick = line.nickname || "";
            if (seennicks.has(nick) && nick != ""){
                console.log("REPEAT NICK:", nick);
            }
            else if (nick != ""){
                seennicks.add(nick);
            }
        }
        i++;
    });
    console.log("");

    if (missingnicknames.length <= 10){
        missingnicknames.forEach(missingnickname => {
            console.log("MISSING NICKNAME FOR TRAIN", missingnickname);
        });
    }
    else{
        console.log("MISSING NICKNAME FOR", missingnicknames.length, "TRAINS");
    }

    console.log("REPEAT TOWN NAMES");
    const seennames = new Set();
    const beforedashnames = new Set();
    timetable.stations.forEach(station => {
        let dashindex = station.name.indexOf("-");
        if (dashindex != -1){
            beforedashnames.add(station.name.substring(0, dashindex).trim());
        }
    });
    timetable.stations.forEach(station => {
        let parts = station.name.split(' ');
        parts.forEach(part => {
            if (["a", "i", "u", "v", "nad", "pod", "pri", "na", "za", "an", "der", "ve", "im"].includes(part)){

            }
            else if (["Station", "Name", "District"].includes(part)){
                console.log("FORBIDDEN WORD", station.name, "["+station.district+"]");
            }
            else if (part[0] != part.toUpperCase()[0]){
                console.log("WORD STARTING WITH LOWERCASE", station.name, "["+station.district+"]");
            }
        });
        if (beforedashnames.has(station.name.trim())){
            console.log("MISSING Hl.N.?:", station.name, "["+station.district+"]");
        }
        if (station.name != station.name.trim()){
            console.log("LEADING OR TRAILING SPACES:", station.name, "["+station.district+"]");
        }
        if (station.name.indexOf("Hl.") != -1 && station.name.indexOf("-Hl.") == -1 && station.name.indexOf("- Hl.") == -1){
            console.log("WRONG HL. IN NAME:", station.name, "["+station.district+"]");
        }
        if (station.name.includes("  ")){
            console.log("DOUBLE SPACE IN:", station.name, "["+station.district+"]");
        }
        let sname = station.name.replace(" - ", "").replace("Hl.N.","").replace("Hl.S.","");
        let name = sname + " ["+station.district+"]";
        if (seennames.has(name)){
            console.log("REPEAT STATION NAME:", name);
        }
        seennames.add(name);
    });
}

checktimetable();
