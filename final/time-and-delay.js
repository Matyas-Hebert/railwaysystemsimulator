function getnexttripnumber(currtime, trainstarttime, interval, timeadj){
    return Math.max(Math.ceil((currtime-(trainstarttime+timeadj))/interval),0)+1;
}

function getStopTimeFromType(type){
    if (type <= 1){
        return 30;
    }
    if (type <= 4){
        return 90;
    }
    return 180; // in seconds
}

function formatTime(seconds, includeday = true, includeseconds = true) {
    const d = Math.floor(seconds/86400);
    let s = (Math.round(seconds) % 86400); 
    if (s < 0){
        s += 86400;
    }
    
    const hh = Math.floor(s / 3600).toString().padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');

    if (!includeseconds){
        return `${hh}:${mm}`;
    }

    if (!includeday){
        return `${hh}:${mm}:${ss}`;
    }

    if (d == -1){
        return `${hh}:${mm}:${ss} včera`;
    }
    if (d < -1){
        return `${hh}:${mm}:${ss} před ${d} dny`;
    }
    if (d == 1){
        return `${hh}:${mm}:${ss} zítra`;
    }
    if (d > 1){
        return `${hh}:${mm}:${ss} za ${d} dny`;
    }
    if (d > 4){
        return `${hh}:${mm}:${ss} za ${d} dní`;
    }

    return `${hh}:${mm}:${ss}`;
}

function getTrainName(line, getnickname=false, padding=true){
    let name = "";
    if (padding){
        name = line.company.padEnd(6, " ") + " ";
    }
    else{
        name = line.company + " ";
    }
    let type = line.type;
    if (type == 0){
        name += "Ps";
    }
    if (type == 1){
        name += "Os";
    }
    if (type == 2){
        name += "Sp";
    }
    if (type == 3){
        name += "R";
    }
    if (type == 4){
        name += "Sh";
    }
    if (type == 5){
        name += "EC";
    }
    if (padding){
        name = name.padEnd(9, " ");
    }
    name += " " + line.number;
    if (getnickname){
        name += " " + (line.nickname || "");
    }
    if (!padding){
        return name;
    }
    return name.substring(0, 36).padEnd(36, " ");
}

