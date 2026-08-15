const schedule = (() => {
function getAutoTravelStatus(lineID) {
    const autoBoardSelection = gameState.getAutoBoardSelection();
    const autoExitStationId = gameState.getAutoExitStationId(lineID);
    if (autoBoardSelection !== null && autoExitStationId !== null) {
        return "S AUTOMATICKÝM NÁSTUPEM +<br>S AUTOMATICKÝM VÝSTUPEM V "
            + settings.getStationName(timetable.stations[autoExitStationId]);
    }
    if (autoBoardSelection !== null) return "S AUTOMATICKÝM NÁSTUPEM";
    if (autoExitStationId !== null) {
        return "S AUTOMATICKÝM VÝSTUPEM V "
            + settings.getStationName(timetable.stations[autoExitStationId]);
    }
    return "BEZ AUTOMATICKÉHO NÁSTUPU";
}

function roundSignedPrice(price) {
    return price < 0
        ? -Math.round(Math.abs(price))
        : Math.round(price);
}

function getAutoExitRebooking(lineID, stationId, currentStationId) {
    const pricing = journeyPricing.getLineConfig(lineID);
    const bookedStationId = gameState.getAutoExitStationId(lineID);
    if (bookedStationId === stationId) {
        return { selected: true, priceDifference: 0, label: "VYBRÁNO" };
    }

    let priceDifference;
    if (!pricing.must_auto_ride) {
        priceDifference = bookedStationId === null
            ? Math.ceil(pricing.auto_leave_price)
            : 0;
    }
    else if (bookedStationId !== null) {
        const distanceDifference = journeyPricing.getDistanceDifferenceBetweenStops(
            lineID,
            bookedStationId,
            stationId
        );
        if (distanceDifference === null) return null;
        priceDifference = roundSignedPrice(distanceDifference * pricing.price_per_km);
    }
    else {
        const distance = journeyPricing.getDistanceBetweenStops(
            lineID,
            currentStationId,
            stationId
        );
        if (distance === null) return null;
        priceDifference = Math.ceil(
            pricing.auto_leave_price + distance * pricing.price_per_km
        );
    }

    const label = priceDifference === 0
        ? "ZDARMA"
        : priceDifference < 0
            ? "+" + String(Math.abs(priceDifference)) + ",-"
            : String(priceDifference) + ",-";
    return { selected: false, priceDifference, label };
}

function toggle(clickedrow, stopsdata, conn = null, allowAutoBoard = false){
    if (!stopsdata) return;
    const detail = document.querySelector(".detail");

    if (detail && detail.previousElementSibling === clickedrow){
        document.querySelectorAll(".detail").forEach(el => el.remove());
        openeddetail = "";
        return;
    }

    if (detail){
        document.querySelectorAll(".detail").forEach(el => el.remove());
    }

    let detailrow = _timetable.insertRow(clickedrow.rowIndex+1);
    detailrow.className = "detail";

    let c1 = detailrow.insertCell(0);
    let c2 = detailrow.insertCell(1);
    let c3 = detailrow.insertCell(2);
    //let c4 = detailrow.insertCell(3);

    c1.innerText = "STANICE";
    c2.innerText = "PŘÍJEZD";
    c3.innerText = "ODJEZD";
    //c4.innerText = "VZDÁLENOST";

    let detailOffset = 1;
    if (allowAutoBoard && conn !== null) {
        const line = timetable.lines[conn.lineID];
        const pricing = journeyPricing.getLineConfig(conn.lineID);
        const normalizedConnection = normalizeAutoBoardConnection(conn);
        const refundable = gameState.getSpentOnAutoBoard() + gameState.getSpentOnAutoExit();
        const returnButton = refundable > 0
            ? `<button class="ticket-purchase-button ticket-return-button">VRÁTIT</button>`
            : "";
        const statusRow = addRow({
            table: _timetable,
            c1t: getAutoTravelStatus(conn.lineID),
            c2t: returnButton,
            firstcolspan: true,
            onlythreecols: true,
            includered: false
        });
        statusRow.className = "detail auto-travel-status-row";
        statusRow.cells[0].classList.add("ticket-purchase-label");
        const returnButtonElement = statusRow.querySelector(".ticket-return-button");
        if (returnButtonElement !== null) {
            returnButtonElement.onclick = event => {
                event.stopPropagation();
                gameState.returnAutoTravel();
                settings.render();
                renderCurrentSection(true);
            };
        }
        statusRow.parentNode.insertBefore(statusRow, detailrow);
        detailOffset++;

        const destinationSelect = document.createElement("select");
        destinationSelect.className = "ticket-destination-select";
        destinationSelect.setAttribute("aria-label", "Cílová stanice jízdenky");

        const placeholder = document.createElement("option");
        placeholder.value = "-1";
        placeholder.textContent = "VYBERTE CÍLOVOU STANICI";
        destinationSelect.appendChild(placeholder);

        stopsdata.forEach(stopdata => {
            const option = document.createElement("option");
            option.value = String(stopdata.id);
            option.textContent = stopdata.station;
            destinationSelect.appendChild(option);
        });

        const selectedDestinationExists = stopsdata.some(
            stopdata => stopdata.id == filters.ticketDestinationStatId
        );
        destinationSelect.value = selectedDestinationExists
            ? String(filters.ticketDestinationStatId)
            : "-1";
        destinationSelect.addEventListener("focus", () => {
            isOpenTicket = true;
        });
        destinationSelect.addEventListener("blur", () => {
            isOpenTicket = false;
        });
        destinationSelect.addEventListener("change", event => {
            event.stopPropagation();
            isOpenTicket = false;
            selectTicketDestination(event.target.value);
        });
        const destinationRow = _timetable.insertRow(-1);
        destinationRow.className = "detail ticket-destination-detail-row";
        const destinationCell = destinationRow.insertCell(0);
        destinationCell.colSpan = 3;
        destinationCell.appendChild(destinationSelect);
        destinationRow.parentNode.insertBefore(destinationRow, detailrow);
        detailOffset++;

        if (!pricing.must_auto_ride) {
            const autoBoardPrice = pricing.auto_board_price;
            const purchaseRow = addRow({
                table: _timetable,
                c1t: "AUTOMATICKÝ NÁSTUP",
                c2t: `<button class="ticket-purchase-button">KOUPIT<br>${autoBoardPrice},-</button>`,
                firstcolspan: true,
                onlythreecols: true,
                includered: false
            });
            purchaseRow.className = "detail ticket-purchase-detail-row";
            purchaseRow.cells[0].classList.add("ticket-purchase-label");
            const purchaseButton = purchaseRow.querySelector(".ticket-purchase-button");
            purchaseButton.onclick = event => {
                event.stopPropagation();
                const purchased = gameState.purchaseAutoTravel({
                    autoBoardSelection: normalizedConnection,
                    spentOnAutoBoard: autoBoardPrice
                });
                if (!purchased) {
                    purchaseButton.innerHTML = "NEDOSTATEK<br>PENĚZ";
                    return;
                }
                settings.render();
                renderCurrentSection(true);
            };
            purchaseRow.parentNode.insertBefore(purchaseRow, detailrow);
            detailOffset++;
        }

        if (selectedDestinationExists) {
            const exitStationId = Number(filters.ticketDestinationStatId);
            const journeyLength = journeyPricing.getDistanceBetweenStops(
                conn.lineID,
                gameState.getCurrentPosition().statID,
                exitStationId
            );
            if (journeyLength !== null) {
                const spentOnAutoBoard = pricing.auto_board_price;
                const spentOnAutoExit = Math.ceil(
                    pricing.auto_leave_price
                    + pricing.price_per_km * journeyLength
                );
                const autoJourneyPrice = spentOnAutoBoard + spentOnAutoExit;
                const stationName = settings.getStationName(timetable.stations[exitStationId]);
                const journeyRow = addRow({
                    table: _timetable,
                    c1t: "AUTOMATICKÝ NÁSTUP +<br>AUTOMATICKÝ VÝSTUP V " + stationName,
                    c2t: `<button class="ticket-purchase-button">KOUPIT<br>${autoJourneyPrice},-</button>`,
                    firstcolspan: true,
                    onlythreecols: true,
                    includered: false
                });
                journeyRow.className = "detail ticket-purchase-detail-row";
                journeyRow.cells[0].classList.add("ticket-purchase-label");
                const journeyButton = journeyRow.querySelector(".ticket-purchase-button");
                journeyButton.onclick = event => {
                    event.stopPropagation();
                    const purchased = gameState.purchaseAutoTravel({
                        autoBoardSelection: normalizedConnection,
                        autoExitStationId: exitStationId,
                        spentOnAutoBoard,
                        spentOnAutoExit
                    });
                    if (!purchased) {
                        journeyButton.innerHTML = "NEDOSTATEK<br>PENĚZ";
                        return;
                    }
                    settings.render();
                    renderCurrentSection(true);
                };
                journeyRow.parentNode.insertBefore(journeyRow, detailrow);
                detailOffset++;
            }
        }
    }

    let i = detailOffset;
    stopsdata.forEach(stopdata => {
        let detailrow = _timetable.insertRow(clickedrow.rowIndex+1+i);
        detailrow.className = "detail";

        let c1 = detailrow.insertCell(0);
        let c2 = detailrow.insertCell(1);
        let c3 = detailrow.insertCell(2);
        //let c4 = detailrow.insertCell(3);

        if (stopdata.station.length >= 17){
            c1.innerHTML = `<div class="scroll-container"><div class="scroll-text">${settings.getStationNameMarkup(timetable.stations[stopdata.id])}</div></div><div class="subtext">${timetable.stations[stopdata.id].district}</div>`;
        }
        else{
            c1.innerHTML = `<div>${settings.getStationNameMarkup(timetable.stations[stopdata.id])}</div></div><div class="subtext">${timetable.stations[stopdata.id].district}</div>`;
        }
        c2.innerText = stopdata.arr;
        c3.innerText = stopdata.dep;
        //c4.innerText = stopdata.dist;

        if (stopdata.id == filters.statid){
            c1.className = "delayed";
        }

        c1.onclick = function() {
            section1id = stopdata.id;
            changeCurrentSection(1);
        };
        i++;
    });
}

function updateTrackProgress(status, progress, station1, station2){
    _doublestop.className = "inactive";
    _singlestop.className = "inactive";
    _firststop.className = "inactive";
    _laststop.className = "inactive";
    if (status === TRAIN_STATUS.CANCELLED_BEFORE_TARGET || status === TRAIN_STATUS.CANCELLED_AFTER_TARGET){
        _singlestop.className = "active";
        settings.setStationName(_sss1, timetable.stations[station1]);
        _sss1.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
    if (status === TRAIN_STATUS.NOT_DEPARTED){
        _firststop.className = "active";
        settings.setStationName(_fss1, timetable.stations[station1]);
        _fss1.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
    if (status === TRAIN_STATUS.FINISHED){
        _laststop.className = "active";
        settings.setStationName(_lss1, timetable.stations[station1]);
        _lss1.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
    if (status === TRAIN_STATUS.STOPPED_BEFORE_TARGET || status === TRAIN_STATUS.STOPPED_AT_TARGET || status === TRAIN_STATUS.STOPPED_PAST_TARGET){
        _singlestop.className = "active";
        settings.setStationName(_sss1, timetable.stations[station1]);
        _sss1.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
    if (status === TRAIN_STATUS.TRAVELLING_TO_TARGET || status === TRAIN_STATUS.TRAVELLING_PAST_TARGET){
        _doublestop.className = "active";
        progress = Math.floor(progress*100);
        _dspt.style.setProperty("width", `${progress}%`, "important");
        settings.setStationName(_dss1, timetable.stations[station2]);
        settings.setStationName(_dss2, timetable.stations[station1]);
        _dss1.onclick = function(){
            section1id = station2;
            changeCurrentSection(1);
        };
        _dss2.onclick = function(){
            section1id = station1;
            changeCurrentSection(1);
        };
    }
}

function print(table=_information, conns=connstruct, checkifkick=false, getoffbutton=false){
    if (Object.keys(conns).length == 0){
        return;
    }
    let lineID = conns.lineID;
    let tripID = conns.tripID;
    let dayssinceepoch = Math.floor(getCurrentTimeInMilliseconds() / MILLISECONDS_PER_DAY);
    let day = conns.day;
    if (day >= 100){
        day = day-dayssinceepoch;
    }
    let hidesinfront = conns.hidesinfront;
    if (lineID == null || tripID == null){
        return;
    }
    let time = getCurrentTimeInSeconds();
    table.innerHTML = "";
    _traintimetableheader.innerHTML = "";
    let line = timetable.lines[lineID];
    let stops = line.stops;
    let delay = delays.get(lineID, tripID, time, stops[stops.length-1], day);
    if (checkifkick){
        if (delay.status === TRAIN_STATUS.FINISHED){
            changeTransportType(0);
            gameState.updateCurrentPosition({statID: stops[stops.length-1].sid});
            renderCurrentSection();
        }
        if (delay.status === TRAIN_STATUS.CANCELLED_BEFORE_TARGET || delay.status === TRAIN_STATUS.CANCELLED_AFTER_TARGET){
            changeTransportType(0);
            gameState.updateCurrentPosition({statID: delay.station});
            renderCurrentSection();
        }
    }
    if (delay.station == null){
        hidesinfront = false;
    }
    let hideuntil = delay.station;
    if (currentsection == 2 || currentsection == 0){
        let secst = stops[stops.length-1].sid;
        if (delay.status === TRAIN_STATUS.TRAVELLING_TO_TARGET || delay.status === TRAIN_STATUS.TRAVELLING_PAST_TARGET){
            for(let i=0; i<stops.length; i++){
                if (stops[i].sid == delay.station){
                    break;
                }
                secst = stops[i].sid
                hideuntil = secst;
            }
        }
        if (delay.station == null){
            updateTrackProgress(delay.status, delay.progress, secst, 1);
        }
        else{
            updateTrackProgress(delay.status, delay.progress, delay.station, secst);
        }
    }
    let delaystring = "+"+String(Math.floor(delay.delay/60));
    let delayreason = (delay.delay >= 300 ? delays.getReason(lineID, tripID, day) : "");

    let row = addRow({
        "table": _traintimetableheader,
        "c1t": "Vlak",
        "c2t": "Z/DO",
        "c3t": delaystring,
        "subtexttime": delayreason,
        "includered": delay.delay>=60 || delay.status === TRAIN_STATUS.CANCELLED_BEFORE_TARGET,
        "onlythreecols": true});

    row = addRow({
        "table": _traintimetableheader,
        "c1t": getTrainName(line),
        "c2t": "Z "+settings.getStationNameMarkup(timetable.stations[stops[0].sid]),
        "subtexttrain": line.nickname,
        "subtextdest": "Do "+settings.getStationNameMarkup(timetable.stations[stops[stops.length-1].sid]),
        "noclasssubtextdest": true,
        "includered": false,
        "onlythreecols": true});

    row.cells[0].onclick = function(){
        section2data = conns;
        changeCurrentSection(2);
    }

    row.deleteCell(2);
    row.cells[1].colSpan = 2;
    if (getoffbutton && delay.status === TRAIN_STATUS.STOPPED_BEFORE_TARGET || delay.status === TRAIN_STATUS.STOPPED_AT_TARGET || delay.status === TRAIN_STATUS.STOPPED_PAST_TARGET){
        row.cells[1].innerHTML = "VYSTOUPIT";
        row.cells[1].style.backgroundColor = "#861313";
        row.cells[1].onclick = function(){
            changeTransportType(0);
            gameState.updateCurrentPosition({statID: delay.station});
            renderCurrentSection();
        };
    }

    if (currentsection == 2){
        row = addRow({
            "table": _traintimetableheader,
            "c1t": "< Předchozí",
            "c2t": hidesinfront ? "Zobrazit" : "Skrýt",
            "c3t": "Následující >",
            "includered": false,
            "onlythreecols": true
        })

        row.cells[0].style.backgroundColor = "green";
        row.cells[0].style.fontWeight = "normal";
        row.cells[0].onclick = function(){
            let newtripid = tripID == 0 ? line.trips-1 : tripID-1;
            let newday = tripID == 0 ? day-1 : day;
            section2data = {"lineID": lineID, "tripID": newtripid, "day": newday, "hidesinfront": hidesinfront};
            renderCurrentSection();
        };
        row.cells[1].onclick = function(){
            section2data = {"lineID": lineID, "tripID": tripID, "day": day, "hidesinfront": !hidesinfront};
            renderCurrentSection();
        }
        row.cells[2].style.backgroundColor = "green";
        row.cells[2].onclick = function(){
            let newtripid = tripID == line.trips-1 ? 0 : tripID+1;
            let newday = tripID == line.trips-1 ? day+1 : day;
            section2data = {"lineID": lineID, "tripID": newtripid, "day": newday, "hidesinfront": hidesinfront};
            renderCurrentSection();
        };
    }

    row = addRow({
        "table": table
    });
    row.className = "border";

    addRow({
        "table": table,
        "c1t": "Stanice",
        "c2t": "Příjezd",
        "c3t": "Odjezd",
        "c4t": "Vzdálenost",
        "includered": false});

    let starttime = line.starttime + day*SECONDS_PER_DAY + tripID*line.interval;

    let distacc = 0;
    let i = 0;
    let visibleStopIndex = 0;
    let tocolor = true;
    let toprint = !hidesinfront;
    stops.forEach(stop => {
        if (hideuntil == stop.sid){
            toprint = true;
        }
        distacc += stop.dist;
        if (toprint){
            let arrstr = i == 0 ? "-" : formatTime(stop.arr+starttime);
            let depstr = i == stops.length - 1 ? " - " : formatTime(stop.dep+starttime);
            let stname = settings.getStationName(timetable.stations[stop.sid]);
            row = addRow({
                "table": table,
                "c1t": settings.getStationNameMarkup(timetable.stations[stop.sid]),
                "visibleoverflow": true
            });
            row.cells[0].onclick = function(){
                section1id = stop.sid;
                changeCurrentSection(1);
            }

            if (getoffbutton && currentsection === 0 && visibleStopIndex > 0) {
                const currentStationId = delay.station
                    ?? gameState.getCurrentPosition().statID;
                const rebooking = getAutoExitRebooking(lineID, stop.sid, currentStationId);
                if (rebooking !== null) {
                    if (rebooking.selected) row.classList.add("auto-exit-selected-row");

                    const actionCell = row.cells[3];
                    actionCell.classList.add("auto-exit-cell");
                    const button = document.createElement("button");
                    button.className = rebooking.selected
                        ? "auto-exit-btn selected"
                        : "auto-exit-btn";
                    button.innerHTML = `<span class="auto-exit-icon">🏁</span>`
                        + `<span class="auto-exit-price">${rebooking.label}</span>`;
                    button.title = rebooking.selected
                        ? "Aktuálně zvolená stanice automatického výstupu"
                        : "Přebookovat automatický výstup do této stanice";
                    button.setAttribute("aria-label", button.title);
                    button.setAttribute("aria-pressed", String(rebooking.selected));
                    if (!rebooking.selected) {
                        button.onclick = event => {
                            event.stopPropagation();
                            const rebooked = gameState.rebookAutoExit(
                                stop.sid,
                                rebooking.priceDifference
                            );
                            if (!rebooked) {
                                button.querySelector(".auto-exit-price").textContent
                                    = "NEDOSTATEK";
                                return;
                            }
                            settings.render();
                            renderCurrentSection(true);
                        };
                    }
                    actionCell.appendChild(button);
                }
            }

            row.cells[0].style.textWrap = "nowrap";
            row = addRow({
                "table": table,
                "c2t": arrstr,
                "c3t": depstr,
                "c4t": String(Math.round(distacc))+"km",
                "scrollingfirstcol": stname.length>=12,
                "includered": false});
            if (stop.sid == delay.station){
                if (delay.status === TRAIN_STATUS.STOPPED_BEFORE_TARGET){
                    row.cells[1].classList.add("lime");
                }
                tocolor = false;
            }
            if (tocolor){
                row.cells[1].classList.add("lime");
                row.cells[2].classList.add("lime");
            }
            visibleStopIndex++;
        }
        i++;
    });
}

    return { toggle, print, updateTrackProgress: updateTrackProgress };
})();
