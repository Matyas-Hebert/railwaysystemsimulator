function startgame(){
    currentposition = {
        transporttype: 0,
        statID: startid,
        goalStatID: startid
    };
    changecurrentsection(0);
    updatepositionlocalstorage();
};

function switchidoslocations(){
    console.log("switching");
    let tmp = section4ids[0];
    section4ids[0] = section4ids[1];
    section4ids[1] = tmp;
    let tmpvalue = _idosstart.value;
    let tmphtml = _idosstart.innerHTML;
    _idosstart.value = _idosend.value;
    _idosstart.innerHTML = _idosend.innerHTML;
    _idosend.value = tmpvalue;
    _idosend.innerHTML = tmphtml;
    printcurrentsection();
}

function selectsection(section){
    changecurrentsection(section);
    if (currentsection == 4){
        const currentDate = new Date();
        idostime = currentDate.getHours()*3600 + currentDate.getMinutes()*60;
        updateidostimeview();
    }
    printcurrentsection();
}

function printwalkable(stationID){
    _walkables.innerHTML = "";

    let div = document.createElement("div");
    div.innerText = getstationname(timetable.stations[stationID]);
    div.classList = "whiteheader";
    _walkables.appendChild(div);
    if (stationID == -1){
        let d = document.createElement("div");
        d.innerText = "Jsi ve vlaku, nikam nejdeš!"
        d.classList = "reddishinfo";
        _walkables.appendChild(d);
        return;
    }
    let stationiwd = timetable.stations[stationID].iwd;
    console.log(stationiwd);
    if (stationiwd.length == 0){
        let d = document.createElement("div");
        d.innerText = "Nikam odtud nelze dojít"
        d.classList = "reddishinfo";
        _walkables.appendChild(d);
        return;
    }
    let i = 0;
    stationiwd.forEach(iwd => {
        let options = document.createElement("div");
        options.classList = "whiteheader";
        if (i%2 == 0){
            options.classList.add("whiteheaderlightbg");
        }

        let name = document.createElement("div");
        name.innerText = getstationname(timetable.stations[iwd.id]);

        let time = document.createElement("div");
        time.innerText = String(Math.round(iwd.dist*8))+" min";

        let go = document.createElement("div");
        go.innerText = "JÍT";
        go.className = "selected";

        go.onclick = function() {
            changetransporttype(2);
            currentposition.goalStatID = iwd.id;
            currentposition.time = getCurrentTimeInMs();
            updatepositionlocalstorage();
            changecurrentsection(0);
        }
        name.onclick = function(){
            section1id = iwd.id;
            changecurrentsection(1);
        }
        options.appendChild(name);
        options.appendChild(time);
        options.appendChild(go);

        options.style.padding = "0.5rem";
        _walkables.appendChild(options);
        i++;
    });
}

function printwalkprogress(table){
    let startstat = timetable.stations[currentposition.statID];
    let endstat = timetable.stations[currentposition.goalStatID];
    let dist = getiwddistance(currentposition.statID, currentposition.goalStatID);
    let mstime = dist*8*60*1000;
    let timeelapsed = getCurrentTimeInMs()-currentposition.time;
    let timetogo = mstime-timeelapsed;
    let mins = Math.ceil(timetogo/(60*1000));
    _mintogoal.innerText = String(mins);
    if (mins <= 1){
        _mintogoal.innerText += " minuta";
    }
    else if (mins <= 4){
        _mintogoal.innerText += " minuty";
    }
    else{
        _mintogoal.innerText += " minut";
    }
    _mintogoal.innerText += " do cíle";
    if (timeelapsed >= mstime){
        changeStation(currentposition.goalStatID, {
            transportType: 0,
            goalStatID: currentposition.goalStatID,
            time: getCurrentTimeInMs()
        });
        return;
    }
    updatetrackprogress(2, timeelapsed/mstime, currentposition.goalStatID, currentposition.statID);
    _turnbtn.onclick = function(){
        const nextStationId = currentposition.goalStatID;
        const previousStationId = currentposition.statID;
        const nextTime = getCurrentTimeInMs()-timetogo;
        changeStation(nextStationId, {
            transportType: currentposition.transporttype,
            goalStatID: previousStationId,
            time: nextTime
        });
    }
    table.innerHTML = "";
}

