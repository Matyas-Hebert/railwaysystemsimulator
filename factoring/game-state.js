class GameState {
    #currentPosition = null;
    #pinnedStations = [];
    #settings = { developer: false };
    #money = 0;
    #deliveryOrders = [];
    #pinnedDeliveryIds = [];
    #visitedLines = [];
    #visitedLineIds = new Set();
    #visitedStationIds = new Set();
    #collectionProgress = {
        stationsByDistrict: {},
        linesByCompany: {},
        linesByCompanyAndType: {}
    };
    #collectedDelayReasons = [];
    #autoBoardSelection = null;
    #autoExitStationId = null;
    #isLoading = false;
    #stationVisitState = {
        stationId: null,
        enteredAt: null,
        previousLineId: null,
        previousTripId: null,
        visitedStationIds: []
    };
    #stations;
    #lines;
    #stationIdByLonLat;
    #timeTravelled = 0;
    #timeDilatation = 1;

    constructor(stations, stationIdByLonLat, lines = []) {
        this.#stations = stations;
        this.#lines = lines;
        this.#stationIdByLonLat = stationIdByLonLat;
        this.#isLoading = true;
        this.#load();
        this.#isLoading = false;
    }

    getCurrentPosition() {
        return this.#currentPosition === null ? null : structuredClone(this.#currentPosition);
    }

    setCurrentPosition(position) {
        const nextPosition = position === null ? null : structuredClone(position);
        if (!this.#isLoading
            && this.#hasPlayerPositionChanged(this.#currentPosition, nextPosition)) {
            this.setAutoBoardSelection(null);
            const isBoardingTrain = nextPosition?.transporttype === TRANSPORT_TYPE.TRAIN
                && this.#currentPosition?.transporttype !== TRANSPORT_TYPE.TRAIN;
            if (!isBoardingTrain) {
                this.setAutoExitStationId(null);
            }
        }
        this.#currentPosition = nextPosition;
        this.#saveCurrentPosition();
    }

    updateCurrentPosition(changes) {
        if (this.#currentPosition === null) throw new Error("Game has not started.");
        this.setCurrentPosition({ ...this.#currentPosition, ...structuredClone(changes) });
    }

    getPinnedStations() {
        return [...this.#pinnedStations];
    }

    setPinnedStations(stationIds) {
        this.#pinnedStations = [...stationIds];
        const storedStations = this.#pinnedStations
            .map(stationId => this.#toLonLatId(stationId))
            .filter(lonLatId => lonLatId != null);
        localStorage.setItem("_pinnedstations", JSON.stringify(storedStations));
    }

    addPinnedStation(stationId) {
        if (!this.#pinnedStations.includes(stationId)) {
            this.setPinnedStations([...this.#pinnedStations, stationId]);
        }
    }

    removePinnedStation(stationId) {
        this.setPinnedStations(this.#pinnedStations.filter(id => id !== stationId));
    }

    getSettings() {
        return structuredClone(this.#settings);
    }

    setSettings(settings) {
        this.#settings = structuredClone(settings);
        localStorage.setItem("_settings", JSON.stringify(this.#settings));
    }

    updateSettings(changes) {
        this.setSettings({ ...this.#settings, ...structuredClone(changes) });
    }

    getMoney() {
        return this.#money;
    }

    setMoney(money) {
        if (!Number.isFinite(money)) {
            throw new TypeError("Money must be a finite number.");
        }
        this.#money = money;
        localStorage.setItem("_money", String(this.#money));
    }

    getDeliveryOrders() {
        return structuredClone(this.#deliveryOrders);
    }

    setDeliveryOrders(orders) {
        this.#deliveryOrders = structuredClone(orders);
        const storedOrders = this.#deliveryOrders.map(order => {
            const storedOrder = structuredClone(order);
            storedOrder.startStationLonLatId = this.#getOrderStationLonLatId(order.start);
            storedOrder.endStationLonLatId = this.#getOrderStationLonLatId(order.end);
            delete storedOrder.start;
            delete storedOrder.end;
            return storedOrder;
        });
        localStorage.setItem("_objednavky", JSON.stringify(storedOrders));
    }

    getPinnedDeliveryIds() {
        return [...this.#pinnedDeliveryIds];
    }

    setPinnedDeliveryIds(orderIds) {
        this.#pinnedDeliveryIds = [...orderIds];
        localStorage.setItem("_pinnedorders", JSON.stringify(this.#pinnedDeliveryIds));
    }

    getAutoExitStationId() {
        return this.#autoExitStationId;
    }

    getTimeTravelled() {
        return this.#timeTravelled;
    }

    getTimeDilatation() {
        return this.#timeDilatation;
    }

    setTimeState(timeTravelled, timeDilatation) {
        if (!Number.isFinite(timeTravelled)) {
            throw new TypeError("Time travelled must be a finite number.");
        }
        if (!Number.isFinite(timeDilatation) || timeDilatation <= 0) {
            throw new TypeError("Time dilatation must be a positive finite number.");
        }
        this.#timeTravelled = timeTravelled;
        this.#timeDilatation = timeDilatation;
        localStorage.setItem("_timetraveldelta", String(timeTravelled));
        localStorage.setItem("_timedilatation", String(timeDilatation));
    }

    setTimeTravelled(timeTravelled) {
        this.setTimeState(timeTravelled, this.#timeDilatation);
    }

    setTimeDilatation(timeDilatation) {
        this.setTimeState(this.#timeTravelled, timeDilatation);
    }

    timeTravel(timeTravelledSeconds) {
        if (!Number.isFinite(timeTravelledSeconds)) {
            throw new TypeError("Time travel change must be a finite number.");
        }
        this.setTimeTravelled(this.#timeTravelled + timeTravelledSeconds);
    }

    timeDilatate(timeDilatationMultiplier) {
        if (!Number.isFinite(timeDilatationMultiplier) || timeDilatationMultiplier <= 0) {
            throw new TypeError("Time dilatation multiplier must be positive and finite.");
        }
        this.setTimeDilatation(this.#timeDilatation * timeDilatationMultiplier);
    }

    setAutoExitStationId(stationId) {
        if (stationId === null) {
            this.#autoExitStationId = null;
            localStorage.removeItem("_autoexitstation");
            return;
        }

        const normalizedStationId = this.#toStationId(stationId);
        if (normalizedStationId === null) {
            throw new TypeError("Automatic exit must reference a valid station.");
        }
        this.#autoExitStationId = normalizedStationId;
        localStorage.setItem(
            "_autoexitstation",
            JSON.stringify(this.#toLonLatId(normalizedStationId))
        );
    }
    getAutoBoardSelection() {
        return this.#autoBoardSelection === null
            ? null
            : structuredClone(this.#autoBoardSelection);
    }

    setAutoBoardSelection(selection) {
        if (selection === null) {
            this.#autoBoardSelection = null;
            localStorage.removeItem("_autoboardselection");
            return;
        }

        const normalized = {
            lineID: Number(selection.lineID),
            tripID: Number(selection.tripID),
            day: Number(selection.day)
        };
        if (!Number.isInteger(normalized.lineID)
            || !Number.isInteger(normalized.tripID)
            || !Number.isInteger(normalized.day)) {
            throw new TypeError("Automatic boarding selection must contain integer lineID, tripID and day values.");
        }
        this.#autoBoardSelection = normalized;
        localStorage.setItem("_autoboardselection", JSON.stringify(normalized));
    }
    getCollectedDelayReasons() {
        return [...this.#collectedDelayReasons];
    }

    setCollectedDelayReasons(delayReasons) {
        this.#collectedDelayReasons = [...new Set(delayReasons
            .filter(reason => typeof reason === "string" && reason.length > 0))];
        localStorage.setItem("_collecteddelayreasons", JSON.stringify(this.#collectedDelayReasons));
    }

    addCollectedDelayReason(delayReason) {
        if (typeof delayReason !== "string"
            || delayReason.length === 0
            || this.#collectedDelayReasons.includes(delayReason)) {
            return false;
        }
        this.setCollectedDelayReasons([...this.#collectedDelayReasons, delayReason]);
        return true;
    }
    getVisitedLines() {
        return [...this.#visitedLines];
    }

    hasVisitedLine(lineId) {
        return this.#visitedLineIds.has(Number(lineId));
    }

    getCollectionProgress() {
        return structuredClone(this.#collectionProgress);
    }

    getVisitedStationCountForDistrict(district) {
        return this.#collectionProgress.stationsByDistrict[district] ?? 0;
    }

    getVisitedLineCountForCompany(company) {
        return this.#collectionProgress.linesByCompany[company] ?? 0;
    }

    getVisitedLineCountForCompanyAndType(company, type) {
        return this.#collectionProgress.linesByCompanyAndType[company]?.[type] ?? 0;
    }

    setVisitedLines(lineIds) {
        this.#visitedLines = [...new Set(lineIds
            .map(Number)
            .filter(Number.isInteger))];
        this.#visitedLineIds = new Set(this.#visitedLines);
        this.#rebuildLineCollectionProgress();
        localStorage.setItem("_visitedlines", JSON.stringify(this.#visitedLines));
        this.#saveCollectionProgress();
    }

    addVisitedLine(lineId) {
        lineId = Number(lineId);
        if (Number.isInteger(lineId) && !this.#visitedLineIds.has(lineId)) {
            this.setVisitedLines([...this.#visitedLines, lineId]);
            return true;
        }
        return false;
    }

    hasVisitedStation(stationId) {
        return this.#visitedStationIds.has(Number(stationId));
    }
    getStationVisitState() {
        return structuredClone(this.#stationVisitState);
    }

    setStationVisitState(visitState) {
        const stationReference = visitState.stationId ?? visitState.stationLonLatId;
        const visitedStationReferences = visitState.visitedStationIds
            ?? visitState.visitedStationLonLatIds;
        const visitedStationIds = this.#normalizeVisitedStationIds(visitedStationReferences);
        const visitsChanged = visitedStationIds.length !== this.#stationVisitState.visitedStationIds.length
            || visitedStationIds.some(stationId => !this.#visitedStationIds.has(stationId));
        this.#stationVisitState = {
            stationId: this.#toStationId(stationReference),
            enteredAt: Number.isFinite(visitState.enteredAt) ? visitState.enteredAt : null,
            previousLineId: visitState.previousLineId ?? null,
            previousTripId: visitState.previousTripId ?? null,
            visitedStationIds
        };
        if (visitsChanged) {
            this.#visitedStationIds = new Set(visitedStationIds);
            this.#rebuildStationCollectionProgress();
            this.#saveCollectionProgress();
        }
        const storedState = {
            stationLonLatId: this.#toLonLatId(this.#stationVisitState.stationId),
            enteredAt: this.#stationVisitState.enteredAt,
            previousLineId: this.#stationVisitState.previousLineId,
            previousTripId: this.#stationVisitState.previousTripId,
            visitedStationLonLatIds: this.#stationVisitState.visitedStationIds
                .map(stationId => this.#toLonLatId(stationId))
                .filter(lonLatId => lonLatId != null)
        };
        localStorage.setItem("_stationvisitstate", JSON.stringify(storedState));
    }

    updateStationVisitState(changes) {
        this.setStationVisitState({
            ...this.#stationVisitState,
            ...structuredClone(changes)
        });
    }

    #saveCurrentPosition() {
        if (this.#currentPosition === null) {
            localStorage.removeItem("_currentposition");
            return;
        }
        const stored = structuredClone(this.#currentPosition);
        stored.stationLonLatId = this.#toLonLatId(stored.statID);
        stored.goalStationLonLatId = this.#toLonLatId(stored.goalStatID);
        delete stored.statID;
        delete stored.goalStatID;
        localStorage.setItem("_currentposition", JSON.stringify(stored));
    }

    #load() {
        this.setPinnedStations(
            this.#readArray("_pinnedstations")
                .map(value => this.#toStationId(value))
                .filter(stationId => stationId != null)
        );
        this.#settings = this.#readSettings();
        this.#money = this.#readMoney();
        this.#timeTravelled = this.#readTimeTravel();
        this.#timeDilatation = this.#readTimeDilatation();
        this.setDeliveryOrders(
            this.#readArray("_objednavky")
                .map(order => this.#deserializeDeliveryOrder(order))
                .filter(order => order != null)
        );
        this.#pinnedDeliveryIds = this.#readArray("_pinnedorders");
        this.setVisitedLines(this.#readArray("_visitedlines"));
        this.setCollectedDelayReasons(this.#readArray("_collecteddelayreasons"));
        this.setAutoExitStationId(this.#readAutoExitStationId());
        this.setStationVisitState(this.#readStationVisitState());

        const saved = localStorage.getItem("_currentposition");
        if (saved === null) {
            this.setAutoBoardSelection(null);
            this.setAutoExitStationId(null);
            return;
        }
        const position = JSON.parse(saved);
        position.iswifi = false;
        if (!("transporttype" in position)) position.transporttype = TRANSPORT_TYPE.STATION;

        position.statID = this.#toStationId(position.stationLonLatId ?? position.statID);
        if (position.statID == null) {
            this.setAutoBoardSelection(null);
            this.setAutoExitStationId(null);
            return;
        }

        const storedGoal = position.goalStationLonLatId ?? position.goalStatID;
        position.goalStatID = storedGoal == null
            ? position.statID
            : this.#toStationId(storedGoal);

        if (position.goalStatID == null) {
            position.goalStatID = position.statID;
            position.transporttype = TRANSPORT_TYPE.STATION;
        }

        delete position.stationLonLatId;
        delete position.goalStationLonLatId;
        this.setCurrentPosition(position);
        this.setAutoBoardSelection(this.#readAutoBoardSelection());
    }

    #hasPlayerPositionChanged(previousPosition, nextPosition) {
        if (previousPosition === null || nextPosition === null) {
            return previousPosition !== nextPosition;
        }

        const positionFields = [
            "transporttype",
            "statID",
            "goalStatID",
            "lineID",
            "tripID",
            "day",
            "time"
        ];
        return positionFields.some(field => previousPosition[field] !== nextPosition[field]);
    }

    #readSettings() {
        try {
            const stored = localStorage.getItem("_settings");
            return stored === null ? { developer: false } : JSON.parse(stored);
        }
        catch {
            return { developer: false };
        }
    }

    #readTimeTravel() {
        const stored = Number.parseFloat(localStorage.getItem("_timetraveldelta"));
        return Number.isFinite(stored) ? stored : 0;
    }

    #readTimeDilatation() {
        const storedValue = localStorage.getItem("_timedilatation")
            ?? localStorage.getItem("_timeDilatation");
        const stored = Number.parseFloat(storedValue);
        return Number.isFinite(stored) && stored > 0 ? stored : 1;
    }

    #toLonLatId(stationReference) {
        if (stationReference == null) return null;
        const key = String(stationReference);
        if (this.#stationIdByLonLat[key] != null) return key;

        const stationId = Number(stationReference);
        return Number.isInteger(stationId)
            ? this.#stations[stationId]?.lonlat ?? null
            : null;
    }

    #toStationId(stationReference) {
        if (stationReference == null) return null;
        const key = String(stationReference);
        if (this.#stationIdByLonLat[key] != null) {
            return Number(this.#stationIdByLonLat[key]);
        }

        const stationId = Number(stationReference);
        return Number.isInteger(stationId) && this.#stations[stationId]
            ? stationId
            : null;
    }

    #getOrderStationLonLatId(station) {
        if (station == null) return null;
        return this.#toLonLatId(station.lonlat ?? station.id ?? station);
    }

    #deserializeDeliveryOrder(order) {
        const startReference = order.startStationLonLatId
            ?? order.start?.lonlat
            ?? order.start?.id
            ?? order.start;
        const endReference = order.endStationLonLatId
            ?? order.end?.lonlat
            ?? order.end?.id
            ?? order.end;
        const startId = this.#toStationId(startReference);
        const endId = this.#toStationId(endReference);
        if (startId == null || endId == null) return null;

        const runtimeOrder = structuredClone(order);
        runtimeOrder.start = this.#stations[startId];
        runtimeOrder.end = this.#stations[endId];
        delete runtimeOrder.startStationLonLatId;
        delete runtimeOrder.endStationLonLatId;
        return runtimeOrder;
    }

    #readAutoExitStationId() {
        try {
            const stored = localStorage.getItem("_autoexitstation");
            if (stored === null) return null;
            return this.#toStationId(JSON.parse(stored));
        }
        catch {
            return null;
        }
    }
    #readAutoBoardSelection() {
        try {
            const selection = JSON.parse(localStorage.getItem("_autoboardselection"));
            if (selection && typeof selection === "object") {
                const normalized = {
                    lineID: Number(selection.lineID),
                    tripID: Number(selection.tripID),
                    day: Number(selection.day)
                };
                if (Number.isInteger(normalized.lineID)
                    && Number.isInteger(normalized.tripID)
                    && Number.isInteger(normalized.day)) {
                    return normalized;
                }
            }
        }
        catch {
            // Ignore invalid saved selections.
        }
        return null;
    }
    #readStationVisitState() {
        try {
            const stored = JSON.parse(localStorage.getItem("_stationvisitstate"));
            if (stored && typeof stored === "object") {
                const savedVisits = Array.isArray(stored.visitedStationLonLatIds)
                    ? stored.visitedStationLonLatIds
                    : stored.visitedStationIds;
                const stationReference = stored.stationLonLatId ?? stored.stationId;
                return {
                    stationId: this.#toStationId(stationReference),
                    enteredAt: stored.enteredAt ?? null,
                    previousLineId: stored.previousLineId ?? null,
                    previousTripId: stored.previousTripId ?? null,
                    visitedStationIds: this.#normalizeVisitedStationIds(savedVisits)
                };
            }
        }
        catch {
            // Fall back to the earlier visited-stations storage format.
        }

        return {
            stationId: null,
            enteredAt: null,
            previousLineId: null,
            previousTripId: null,
            visitedStationIds: this.#normalizeVisitedStationIds(
                this.#readArray("_visitedstations")
            )
        };
    }

    #normalizeVisitedStationIds(values) {
        if (!Array.isArray(values)) return [];

        const normalized = values
            .map(value => this.#toStationId(value))
            .filter(stationId => stationId != null);

        return [...new Set(normalized)];
    }

    #rebuildStationCollectionProgress() {
        const stationsByDistrict = {};
        this.#visitedStationIds.forEach(stationId => {
            const district = this.#stations[stationId]?.district;
            if (!district) return;
            stationsByDistrict[district] = (stationsByDistrict[district] ?? 0) + 1;
        });
        this.#collectionProgress.stationsByDistrict = stationsByDistrict;
    }

    #rebuildLineCollectionProgress() {
        const linesByCompany = {};
        const linesByCompanyAndType = {};
        this.#visitedLineIds.forEach(lineId => {
            const line = this.#lines[lineId];
            if (!line?.company) return;
            linesByCompany[line.company] = (linesByCompany[line.company] ?? 0) + 1;
            if (!linesByCompanyAndType[line.company]) {
                linesByCompanyAndType[line.company] = {};
            }
            linesByCompanyAndType[line.company][line.type]
                = (linesByCompanyAndType[line.company][line.type] ?? 0) + 1;
        });
        this.#collectionProgress.linesByCompany = linesByCompany;
        this.#collectionProgress.linesByCompanyAndType = linesByCompanyAndType;
    }

    #saveCollectionProgress() {
        localStorage.setItem("_collectionprogress", JSON.stringify(this.#collectionProgress));
    }

    #readArray(storageKey) {
        try {
            const stored = JSON.parse(localStorage.getItem(storageKey));
            return Array.isArray(stored) ? stored : [];
        }
        catch {
            return [];
        }
    }

    #readMoney() {
        const stored = parseInt(localStorage.getItem("_money"), 10);
        return Number.isNaN(stored) ? 0 : stored;
    }
}
