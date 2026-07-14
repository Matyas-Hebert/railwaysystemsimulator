(function (global) {
    function getcoordsfromstring(lonlatstring) {
        return {
            lon: parseFloat(lonlatstring.substring(0, 6) / 10000),
            lat: parseFloat(lonlatstring.substring(6, 12) / 10000)
        };
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function generateObjednavky(amount) {
        if (objednavky == null) {
            objednavky = [];
        }
        let stationsamount = timetable.stations.length;
        for (let i = 0; i < amount; i++) {
            let mindistance = Infinity;
            let mincombination = null;
            let startstat = Math.floor(Math.random() * stationsamount);
            let startcoords = getcoordsfromstring(timetable.stations[startstat].lonlat);
            for (let j = 0; j < 5; j++) {
                let endstat = Math.floor(Math.random() * stationsamount);
                if (endstat != startstat) {
                    let endcoords = getcoordsfromstring(timetable.stations[endstat].lonlat);
                    let dist = calculateDistance(startcoords.lon, startcoords.lat, endcoords.lon, endcoords.lat);
                    if (dist < mindistance) {
                        mindistance = dist;
                        mincombination = {
                            dist: dist,
                            start: timetable.stations[startstat],
                            end: timetable.stations[endstat],
                            reward: (Math.random() + 9.5) * dist + 100,
                            state: 0
                        };
                    }
                }
            }
            objednavky.push(mincombination);
        }
        saveobjednavky();
        printcurrentsection();
    }

    function buyDeliverySlot() {
        const slotCount = Array.isArray(objednavky) ? objednavky.length : 0;
        const cost = slotCount * 100;
        if (money < cost) {
            return false;
        }
        addmoney(-cost);
        generateObjednavky(1);
        return true;
    }

    function changeobjednavkastatus(objednavka, status) {
        objednavka.state = status;
        saveobjednavky();
    }

    function updateuisettings() {
        _developer.innerText = "VYPNUTO";
        _developer.className = "off";
        if (settings.developer === true) {
            _developer.innerText = "ZAPNUTO";
            _developer.className = "on";
        }

        const teleportRow = document.getElementById("_teleportrow");
        if (teleportRow) {
            teleportRow.style.display = settings?.developer === true ? "flex" : "none";
        }

        const teleportInput = document.getElementById("_teleportid");
        if (teleportInput) {
            teleportInput.disabled = settings?.developer !== true;
        }

        const moneyRow = document.getElementById("_moneyrow");
        if (moneyRow) {
            moneyRow.style.display = settings?.developer === true ? "flex" : "none";
        }

        const moneyInput = document.getElementById("_moneyamount");
        if (moneyInput) {
            moneyInput.disabled = settings?.developer !== true;
        }

        const moneyButton = document.getElementById("_moneybtn");
        if (moneyButton) {
            moneyButton.disabled = settings?.developer !== true;
        }
    }

    function toggledeveloper() {
        settings.developer = !settings.developer;
        updateuisettings();
        printcurrentsection();
        savesettings();
    }

    global.getcoordsfromstring = getcoordsfromstring;
    global.calculateDistance = calculateDistance;
    global.generateObjednavky = generateObjednavky;
    global.buyDeliverySlot = buyDeliverySlot;
    global.changeobjednavkastatus = changeobjednavkastatus;
    global.updateuisettings = updateuisettings;
    global.toggledeveloper = toggledeveloper;
})(window);
