const stationSearch = (() => {
function normalize(string){
    return string.normalize("NFD").replace(/-/g, '').replace(/\./g, '').replace(/[\u0300-\u036f]/g, "").replace(/ /g,'').toLowerCase();
}

function searchStations(search, firstid=null){
    let updatedsearch = normalize(search);
    let valid = [];
    let exact = [];
    let first = null;
    timetable.stations.forEach(station => {
        let name = normalize(settings.getStationName(station));
        if (name == updatedsearch || name.replace("hln", "") == updatedsearch || name.replace("hls", "") == updatedsearch){
            exact.push({"name":settings.getStationName(station), "district":station.district, "id": station.id, "color": false, "station": station});
        }
        else if (name.includes(updatedsearch)){
            if (station.id == firstid){
                first = {"name":settings.getStationName(station), "district":station.district, "id": station.id, "color": true, "station": station};
            }
            else{
                valid.push({"name":settings.getStationName(station), "district":station.district, "id": station.id, "color": false, "station": station});
            }
        }
    });
    valid = valid.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    exact.forEach(ex =>{
        valid.unshift(ex);
    })
    if (first != null){
        valid.unshift(first);
    }
    return valid;
}

function show(search, options=_s1options, section4 = false, id=0, inputfield=null, clear=false, start=false){
    options.innerHTML = "";
    let i = 0;
    if (clear){
        inputfield.value = "";
        search = inputfield.value;
    }
    let opts;
    if (currentsection == 4 && gameState.getCurrentPosition().transporttype === TRANSPORT_TYPE.STATION){
        opts = searchStations(search, gameState.getCurrentPosition().statID);
    }
    else{
        opts = searchStations(search);
    }
    opts.slice(0,20).forEach(opt => {
        let newdiv = document.createElement("div");
        newdiv.className = "search-result";
        newdiv.onclick = function(){
            if (section4){
                idos.setLocation(id, opt.id);
                inputfield.value = opt.name;
                settings.setStationName(inputfield, opt.station);
            }
            if (start){
                startid = opt.id;
                inputfield.value = opt.name;
                settings.setStationName(inputfield, opt.station);
            }
            else {
                section1id = opt.id;
            }
            options.innerHTML = "";
            renderCurrentSection();
        };
        newdiv.innerHTML = `
            <span class="main-text ${stationVisits.isVisited(opt.id) ? "station-name-visited" : "station-name-unvisited"}">${opt.name}</span>
            <span class="alt-text">${opt.district}</span>
        `;
        if (opt.color){
            newdiv.className = "colored-search-result";
        }
        options.appendChild(newdiv);
        i++;
    });
}

function closeStationOptions(){
    _s1options.innerHTML = "";
}

    return { show, closeStationOptions };
})();
