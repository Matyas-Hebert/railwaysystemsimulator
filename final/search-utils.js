(function (global) {
    function normalize(string) {
        return String(string || "")
            .normalize("NFD")
            .replace(/-/g, '')
            .replace(/\./g, '')
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ /g, '')
            .toLowerCase();
    }

    function searchstations(search, firstid = null) {
        let updatedsearch = normalize(search);
        let valid = [];
        let exact = [];
        let first = null;
        timetable.stations.forEach(station => {
            let name = normalize(getstationname(station));
            if (name == updatedsearch || name.replace("hln", "") == updatedsearch || name.replace("hls", "") == updatedsearch) {
                exact.push({ name: getstationname(station), district: station.district, id: station.id, color: false });
            }
            else if (name.includes(updatedsearch)) {
                if (station.id == firstid) {
                    first = { name: getstationname(station), district: station.district, id: station.id, color: true };
                }
                else {
                    valid.push({ name: getstationname(station), district: station.district, id: station.id, color: false });
                }
            }
        });
        valid = valid.sort((a, b) => getstationname(a).localeCompare(getstationname(b), 'cs'));
        exact.forEach(ex => {
            valid.unshift(ex);
        });
        if (first != null) {
            valid.unshift(first);
        }
        return valid;
    }

    function search(search, options = _s1options, section4 = false, id = 0, inputfield = null, clear = false, start = false) {
        options.innerHTML = "";
        let i = 0;
        if (clear) {
            inputfield.value = "";
            search = inputfield.value;
        }
        let opts;
        if (currentsection == 4 && currentposition.transporttype == 0) {
            opts = searchstations(search, currentposition.statID);
        }
        else {
            opts = searchstations(search);
        }
        opts.slice(0, 20).forEach(opt => {
            let newdiv = document.createElement("div");
            newdiv.className = "search-result";
            newdiv.onclick = function () {
                if (section4) {
                    section4ids[id] = opt.id;
                    inputfield.value = getstationname(opt);
                }
                if (start) {
                    startid = opt.id;
                    inputfield.value = getstationname(opt);
                }
                else {
                    section1id = opt.id;
                }
                options.innerHTML = "";
                printcurrentsection();
            };
            newdiv.innerHTML = `
                <span class="main-text">${getstationname(opt)}</span>
                <span class="alt-text">${opt.district}</span>
            `;
            if (opt.color) {
                newdiv.className = "colored-search-result";
            }
            options.appendChild(newdiv);
            i++;
        });
    }

    function closes1options() {
        _s1options.innerHTML = "";
    }

    function decreasetime() {
        idostime -= 60 * 30;
        updateidostimeview();
    }

    function increasetime() {
        idostime += 60 * 30;
        updateidostimeview();
    }

    function updateidostime() {
        let parts = _idostime.value.split(":");
        if (parts.length < 2) {
            return;
        }
        let hours = parseInt(parts[0], 10);
        let minutes = parseInt(parts[1], 10);
        console.log(hours, minutes);
        if (minutes > 100) {
            hours = Math.min((hours % 10) * 10, 20);
            console.log(hours, minutes);
            hours += Math.floor(minutes / 100);
            console.log(hours, minutes);
            minutes %= 100;
        }
        console.log(hours, minutes);
        idostime = hours * 3600 + minutes * 60;
        updateidostimeview();
    }

    function updateidostimeview() {
        _idostime.value = formatTime(idostime, false, false);
    }

    global.normalize = normalize;
    global.searchstations = searchstations;
    global.search = search;
    global.closes1options = closes1options;
    global.decreasetime = decreasetime;
    global.increasetime = increasetime;
    global.updateidostime = updateidostime;
    global.updateidostimeview = updateidostimeview;
})(window);
