import * as delays from "./delays.js";
import * as journeyPricing from "./journey-pricing.js";
import * as settings from "./settings.js";
import * as tripRoutes from "./trip-routes.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as constants from "./constants.js";

function getAutoTravelStatus(lineID) {
    const autoBoardSelection = runtime.getGameState().getAutoBoardSelection();
    const autoExitStationId = runtime.getGameState().getAutoExitStationId(lineID);
    if (autoBoardSelection !== null && autoExitStationId !== null) {
        return "S AUTOMATICKÝM NÁSTUPEM +<br>S AUTOMATICKÝM VÝSTUPEM V "
            + settings.getStationName(data.timetable.stations[autoExitStationId]);
    }
    if (autoBoardSelection !== null) return "S AUTOMATICKÝM NÁSTUPEM";
    if (autoExitStationId !== null) {
        return "S AUTOMATICKÝM VÝSTUPEM V "
            + settings.getStationName(data.timetable.stations[autoExitStationId]);
    }
    return "BEZ AUTOMATICKÉHO NÁSTUPU";
}
function addAutoTravelStatusRow(table) {
    const autoBoardSelection = runtime.getGameState().getAutoBoardSelection();
    if (autoBoardSelection === null) return null;

    const line = data.timetable.lines[autoBoardSelection.lineID];
    const autoExitStationId = runtime.getGameState().getAutoExitStationId(autoBoardSelection.lineID);
    const refundable = Math.round(
        runtime.getGameState().getSpentOnAutoBoard() + runtime.getGameState().getSpentOnAutoExit()
    );
    const ticketAction = autoExitStationId === null
        ? "NÁSTUP"
        : "CESTA DO<br>" + settings.getStationNameMarkup(
            data.timetable.stations[autoExitStationId]
        );

    const headerRow = app.addRow({
        table,
        c1t: "JÍZDENKY",
        firstcolspan: true,
        onlythreecols: true,
        includered: false
    });
    headerRow.cells[0].colSpan = 3;
    headerRow.deleteCell(1);

    const ticketRow = app.addRow({
        table,
        c1t: app.getTrainName(line),
        c2t: ticketAction,
        c3t: `<button class="ticket-purchase-button ticket-return-button">VRÁTIT ${refundable},-</button>`,
        subtexttrain: line.nickname,
        onlythreecols: true,
        includered: false
    });

    [headerRow, ticketRow].forEach(row => {
        row.className = "auto-travel-status-row";
        Array.from(row.cells).forEach(cell => {
            cell.style.backgroundColor = "var(--color-warning)";
            cell.style.color = "var(--color-text-dark)";
        });
    });

    ticketRow.querySelector(".ticket-return-button").onclick = event => {
        event.stopPropagation();
        runtime.getGameState().returnAutoTravel();
        app.renderCurrentSection(true);
    };
    return ticketRow;
}
function roundSignedPrice(price) {
    return price < 0
        ? -Math.round(Math.abs(price))
        : Math.round(price);
}