function getiwddistance(fromID, toID){
    let dist = 0;
    timetable.stations[fromID].iwd.forEach(iw => {
        if (iw.id == toID){
            dist = iw.dist;
        }
    });
    return dist;
}

function printfoodora(){
    console.log("mas", objednavky.length, "objednavek");
    _section6.innerHTML = "";

    const slotCount = Array.isArray(objednavky) ? objednavky.length : 0;
    const slotCost = slotCount * 100;
    const canBuySlot = money >= slotCost;

    const sortedOrders = [...objednavky].sort((a, b) => {
        const aPinned = Array.isArray(pinnedorders) && pinnedorders.includes(a.id);
        const bPinned = Array.isArray(pinnedorders) && pinnedorders.includes(b.id);
        if (aPinned === bPinned) {
            return 0;
        }
        return aPinned ? -1 : 1;
    });

    let i = 0;
    sortedOrders.forEach(objednavka => {
        const orderId = objednavka.id;
        const isPinned = Array.isArray(pinnedorders) && pinnedorders.includes(orderId);
        let div = document.createElement("div");
        div.className = isPinned ? "foodora pinned-order" : "foodora";

        let pinRow = document.createElement("div");
        pinRow.className = "delivery-pin-row";
        let pinButton = document.createElement("div");
        pinButton.className = isPinned ? "delivery-pin-button pinned" : "delivery-pin-button notpinned";
        pinButton.title = isPinned ? "Odepnout doručení" : "Připnout doručení";
        pinButton.onclick = function(event){
            event.stopPropagation();
            togglePinnedDelivery(orderId);
            printfoodora();
        };
        pinRow.appendChild(pinButton);
        div.appendChild(pinRow);
        let start = document.createElement("div");
        start.appendChild(document.createElement("div"));
        start.appendChild(document.createElement("div"));
        start.appendChild(document.createElement("div"));
        start.childNodes[0].innerText ="Z";
        start.childNodes[1].innerText = getstationname(objednavka.start)+" ("+objednavka.start.district+")";
        
        let end = document.createElement("div");
        end.appendChild(document.createElement("div"));
        end.appendChild(document.createElement("div"));
        end.appendChild(document.createElement("div"));
        end.childNodes[0].innerText ="DO";
        end.childNodes[1].innerText = getstationname(objednavka.end)+" ("+objednavka.end.district+")";
        
        let price = document.createElement("div");
        price.appendChild(document.createElement("div"));
        price.appendChild(document.createElement("div"));
        price.appendChild(document.createElement("div"));
        price.childNodes[0].innerText ="ODMĚNA";
        price.childNodes[1].innerText = String(Math.round(objednavka.reward)) + ",-";
        if (objednavka.state == 0){
            price.childNodes[2].innerText = "ČEKÁ";
            price.childNodes[2].style.backgroundColor = "#911e1e";
            if (currentposition.transporttype == 0 && currentposition.statID == objednavka.start.id){
                price.childNodes[2].innerText = "VYZVEDNOUT";
                price.childNodes[2].style.backgroundColor = "orange";
                price.childNodes[2].style.color = "black";
                price.childNodes[2].onclick = function(){
                    changeobjednavkastatus(objednavka, 1);
                    printfoodora();
                };
            }
        }
        if (objednavka.state == 1){
            price.childNodes[2].innerText = "NA CESTĚ";
            price.childNodes[2].style.backgroundColor = "yellow";
            price.childNodes[2].style.color = "black";
            if (currentposition.transporttype == 0 && currentposition.statID == objednavka.end.id){
                price.childNodes[2].innerText = "DORUČIT";
                price.childNodes[2].style.backgroundColor = "lime";
                price.childNodes[2].style.color = "black";
                price.childNodes[2].onclick = function(){
                    changeobjednavkastatus(objednavka, 2);
                    printfoodora();
                }
            }
        }
        if (objednavka.state == 2){
            price.childNodes[2].innerText = "VYBRAT "+String(Math.round(objednavka.reward)) + ",-";
            price.childNodes[2].style.backgroundColor = "#269c26";
            price.childNodes[2].onclick = function(){
                addmoney(objednavka.reward);
                removeobjednavka(objednavka);
                printfoodora();
                generateObjednavky(1);
            }
        }
        price.childNodes[2].style.textAlign = "center";

        let options = document.createElement("div");
        options.appendChild(document.createElement("div"));
        options.appendChild(document.createElement("div"));
        options.appendChild(document.createElement("div"));

        options.childNodes[0].innerHTML = "ZRUŠIT<br>200,-";
        options.childNodes[0].style.backgroundColor = "#911e1e";
        options.childNodes[0].onclick = function(){
            if (money >= 200){
                removeobjednavka(objednavka);
                addmoney(-200);
                
                generateObjednavky(1);
            }
        }

        options.childNodes[1].innerHTML = "NAJÍT TRASU<br>NA START";
        options.childNodes[1].style.backgroundColor = "#269c26";
        options.childNodes[1].onclick = function(){
            section4ids = [currentposition.statID, objednavka.start.id];
            changecurrentsection(4);
        }

        options.childNodes[2].innerHTML = "NAJÍT TRASU<br>NA KONEC";
        options.childNodes[2].style.backgroundColor = "#269c26";
        options.childNodes[2].onclick = function(){
            section4ids = [currentposition.statID, objednavka.end.id];
            changecurrentsection(4);
        }

        options.className = "options";

        div.appendChild(start);
        div.appendChild(end);
        div.appendChild(price);
        div.appendChild(options);
        if (!div.className.includes("pinned-order")) {
            div.className = isPinned ? "foodora pinned-order" : "foodora";
        }
        _section6.appendChild(div);
        i++;
    });

    let unlockDiv = document.createElement("div");
    unlockDiv.className = "foodora unlock-slot-card";

    let unlockHeader = document.createElement("div");
    unlockHeader.className = "unlock-slot-header";
    unlockHeader.innerText = "NOVÝ SLOT";

    let unlockBody = document.createElement("div");
    unlockBody.className = "unlock-slot-body";
    unlockBody.innerText = "Koupí slotu získáš další místo pro doručení.";

    let unlockAction = document.createElement("div");
    unlockAction.className = "unlock-slot-action";
    unlockAction.innerText = canBuySlot ? `KUPIT ZA ${slotCost},-` : `NEDOSTATEK (${slotCost},-)`;
    unlockAction.style.backgroundColor = canBuySlot ? "#269c26" : "#911e1e";
    unlockAction.onclick = function(){
        if (canBuySlot) {
            buyDeliverySlot();
        }
    };

    unlockDiv.appendChild(unlockHeader);
    unlockDiv.appendChild(unlockBody);
    unlockDiv.appendChild(unlockAction);
    _section6.appendChild(unlockDiv);
}