function mulberry32(a){
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function newgetdelaymult(seed, currentdelayperc, type){
    currentdelayperc *= -1;
    let x = mulberry32(seed); 
    if (type == 0){
        let delay = Math.max(-0.1,
            Math.min(2,
                -Math.log(1-(5/2)*(x-(3/5)))/2
            )
        )
        if (delay < currentdelayperc){
            return currentdelayperc;
        }
        return delay;
    }
    if (type == 1){
        let delay = Math.min(2,
            -Math.log(1-(x+(3/20))*(20/23))/6
        )-0.05;
        if (delay < 0){
            return Math.max(delay*4, currentdelayperc);
        }
        return delay;
    }
    if (type == 2){
        let delay = Math.min(2,
            -Math.log(1-(x+(1/10))*(10/11))/3.5
        )-0.05;
        if (delay < 0){
            return Math.max(delay*3, currentdelayperc);
        }
        return delay;
    }
    if (type == 3){
        let delay = Math.min(2,
            -Math.log(1-(x+(1/10))*(10/11))/3
        )-0.07;
        if (delay < 0){
            return Math.max(delay*3, currentdelayperc);
        }
        return delay;
    }
    if (type == 4){
        let delay = Math.max(0,
            Math.min(2,
                -Math.log(1-x)/8.3
            )
        );
        if (delay < 0){
            return Math.max(delay, currentdelayperc);
        }
        return delay;
    }
    if (type == 5){
        let delay = Math.min(2,
            -Math.log(1-(x+(1/10))*(10/11))/2.5
        )-0.07;
        if (delay < 0){
            return Math.max(delay*3, currentdelayperc);
        }
        return delay;
    }
    return 0;
}

function getdelaymult(seed, currentdelayperc, type){
    let rand = mulberry32(seed); 

    if(type == 5){
        if (rand > 0.9) {
            return (1 - rand) * 30;
        } 
        else if (rand > 0.2) {
            return (rand - 0.3) * 0.6;
        } 
        else if (rand < 0.2) {
            let maxCatch = 0.1;
            return -Math.min(maxCatch, currentdelayperc);
        }
    }
    if(type >= 2){
        if (rand > 0.9) {
            return (1 - rand) * 20;
        } 
        else if (rand > 0.3) {
            return (rand - 0.3) * 0.6;
        } 
        else if (rand < 0.1) {
            let maxCatch = 0.1;
            return -Math.min(maxCatch, currentdelayperc);
        }
    }
    if (rand > 0.96) {
        return (1 - rand) * 30;
    } 
    else if (rand > 0.3) {
        return (rand - 0.3) * 0.5;
    } 
    else if (rand < 0.1) {
        let maxCatch = 0.1;
        return -Math.min(maxCatch, currentdelayperc);
    }
    return 0;
}

function getstartdelay(seed, type){
    let rand = mulberry32(seed);
    if (type == 5){
        return -Math.log(1-rand)*100;
    }
    if (type >= 2){
        return -Math.log(1-rand)*90;
    }
    else{
        return -Math.log(1-rand)*50;
    }
    return 0;
}

function getCurrentTimeInMs(){
    const now = new Date();
    return now.getTime() - (now.getTimezoneOffset()*60000);
}

function getDelay(lineID, tripNumber, time, stationID, daynumber){
    const line = timetable.lines[lineID];
    let delay = getstartdelay((tripNumber+1) * 100 + lineID * 100000 + daynumber, line.type);
    const starttime = line.starttime + line.interval*tripNumber + daynumber*86400;
    const stops =  line.stops;
    let previousdeptime = starttime + stops[0].dep + delay;
    let exprecteddeptime = previousdeptime-delay;

    if (starttime-delay > time){
        return {"delay": 0, "status": 0, "station": stops[0].sid, "arrtime": Math.round(starttime), "deptime": null, "progress": 1};
    }
    
    if (previousdeptime >= time){
        let status = stops[0].sid == stationID ? 3 : 1;
        return {"delay": Math.max(0, time-exprecteddeptime), "status": status, "station": stops[0].sid, "arrtime": Math.round(starttime), "deptime": Math.round(previousdeptime), "progress": 1};
    }

    let passedtargetstation = false;

    if (stops[0].sid == stationID){
        passedtargetstation = true;
    }

    let expdepattarget;
    stops.forEach(stop => {
        if (stop.sid == stationID){
            expdepattarget = stop.dep + starttime;
            return;
        }
    });

    for (let i = 1; i < line.stops.length; i++){
        const stoptime = line.stops[i].dep - line.stops[i].arr;
        const stop = line.stops[i];
        const standarttraveltime = stop.arr - line.stops[i-1].dep
        const dayssinceera = Math.floor(getCurrentTimeInMs() / (86400000));
        let seed = i + (tripNumber+1) * 50 + lineID * 25000 + (dayssinceera + daynumber)*100000000;
        let newdelay = newgetdelaymult(seed, delay/standarttraveltime, line.type)*standarttraveltime;
        const arrtime = starttime + stop.arr + delay + newdelay;
        if (arrtime > time){
            const progress = (time-previousdeptime)/(arrtime-previousdeptime);
            return {"delay": Math.round(delay+newdelay*progress), "status": passedtargetstation ? 4 : 2, "station": stops[i].sid, 
                    "arrtime": Math.round(arrtime), "deptime": Math.round(previousdeptime), "progress": progress};
        }

        if (i < line.stops.length-1 && mulberry32(seed*2+1) <= 0.0023){
            const status = expdepattarget + delay + newdelay < time ? 7 : -1;
            return {"delay": Math.round(delay+newdelay), "status": status, "station": stops[i].sid, 
                    "arrtime": Math.round(arrtime), "deptime": null, "progress": 1};
        }

        if (stop.sid == stationID){
            passedtargetstation = true;
        }

        delay += newdelay;
        delay -= Math.min(delay, stoptime/3);
        previousdeptime = starttime + stop.dep + delay;

        if (previousdeptime >= time){
            let status = passedtargetstation ? (stop.sid == stationID ? 3 : 5) : 1;
            return {"delay": Math.round(delay), "status": status, "station": stops[i].sid, 
                    "arrtime": Math.round(arrtime), "deptime": Math.round(previousdeptime), "progress": 1};
        }
    }

    return {"delay": Math.round(delay), "status": 6, "station": null, 
                    "arrtime": null, "deptime": Math.round(previousdeptime), "progress": 1};
}

function gettripnumberbytime(line, stationID, time){
    let extradays = Math.floor(time/86400);
    time = (time+86400)%86400;
    const stop = line.stops.find(s => s.sid === stationID);
    const firstdep = line.starttime + stop.dep;
    let elapsed = time - firstdep;

    if (elapsed < 0){
        let yesterdayelapsed = elapsed + 86400;
        let tripID = Math.ceil(yesterdayelapsed/line.interval);
        if (tripID < line.trips){
            return {"trip": tripID, "day": -1+extradays};
        }
        return {"trip": 0, "day": extradays};
    }

    let tripID = Math.ceil(elapsed/line.interval);
    if (tripID >= line.trips) {
        return {"trip": 0, "day": 1+extradays};
    }
    return {"trip": tripID, "day": extradays};
}

function getstatusstring(status){
    if (status == 0) {return "Train havent depart yet"; }
    if (status == 1) {return "Train is stopped at a station before the target";}
    if (status == 2) {return "Train is travelling towards target";}
    if (status == 3) {return "Train is stopped at the target station";}
    if (status == 4) {return "Train is travelling past the target";}
    if (status == 5) {return "Train is stopped at a station past the target";}
    if (status == 6) {return "Train have finished its journey";}
    return "unknown status "+String(status);
}

function getwifichance(type){
    if (type == 0){
        return 0.9;
    }
    if (type == 1){
        return 0.75;
    }
    if (type == 2){
        return 0.4;
    }
    if (type == 3){
        return 0.2;
    }
    if (type == 4){
        return 0.6;
    }
    if (type == 5){
        return 0.1;
    }
}

function havewifi(lineID, tripID, day, type){
    let seed = tripID+lineID*201+day*81573;
    let r = mulberry32(seed);
    let newr = (r*123)-Math.floor(r*123);
    if (getwifichance(type)+wifiluckboost >= newr){
        return true;
    }
    return false;
}

function havewifistation(statID, day){
    let seed = statID+day*5001;
    let r = mulberry32(seed);
    if (r+wifiluckboost >= 0.7){
        return true;
    }
    return false;
}

function getdelayreason(lineID, tripID, day){
    let total = 0;
    reasons.forEach(reason => {
        total += reason[1];
    });
    let seed = tripID+lineID*201+day*81573;
    let r = mulberry32(seed);
    let target = total*r;
    total = 0;
    for (let i = 0; i < reasons.length; i++) {
        total += reasons[i][1];
        if (total >= target) {
            return reasons[i][0];
        }
    }
    
    return reasons[reasons.length - 1][0];
}
