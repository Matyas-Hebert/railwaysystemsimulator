(function (global) {
    function savepinnedlist() {
        localStorage.setItem("_pinnedstations", JSON.stringify(pinnedstations));
    }

    function savesettings() {
        localStorage.setItem("_settings", JSON.stringify(settings));
    }

    function saveobjednavky() {
        localStorage.setItem("_objednavky", JSON.stringify(objednavky));
    }

    function savepinnedorders() {
        localStorage.setItem("_pinnedorders", JSON.stringify(pinnedorders));
    }

    function savematerials() {
        localStorage.setItem("_money", JSON.stringify(money));
    }

    function updatepositionlocalstorage() {
        let tmp = { ...currentposition };
        tmp.statID = timetable.stations[currentposition.statID].lonlat;
        tmp.goalStatID = timetable.stations[currentposition.goalStatID].lonlat;
        console.log(tmp, "saved");
        localStorage.setItem("_currentposition", JSON.stringify(tmp));
    }

    function addmoney(addamount) {
        money += addamount;
        savematerials();
        _money.innerText = String(money) + ",-";
    }

    function togglePinnedDelivery(orderId) {
        if (!Array.isArray(pinnedorders)) {
            pinnedorders = [];
        }
        const index = pinnedorders.indexOf(orderId);
        if (index === -1) {
            pinnedorders.push(orderId);
        }
        else {
            pinnedorders.splice(index, 1);
        }
        savepinnedorders();
    }

    function resetGameState() {
        money = 0;
        objednavky = [];
        pinnedstations = [];
        pinnedorders = [];
        settings = { developer: false };
        currentposition = null;
        currentsection = 0;
        section1id = 200;
        section4ids = [69, 420];
        startid = -1;
        _money.innerText = "0,-";
        savesettings();
        saveobjednavky();
        savepinnedorders();
        savematerials();
        savepinnedlist();
        generateObjednavky(5);
        printcurrentsection();
    }

    function loadfromlocalstorage() {
        money = localStorage.getItem("_money") == null ? 0 : parseInt(localStorage.getItem("_money"), 10);
        settings = localStorage.getItem("_settings") == null ?
            { developer: false } :
            JSON.parse(localStorage.getItem("_settings"));
        updateuisettings();

        const storedOrders = JSON.parse(localStorage.getItem("_objednavky"));
        objednavky = Array.isArray(storedOrders) ? storedOrders : [];
        objednavky.forEach((order, index) => {
            if (!order.id) {
                order.id = `order-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;
            }
        });
        if (objednavky.length < 5) {
            generateObjednavky(5 - objednavky.length);
        }
        const storedPinnedOrders = JSON.parse(localStorage.getItem("_pinnedorders"));
        pinnedorders = Array.isArray(storedPinnedOrders) ? storedPinnedOrders : [];
        _money.innerText = parseInt(money, 10) + ",-";
        currentposition = JSON.parse(localStorage.getItem("_currentposition"));
        if (currentposition == null) {
            return;
        }
        currentposition.iswifi = false;
        if (!Object.keys(currentposition).includes("statID")) {
            console.log("statID not found");
            currentposition = null;
            return;
        }
        if (!Object.keys(currentposition).includes("transporttype")) {
            changetransporttype(0);
        }
        if (!(parseInt(currentposition.statID, 10) <= 10000)) {
            currentposition.statID = lonlattoid[currentposition.statID];
            if (currentposition.statID == null) {
                console.log("statID");
                currentposition = null;
                return;
            }
        }
        if (!Object.keys(currentposition).includes("goalStatID")) {
            if (currentposition.transporttype == 2) {
                changetransporttype(0);
            }
            return;
        }
        currentposition.goalStatID = lonlattoid[currentposition.goalStatID];
        if (typeof global.changeStation === "function") {
            global.changeStation(currentposition.statID, {
                transportType: currentposition.transporttype,
                goalStatID: currentposition.goalStatID,
                time: currentposition.time != null ? currentposition.time : getCurrentTimeInMs()
            });
        }
        pinnedstations = localStorage.getItem("_pinnedstations") == null ? [] :
                        JSON.parse(localStorage.getItem("_pinnedstations"));
    }

    function newgame() {
        resetGameState();
    }

    function addDeveloperMoney() {
        if (settings?.developer !== true) {
            return;
        }

        const amount = parseInt(_moneyamount.value, 10);
        if (Number.isNaN(amount)) {
            return;
        }

        addmoney(amount);
        _moneyamount.value = "";
    }

    function teleportToStation() {
        if (settings?.developer !== true) {
            return;
        }

        const stationId = parseInt(_teleportid.value, 10);
        if (Number.isNaN(stationId) || !timetable.stations[stationId]) {
            return;
        }

        currentposition = {
            transporttype: 0,
            statID: stationId,
            goalStatID: stationId,
            time: getCurrentTimeInMs()
        };
        currentsection = 0;
        section1id = stationId;
        if (typeof global.changeStation === "function") {
            global.changeStation(stationId, {
                transportType: 0,
                goalStatID: stationId,
                time: getCurrentTimeInMs(),
                forceVisit: true
            });
        }
        else {
            updatepositionlocalstorage();
            printcurrentsection();
        }
        _teleportid.value = "";
    }

    global.savepinnedlist = savepinnedlist;
    global.savesettings = savesettings;
    global.saveobjednavky = saveobjednavky;
    global.savepinnedorders = savepinnedorders;
    global.savematerials = savematerials;
    global.updatepositionlocalstorage = updatepositionlocalstorage;
    global.addmoney = addmoney;
    global.loadfromlocalstorage = loadfromlocalstorage;
    global.newgame = newgame;
    global.togglePinnedDelivery = togglePinnedDelivery;
    global.addDeveloperMoney = addDeveloperMoney;
    global.teleportToStation = teleportToStation;
})(window);