function removeobjednavka(objednavka){
    if (!objednavky.includes(objednavka)){
        return;
    }
    let index = objednavky.indexOf(objednavka);
    objednavky.splice(index, 1);
    saveobjednavky();
}

function printcurrentsection(force = false){
    console.log(currentposition);
    _start.style.display = "none";
    _tables.style.display = "none";
    if (currentposition == null){
        _start.style.display = "block";
        return;
    }
    _tables.style.display = "flex";
    _section0.style.display = currentsection <= 1 ? "block" : "none";
    _section1.style.display = currentsection == 1 ? "block" : "none";
    _section2.style.display = currentsection == 2 ? "block" : "none";
    _section3.style.display = currentsection == 3 ? "block" : "none";
    _section4.style.display = currentsection == 4 ? "block" : "none";
    _section5.style.display = currentsection == 5 ? "block" : "none";
    _section6.style.display = currentsection == 6 ? "block" : "none";
    _section7.style.display = currentsection == 7 ? "block" : "none";
    _section8.style.display = currentsection == 8 ? "block" : "none";
    _subsection5.style.display = "none";
    _tab0.className = currentsection == 0 ? "chosen" : "unchosen";
    _tab1.className = currentsection == 1 ? "chosen" : "unchosen";
    _tab2.className = currentsection == 2 ? "chosen" : "unchosen";
    _tab3.className = currentsection == 3 ? "chosen" : "unchosen";
    _tab4.className = currentsection == 4 ? "chosen" : "unchosen";
    _tab5.className = currentsection == 5 ? "chosen" : "unchosen";
    _tab6.className = currentsection == 6 ? "chosen" : "unchosen";
    _tab7.className = currentsection == 7 ? "chosen" : "unchosen";
    _tab8.className = currentsection == 8 ? "chosen" : "unchosen";
    _tab5.style.display = currentposition.transporttype == 0 ? "block" : "none";
    if (currentsection == 0){
        if (currentposition.transporttype == 0){
            printtimetable(currentposition.statID, true, _timetable, true, 15, 0, force);
        }
        if (currentposition.transporttype == 1){
            _section0.style.display = "none";
            _section2.style.display = "block";
            currentposition.hidesinfront = true;
            printschedule(_traintimetable, currentposition, true, true);
        }
        if (currentposition.transporttype == 2){
            _section0.style.display = "none";
            _section2.style.display = "block";
            _subsection5.style.display = "block";
            printwalkprogress(_traintimetable);
        }
    }
    if (currentsection == 1){
        printtimetable(section1id, false, _timetable, true, 15, 0, force);
    }
    if (currentsection == 2){
        printschedule(_traintimetable, section2data);
    }
    if (currentsection == 4){
        console.log(section4ids);
        _idosstart.value = getstationname(timetable.stations[section4ids[0]]);
        _idosend.value = getstationname(timetable.stations[section4ids[1]]);
    }
    if (currentsection == 5){
        printwalkable(currentposition.transporttype == 2 ? -1 : currentposition.statID);
    }
    if (currentsection == 6){
        printfoodora();
    }
    if (currentsection == 7){
        renderCollectionTab();
    }

    if (currentsection == 8){
        updateuisettings();
    }

    currentposition.iswifi = false;
    if (currentposition.transporttype == 0){
        currentposition.iswifi = havewifistation(currentposition.statID, currentposition.day);
    }
    if (currentposition.transporttype == 1){
        currentposition.iswifi = havewifi(currentposition.lineID, currentposition.tripID, currentposition.day, timetable.lines[currentposition.lineID].type);
    }
    if (currentposition.transporttype == 2){
        let start = currentposition.time;
        let dist = getiwddistance(currentposition.statID, currentposition.goalStatID);
        let mstime = dist*8*60*1000;
        let end = start+mstime;
        let current = getCurrentTimeInMs();
        if (Math.abs(current - start) < 60000){
            currentposition.iswifi = havewifistation(currentposition.statID, currentposition.day);
        }
        if (Math.abs(current - end) < 60000){
            currentposition.iswifi = havewifistation(currentposition.goalStatID, currentposition.day);
        }
    }
    if (currentposition.iswifi){
        _wifi.className = "wifi";
    }
    else{
        _wifi.className = "nowifi";
    }
}

