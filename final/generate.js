const fs = require('fs').promises;
const path = require('path');

async function loadTestJson() {
    const filePath = path.join(__dirname, '../json/metro.json');
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
        "type": getTypeID(part1parts[1]),
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

function getTrips(startTime, interval){
    let randomEnd = 75600 + Math.floor(Math.random() * (86400-75600));
    if (interval > 40*60){
        randomEnd += Math.floor(Math.random() * (12600));
    }

    const availableTime = randomEnd - startTime;
    return trips = Math.floor(availableTime / interval);
}

function getStopTimeFromType(type){
    if (type == "HSR"){
        return 180;
    }
    if (type == "MLDISTANCE"){
        return 90;
    }
    return 30; // in seconds
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

function getTimeFromDistanceAndType(distance, type){
    // distance [km], distance/acc [hr]
    var maxspeed = 100, acc = 12000;
    if (type == "HSR"){
        maxspeed = 220;
        acc = 3000;
    }
    if (type == "MLDISTANCE"){
        maxspeed = 160;
        acc = 6000;
    }

    var criticaldistance = maxspeed*maxspeed/acc;
    //console.log(distance, maxspeed, acc);
    if (distance <= criticaldistance){
        return (2*Math.sqrt(distance/acc))*3600; // in seconds
    }
    return (distance/maxspeed + maxspeed/acc)*3600; // in seconds
}

function getTypeID(type){
    if (type.toLowerCase() == "ps"){
        return 0;
    }
    if (type.toLowerCase() == "os"){
        return 1;
    }
    if (type.toLowerCase() == "sp"){
        return 2;
    }
    if (type.toLowerCase() == "r"){
        return 3;
    }
    if (type.toLowerCase() == "sh"){
        return 4;
    }
    if (type.toLowerCase() == "ec"){
        return 5;
    }
    return -1;
}

async function generateTimeTables() {
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

    Object.values(map.stations).forEach(async (station, stationID) => {
        if (!station.isWaypoint){
            stationIDtonewID[station.id] = i;
            let name = station.name;
            
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
                "departures": [],
                "arrivals": []
            });
            if (Object.keys(districtcount).includes(district)){
                districtcount[district]++;
            }
            else{
                districtcount[district] = 1;
            }
            i++;
        }
    });

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

        lines.push({...lineinfo});
        lines.push({...lineinfo});
        let starttime = getStartTime();
        lines[i]["id"] = i;
        lines[i+1]["id"] = i+1;
        lines[i]["starttime"] = starttime;
        lines[i+1]["starttime"] = starttime;
        let trips = getTrips(starttime, lineinfo.interval);
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
        line.stationIds.forEach(stationID => {
            let station = map.stations[stationID];
            if (!isFirstStationOfLine){
                distanceacc += calculateDistance(lastlat, lastlon, station.lat, station.lng);
            }
            lastlat = station.lat;
            lastlon = station.lng;
            let repeat = stationIDtonewID[stationID] == undefined || found.has(stationIDtonewID[stationID]);
            if (!overrides.includes(stationID) && !station.isWaypoint && !repeat){
                if (previousStation != null){
                    stations[stationIDtonewID[previousStation]].departures.push(i);
                    stations[stationIDtonewID[previousStation]].arrivals.push(i+1);
                }
                if (!isFirstStationOfLine){
                    totaltime += getTimeFromDistanceAndType(distanceacc, line.mode);
                    lines[i]["stops"].push({
                        "sid": stationIDtonewID[stationID], "arr": Math.round(totaltime), "dep": Math.round(totaltime+=getStopTimeFromType(line.mode)), "dist": distanceacc
                    });
                    stations[stationIDtonewID[stationID]].arrivals.push(i);
                    stations[stationIDtonewID[stationID]].departures.push(i+1);
                    distanceacc = 0;
                }
                else{
                    totaltime += getStopTimeFromType(line.mode);
                    lines[i]["orig"] = stationIDtonewID[stationID];
                    lines[i]["stops"].push({
                        "sid": stationIDtonewID[stationID], "arr": 0, "dep": Math.round(totaltime), "dist": distanceacc
                    });
                }
                previousStation = stationID;
                isFirstStationOfLine = false;
                found.add(stationIDtonewID[previousStation]);
                found.add(stationIDtonewID[stationID]);
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

    let timetable = {"lines": lines, "stations": stations};
    
    //console.log(JSON.stringify(timetable, null, "\t"));
    fs.writeFile("final/json/timetable_data.js", "const timetable = " + JSON.stringify(timetable) + ";");
    return timetable;
}

function getTypeString(type){
    if (type == 0){
        return "Ps".padEnd(2, " ");
    }
    if (type == 1){
        return "Os".padEnd(2, " ");
    }
    if (type == 2){
        return "Sp".padEnd(2, " ");
    }
    if (type == 3){
        return "R".padEnd(2, " ");
    }
    if (type == 4){
        return "Sh".padEnd(2, " ");
    }
    if (type == 5){
        return "EC".padEnd(2, " ");
    }
    return "";
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