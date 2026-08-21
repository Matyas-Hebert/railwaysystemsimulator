const fs = require('fs').promises;
const path = require('path');
const { generateDistrictBorders } = require('./generate-district-borders');
const { assignPsSystemIDs, generatePsSystems } = require('./generate-ps-systems');
const { assignStationImportance } = require('./generate-station-importance');
const { PS, PX, OS, OX, SP, R, SH, IC, EC, NJ, AR, AJ } = require('../config/line-type-constants');

let lineTypeConfig;
let journeyPricingConfig;


async function loadTestJson() {
    const filePath = path.join(__dirname, '../../json/metronew.json');
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

function parseLineName(name){
    //"[ZSSK] R 0160b (2) | Bílá Paní | 72 |  | Brezno-Ilava |"
    const parts = name.split('|').map(item => item.trim());
    const part1parts = parts[0].split(' ').map(item => item.trim());
    let companynumber = "";

    let data = {
        "company": part1parts[0].substring(1, part1parts[0].length-1),
        "type": part1parts[1],
        "number": part1parts[2],
        "interval": parseInt(parts[2])*60
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
    let randomEnd = 75600 + Math.floor(Math.random() * (86400-75600));
    if (interval > 40*60){
        randomEnd += Math.floor(Math.random() * (12600));
    }
    if (traintype == AR || traintype == AJ) {
        randomEnd = 86400;
    }

    const availableTime = randomEnd - startTime;
    return trips = Math.ceil(availableTime / interval);
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
    const found = new Set();
    const uvrat = [];
    let stopIndex = 0;

    line.stationIds.forEach((stationID, stationIndex) => {
        const station = map.stations[stationID];
        const timetableStationID = stationIDtonewID[stationID];
        const repeat = timetableStationID == undefined || found.has(timetableStationID);

        if (!overrides.includes(stationID) && !station.isWaypoint && !repeat){
            const previousStationID = line.stationIds[stationIndex - 1];
            const nextStationID = line.stationIds[stationIndex + 1];

            if (previousStationID != undefined && previousStationID === nextStationID){
                uvrat.push(stopIndex);
            }

            found.add(timetableStationID);
            stopIndex++;
        }
    });

    return { uvrat, stopCount: stopIndex };
}


function getLineMetrics(line, map, stationIDtonewID){
    const overrides = line.waypointOverrides || [];
    const found = new Set();
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
        const repeat = timetableStationID === undefined || found.has(timetableStationID);
        if (!overrides.includes(stationID) && !station.isWaypoint && !repeat){
            if (stopCount > 0){
                segmentDistances.push(distanceSinceLastStop);
            }
            distanceSinceLastStop = 0;
            found.add(timetableStationID);
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

    if (!typeConfig.canBeShortened
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
        line.routes = [];

        if (line.possibleRoutes.length === 0) {
            line.averageShorteningFactor = 1;
            return;
        }

        const routeImportances = line.possibleRoutes.map(route => {
            let importance = 0;
            for (let stopIndex = route[0]; stopIndex <= route[1]; stopIndex++) {
                const endpointMultiplier = stopIndex === 0
                    || stopIndex === lineStationIDs.length - 1
                    ? 5
                    : 1;
                importance += timetable.stations[
                    lineStationIDs[stopIndex]
                ].routeSelectionImportance * endpointMultiplier;
            }
            return importance;
        });
        const totalImportance = routeImportances.reduce(
            (total, importance) => total + importance,
            0
        );

        const distanceFromStart = [0];
        for (let stopIndex = 1; stopIndex < line.stops.length; stopIndex++) {
            distanceFromStart[stopIndex] = distanceFromStart[stopIndex - 1]
                + Number(line.stops[stopIndex].dist);
        }
        const routeDistances = line.possibleRoutes.map(route =>
            distanceFromStart[route[1]] - distanceFromStart[route[0]]
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
        const fullRouteDistance = distanceFromStart[line.stops.length - 1] ?? 0;
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
                            break;
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

async function generateTimeTables() {
    const lineTypeConfigPath = path.join(__dirname, "../config/line-types.json");
    const journeyPricingConfigPath = path.join(__dirname, "../config/journey-pricing.json");
    lineTypeConfig = JSON.parse(await fs.readFile(lineTypeConfigPath, "utf8"));
    journeyPricingConfig = JSON.parse(await fs.readFile(journeyPricingConfigPath, "utf8"));
    const map = await loadTestJson();

    stationIDtonewID = {};

    const stations = [];
    const lines = [];
    const coords = [];

    let i = 0;

    const citydatapath = path.join(__dirname, "../json/capitalsdata.json");
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

            let cnt = 0;
            let iwd = [];
            coords.forEach(coord => {
                let distance = calculateDistance(station.lat, station.lng, coord.lat, coord.lng);
                if (distance <= 3){
                    stations[cnt].iwd.push({"id": i, "dist": distance});
                    iwd.push({"id": cnt, "dist": distance});
                }
                cnt++;
            });

            coords.push({"lat": station.lat, "lng": station.lng});
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
                "iwd": iwd,
                "name": name,
                "district": district,
                "lat": station.lat,
                "lon": station.lng,
                "lonlat": lonlat,
                "departures": [],
                "arrivals": []
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

    const districtBorders = generateDistrictBorders(stations, citydata);

    let sortedEntries = Object.entries(districtcount).sort((a, b) => b[1] - a[1]);
    i = 0;
    sortedEntries.forEach(sortedEntry => {
        i++;
        console.log(i, sortedEntry[0], sortedEntry[1]);
    });

    i = 0;
    let stationssections = {};
    Object.values(map.lines).forEach((line, lineID) => {
        const lineinfo = parseLineName(line.name);
        if (!(lineinfo.company in journeyPricingConfig.companies)) {
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
        let starttime = getStartTime();
        lines[i]["id"] = i;
        lines[i+1]["id"] = i+1;
        lines[i]["starttime"] = starttime;
        lines[i+1]["starttime"] = starttime;
        let trips = getTrips(starttime, lineinfo.interval, lineinfo.type);
        if (trips <= 2){
            console.log("low trips", trips, "for", line.name, lineinfo);
        }
        lines[i]["trips"] = trips;
        lines[i+1]["trips"] = trips;
        lines[i]["stops"] = [];
        lines[i+1]["stops"] = [];

        let isFirstStationOfLine = true;
        let previousStation = null;
        const overrides = line.waypointOverrides || [];
        let totaltime = 0;
        let distanceacc = 0;
        let lastlat;
        let lastlon;
        let found = new Set();
        let j = 0;
        line.stationIds.forEach(stationID => {
            let station = map.stations[stationID];
            if (!isFirstStationOfLine){
                distanceacc += calculateDistance(lastlat, lastlon, station.lat, station.lng);
            }
            lastlat = station.lat;
            lastlon = station.lng;
            let repeat = stationIDtonewID[stationID] == undefined || found.has(stationIDtonewID[stationID]);
            if (!overrides.includes(stationID) && !station.isWaypoint && !repeat){
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
                found.add(stationIDtonewID[previousStation]);
                found.add(stationIDtonewID[stationID]);
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

    stations.forEach(station => {
        station.isTransfer = isTransfer(station, stations, lines);
    });
    lines.forEach(line => {
        line.possibleRoutes = getPossibleRoutes(line, stations);
    });

    let timetable = {"lines": lines, "stations": stations};
    assignStationImportance(timetable, {
        routeAware: false,
        property: "routeSelectionImportance"
    });

    generateRoutesForTrips(timetable);
    assignStationImportance(timetable);
    timetable.stations.forEach(station => {
        delete station.routeSelectionImportance;
    });

    const psSystems = generatePsSystems(timetable);
    assignPsSystemIDs(timetable, psSystems);

    //console.log(JSON.stringify(timetable, null, "\t"));
    await Promise.all([
        fs.writeFile(
            "factoring/json/timetable_data.js",
            "const timetable = " + JSON.stringify(timetable) + ";"
        ),
        fs.writeFile(
            "factoring/json/lonlat.js",
            "const lonlattoid = " + JSON.stringify(lonlattoid) + ";"
        ),
        fs.writeFile(
            "factoring/json/district-borders.json",
            JSON.stringify(districtBorders, null, 2)
        ),
        fs.writeFile(
            "factoring/json/district-borders.js",
            "const districtBorders = " + JSON.stringify(districtBorders) + ";"
        ),
        fs.writeFile(
            "factoring/json/ps-systems.json",
            JSON.stringify(psSystems, null, 2) + String.fromCharCode(10)
        ),
        fs.writeFile(
            "factoring/json/ps-systems.js",
            "const psSystems = " + JSON.stringify(psSystems) + ";"
        ),
        fs.writeFile(
            "factoring/config/line-types.js",
            "const lineTypeConfig = " + JSON.stringify(lineTypeConfig) + ";\n"
        ),
        fs.writeFile(
            "factoring/config/journey-pricing.js",
            "const journeyPricingConfig = " + JSON.stringify(journeyPricingConfig) + ";\n"
        )
    ]);
    return timetable;
}

function getTypeString(type){
    return lineTypeConfig[type].code.padEnd(2, " ");
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