let isOpen = false;
let justClosed = false;

_destinations.addEventListener('click', () => {
    if (justClosed){
        return;
    }
    isOpen = !isOpen; 
    console.log(isOpen ? "Opened" : "Closed");
});

_destinations.addEventListener('blur', () => {
    isOpen = false;
    console.log("Closed (lost focus)");
});

_destinations.addEventListener('change', () => {
    isOpen = false;
    console.log("Closed (item selected)");
    justClosed = true;
    setTimeout(() => { justClosed = false; }, 10);
});

window.addEventListener('scroll', () => {
    if (isOpen){
        isOpen = false;
        console.log("Closed (item scrolled)");
    }
});

let openeddetail = "";
let connstruct = {};
let idostime = 0;
let filters = {"departures": true, "types": [true, true, true, true, true, true], "statid": -1};
// 0 - in station, 1 - on train, 2 - walking
let currentposition = null;
let objednavky = null;
let money = 0;
let pinnedstations = [];
let pinnedorders = [];
let settings;
loadfromlocalstorage();
let pinnedstationsopened = false;
let currentsection = 0;
let section1id = 200;
let section4ids = [69, 420];
let startid = -1;
let wifiluckboost = 0;
let section2data = {"lineID": 1, "tripID": 1, "day": 0, "hidesinfront": true};
printcurrentsection();
setInterval(updateclock, 1000);
//setInterval(printcurrentsection, 5000);
let m = timetable.stations.length;