function getAutoExitRebooking(lineID, tripID, stationId, currentStationId) {
    const pricing = journeyPricing.getLineConfig(lineID);
    const bookedStationId = runtime.getGameState().getAutoExitStationId(lineID);
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
        const distanceDifference = journeyPricing.getTripDistanceDifferenceBetweenStops(
            lineID,
            tripID,
            bookedStationId,
            stationId
        );
        if (distanceDifference === null) return null;
        priceDifference = roundSignedPrice(distanceDifference * pricing.price_per_km);
    }
    else {
        const distance = journeyPricing.getTripDistanceBetweenStops(
            lineID,
            tripID,
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
        runtime.setOpenedDetail("");
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
        const line = data.timetable.lines[conn.lineID];
        const pricing = journeyPricing.getLineConfig(conn.lineID);
        const normalizedConnection = app.normalizeAutoBoardConnection(conn);
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
            stopdata => stopdata.id == runtime.getFilters().ticketDestinationStatId
        );
        destinationSelect.value = selectedDestinationExists
            ? String(runtime.getFilters().ticketDestinationStatId)
            : "-1";
        destinationSelect.addEventListener("focus", () => {
            runtime.setTicketSelectionOpen(true);
        });
        destinationSelect.addEventListener("blur", () => {
            runtime.setTicketSelectionOpen(false);
        });
        destinationSelect.addEventListener("change", event => {
            event.stopPropagation();
            runtime.setTicketSelectionOpen(false);
            app.selectTicketDestination(event.target.value);
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
            const purchaseRow = app.addRow({
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
                const purchased = runtime.getGameState().purchaseAutoTravel({
                    autoBoardSelection: normalizedConnection,
                    spentOnAutoBoard: autoBoardPrice
                });
                if (!purchased) {
                    purchaseButton.innerHTML = "NEDOSTATEK<br>PENĚZ";
                    return;
                }
                app.renderCurrentSection(true);
            };
            purchaseRow.parentNode.insertBefore(purchaseRow, detailrow);
            detailOffset++;
        }

        if (selectedDestinationExists) {
            const exitStationId = Number(runtime.getFilters().ticketDestinationStatId);
            const journeyLength = journeyPricing.getTripDistanceBetweenStops(
                conn.lineID,
                conn.tripID,
                runtime.getGameState().getCurrentPosition().statID,
                exitStationId,
                conn.stopIndex
            );
            if (journeyLength !== null) {
                const spentOnAutoBoard = pricing.auto_board_price;
                const spentOnAutoExit = Math.ceil(
                    pricing.auto_leave_price
                    + pricing.price_per_km * journeyLength
                );
                const autoJourneyPrice = spentOnAutoBoard + spentOnAutoExit;
                const stationName = settings.getStationName(data.timetable.stations[exitStationId]);
                const journeyRow = app.addRow({
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
                    const purchased = runtime.getGameState().purchaseAutoTravel({
                        autoBoardSelection: normalizedConnection,
                        autoExitStationId: exitStationId,
                        spentOnAutoBoard,
                        spentOnAutoExit
                    });
                    if (!purchased) {
                        journeyButton.innerHTML = "NEDOSTATEK<br>PENĚZ";
                        return;
                    }
                    app.renderCurrentSection(true);
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
            c1.innerHTML = `<div class="scroll-container"><div class="scroll-text">${settings.getStationNameMarkup(data.timetable.stations[stopdata.id])}</div></div><div class="subtext">${data.timetable.stations[stopdata.id].district}</div>`;
        }
        else{
            c1.innerHTML = `<div>${settings.getStationNameMarkup(data.timetable.stations[stopdata.id])}</div></div><div class="subtext">${data.timetable.stations[stopdata.id].district}</div>`;
        }
        c2.innerText = stopdata.arr;
        c3.innerText = stopdata.dep;
        //c4.innerText = stopdata.dist;

        if (stopdata.id == runtime.getFilters().statid){
            c1.className = "delayed";
        }

        c1.onclick = function() {
            runtime.setStationSectionId(stopdata.id);
            app.changeCurrentSection(1);
        };
        i++;
    });
}

function updateTrackProgress(
    status,
    progress,
    station1,
    station2,
    station1Prefix = "",
    station2Prefix = ""
){
    _doublestop.className = "inactive";
    _singlestop.className = "inactive";
    _firststop.className = "inactive";
    _laststop.className = "inactive";
    if (status === constants.TRAIN_STATUS.CANCELLED_BEFORE_TARGET || status === constants.TRAIN_STATUS.CANCELLED_AFTER_TARGET){
        _singlestop.className = "active";
        settings.setStationName(_sss1, data.timetable.stations[station1]);
        _sss1.onclick = function(){
            runtime.setStationSectionId(station1);
            app.changeCurrentSection(1);
        };
    }
    if (status === constants.TRAIN_STATUS.NOT_DEPARTED){
        _firststop.className = "active";
        settings.setStationName(_fss1, data.timetable.stations[station1]);
        _fss1.onclick = function(){
            runtime.setStationSectionId(station1);
            app.changeCurrentSection(1);
        };
    }
    if (status === constants.TRAIN_STATUS.FINISHED){
        _laststop.className = "active";
        settings.setStationName(_lss1, data.timetable.stations[station1]);
        _lss1.onclick = function(){
            runtime.setStationSectionId(station1);
            app.changeCurrentSection(1);
        };
    }
    if (status === constants.TRAIN_STATUS.STOPPED_BEFORE_TARGET || status === constants.TRAIN_STATUS.STOPPED_AT_TARGET || status === constants.TRAIN_STATUS.STOPPED_PAST_TARGET){
        _singlestop.className = "active";
        settings.setStationName(_sss1, data.timetable.stations[station1]);
        _sss1.onclick = function(){
            runtime.setStationSectionId(station1);
            app.changeCurrentSection(1);
        };
    }
    if (status === constants.TRAIN_STATUS.TRAVELLING_TO_TARGET || status === constants.TRAIN_STATUS.TRAVELLING_PAST_TARGET){
        _doublestop.className = "active";
        progress = Math.floor(progress*100);
        _dspt.style.setProperty("width", `${progress}%`, "important");
        settings.setStationName(_dss1, data.timetable.stations[station2], station2Prefix);
        settings.setStationName(_dss2, data.timetable.stations[station1], station1Prefix);
        _dss1.onclick = function(){
            runtime.setStationSectionId(station2);
            app.changeCurrentSection(1);
        };
        _dss2.onclick = function(){
            runtime.setStationSectionId(station1);
            app.changeCurrentSection(1);
        };
    }
}

function print(table=_information, conns=runtime.getConnectionStructure(), checkifkick=false, getoffbutton=false){
    if (Object.keys(conns).length == 0){
        return;
    }
    let lineID = conns.lineID;
    let tripID = conns.tripID;
    let dayssinceepoch = Math.floor(app.getCurrentTimeInMilliseconds() / constants.MILLISECONDS_PER_DAY);
    let day = conns.day;
    if (day >= 100){
        day = day-dayssinceepoch;
    }
    let hidesinfront = conns.hidesinfront;
    if (lineID == null || tripID == null){
        return;
    }
    let time = app.getCurrentTimeInSeconds();
    table.innerHTML = "";
    _traintimetableheader.innerHTML = "";
    let line = data.timetable.lines[lineID];
    const route = tripRoutes.getTripRoute(lineID, tripID);
    if (route === null) return;
    let stops = route.stops;
    let delay = delays.get(
        lineID,
        tripID,
        time,
        route.destinationStationId,
        day,
        route.endIndex
    );
    if (checkifkick){
        if (delay.status === constants.TRAIN_STATUS.FINISHED){
            runtime.getGameState().changeTransportType(constants.TRANSPORT_TYPE.STATION);
            runtime.getGameState().updateCurrentPosition({statID: route.destinationStationId});
            app.renderCurrentSection();
        }
        if (delay.status === constants.TRAIN_STATUS.CANCELLED_BEFORE_TARGET || delay.status === constants.TRAIN_STATUS.CANCELLED_AFTER_TARGET){
            runtime.getGameState().changeTransportType(constants.TRANSPORT_TYPE.STATION);
            runtime.getGameState().updateCurrentPosition({statID: delay.station});
            app.renderCurrentSection();
        }
    }
    if (delay.station == null){
        hidesinfront = false;
    }
    let hideUntilStopIndex = delay.stopIndex;
    if (runtime.getCurrentSection() == 2 || runtime.getCurrentSection() == 0){
        const previousStopIndex = Math.max(
            route.startIndex,
            delay.stopIndex - 1
        );
        const previousStationId = line.stops[previousStopIndex].sid;
        if (
            delay.status === constants.TRAIN_STATUS.TRAVELLING_TO_TARGET
            || delay.status === constants.TRAIN_STATUS.TRAVELLING_PAST_TARGET
        ) {
            hideUntilStopIndex = previousStopIndex;
        }
        updateTrackProgress(
            delay.status,
            delay.progress,
            delay.station ?? route.destinationStationId,
            previousStationId
        );
    }
    let delaystring = "+"+String(Math.floor(delay.delay/60));
    let delayreason = (delay.delay >= 300 ? delays.getReason(lineID, tripID, day) : "");

    let row = app.addRow({
        "table": _traintimetableheader,
        "c1t": "Vlak",
        "c2t": "Z/DO",
        "c3t": delaystring,
        "subtexttime": delayreason,
        "includered": delay.delay>=60 || delay.status === constants.TRAIN_STATUS.CANCELLED_BEFORE_TARGET,
        "onlythreecols": true});

    row = app.addRow({
        "table": _traintimetableheader,
        "c1t": app.getTrainName(line),
        "c2t": "Z "+settings.getStationNameMarkup(data.timetable.stations[stops[0].sid]),
        "subtexttrain": line.nickname,
        "subtextdest": "Do "+settings.getStationNameMarkup(data.timetable.stations[stops[stops.length-1].sid]),
        "noclasssubtextdest": true,
        "includered": false,
        "onlythreecols": true});

    row.cells[0].onclick = function(){
        runtime.setTrainSectionData(conns);
        app.changeCurrentSection(2);
    }

    row.deleteCell(2);
    row.cells[1].colSpan = 2;
    if (getoffbutton && (
        delay.status === constants.TRAIN_STATUS.STOPPED_BEFORE_TARGET
        || delay.status === constants.TRAIN_STATUS.STOPPED_AT_TARGET
        || delay.status === constants.TRAIN_STATUS.STOPPED_PAST_TARGET)){
        row.cells[1].innerHTML = "VYSTOUPIT";
        row.cells[1].style.backgroundColor = "#861313";
        row.cells[1].onclick = function(){
            runtime.getGameState().changeTransportType(0);
            runtime.getGameState().updateCurrentPosition({statID: delay.station});
            app.renderCurrentSection();
        };
    }

    if (runtime.getCurrentSection() == 2){
        row = app.addRow({
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
            runtime.setTrainSectionData({"lineID": lineID, "tripID": newtripid, "day": newday, "hidesinfront": hidesinfront});
            app.renderCurrentSection();
        };
        row.cells[1].onclick = function(){
            runtime.setTrainSectionData({"lineID": lineID, "tripID": tripID, "day": day, "hidesinfront": !hidesinfront});
            app.renderCurrentSection();
        }
        row.cells[2].style.backgroundColor = "green";
        row.cells[2].onclick = function(){
            let newtripid = tripID == line.trips-1 ? 0 : tripID+1;
            let newday = tripID == line.trips-1 ? day+1 : day;
            runtime.setTrainSectionData({"lineID": lineID, "tripID": newtripid, "day": newday, "hidesinfront": hidesinfront});
            app.renderCurrentSection();
        };
    }

    row = app.addRow({
        "table": table
    });
    row.className = "border";

    app.addRow({
        "table": table,
        "c1t": "Stanice",
        "c2t": "Příjezd",
        "c3t": "Odjezd",
        "c4t": "Vzdálenost",
        "includered": false});

    let starttime = line.starttime + day*constants.SECONDS_PER_DAY + tripID*line.interval;

    let distacc = 0;
    let i = 0;
    let visibleStopIndex = 0;
    let tocolor = true;
    let toprint = !hidesinfront;
    stops.forEach(stop => {
        const globalStopIndex = route.startIndex + i;
        if (hideUntilStopIndex === globalStopIndex){
            toprint = true;
        }
        if (i > 0) {
            distacc += stop.dist;
        }
        if (toprint){
            let arrstr = i == 0 ? "-" : app.formatTime(stop.arr+starttime);
            let depstr = i == stops.length - 1 ? " - " : app.formatTime(stop.dep+starttime);
            let stname = settings.getStationName(data.timetable.stations[stop.sid]);
            row = app.addRow({
                "table": table,
                "c1t": settings.getStationNameMarkup(data.timetable.stations[stop.sid]),
                "visibleoverflow": true
            });
            row.cells[0].onclick = function(){
                runtime.setStationSectionId(stop.sid);
                app.changeCurrentSection(1);
            }

            if (getoffbutton && runtime.getCurrentSection() === 0 && visibleStopIndex > 0) {
                const currentStationId = delay.station
                    ?? runtime.getGameState().getCurrentPosition().statID;
                const rebooking = getAutoExitRebooking(
                    lineID,
                    tripID,
                    stop.sid,
                    currentStationId
                );
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
                            const rebooked = runtime.getGameState().rebookAutoExit(
                                stop.sid,
                                rebooking.priceDifference
                            );
                            if (!rebooked) {
                                button.querySelector(".auto-exit-price").textContent
                                    = "NEDOSTATEK";
                                return;
                            }
                            app.renderCurrentSection(true);
                        };
                    }
                    actionCell.appendChild(button);
                }
            }

            row.cells[0].style.textWrap = "nowrap";
            row = app.addRow({
                "table": table,
                "c2t": arrstr,
                "c3t": depstr,
                "c4t": String(Math.round(distacc))+"km",
                "scrollingfirstcol": stname.length>=12,
                "includered": false});
            if (stop.sid == delay.station){
                if (delay.status === constants.TRAIN_STATUS.STOPPED_BEFORE_TARGET){
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

    export {
    toggle,
    print,
    addAutoTravelStatusRow,
    updateTrackProgress as updateTrackProgress
};
