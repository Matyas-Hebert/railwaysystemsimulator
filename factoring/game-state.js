class GameState {
    #currentPosition = null;
    #pinnedStations = [];
    #settings = { developer: false };
    #money = 0;
    #deliveryOrders = [];
    #pinnedDeliveryIds = [];
    #stationVisitState = {
        stationId: null,
        enteredAt: null,
        previousLineId: null,
        previousTripId: null,
        visitedStationIds: []
    };
    #stations;
    #stationIdByLonLat;

    constructor(stations, stationIdByLonLat) {
        this.#stations = stations;
        this.#stationIdByLonLat = stationIdByLonLat;
        this.#load();
    }

    getCurrentPosition() {
        return this.#currentPosition === null ? null : structuredClone(this.#currentPosition);
    }

    setCurrentPosition(position) {
        this.#currentPosition = position === null ? null : structuredClone(position);
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
        localStorage.setItem("_pinnedstations", JSON.stringify(this.#pinnedStations));
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
        localStorage.setItem("_objednavky", JSON.stringify(this.#deliveryOrders));
    }

    getPinnedDeliveryIds() {
        return [...this.#pinnedDeliveryIds];
    }

    setPinnedDeliveryIds(orderIds) {
        this.#pinnedDeliveryIds = [...orderIds];
        localStorage.setItem("_pinnedorders", JSON.stringify(this.#pinnedDeliveryIds));
    }

    getStationVisitState() {
        return structuredClone(this.#stationVisitState);
    }

    setStationVisitState(visitState) {
        this.#stationVisitState = structuredClone(visitState);
        localStorage.setItem("_stationvisitstate", JSON.stringify(this.#stationVisitState));
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
        stored.statID = this.#stations[stored.statID].lonlat;
        stored.goalStatID = this.#stations[stored.goalStatID].lonlat;
        localStorage.setItem("_currentposition", JSON.stringify(stored));
    }

    #load() {
        const pinned = localStorage.getItem("_pinnedstations");
        this.#pinnedStations = pinned === null ? [] : JSON.parse(pinned);
        this.#settings = this.#readSettings();
        this.#money = this.#readMoney();
        this.#deliveryOrders = this.#readArray("_objednavky");
        this.#pinnedDeliveryIds = this.#readArray("_pinnedorders");
        this.#stationVisitState = this.#readStationVisitState();

        const saved = localStorage.getItem("_currentposition");
        if (saved === null) return;
        const position = JSON.parse(saved);
        position.iswifi = false;
        if (!("statID" in position)) return;
        if (!("transporttype" in position)) position.transporttype = TRANSPORT_TYPE.STATION;
        if (!(parseInt(position.statID) <= 10000)) {
            position.statID = this.#stationIdByLonLat[position.statID];
            if (position.statID == null) return;
        }
        if (!("goalStatID" in position)) {
            if (position.transporttype === TRANSPORT_TYPE.WALKING) position.transporttype = TRANSPORT_TYPE.STATION;
            position.goalStatID = position.statID;
        } else if (!(parseInt(position.goalStatID) <= 10000)) {
            position.goalStatID = this.#stationIdByLonLat[position.goalStatID];
        }
        if (position.goalStatID == null) {
            position.goalStatID = position.statID;
            position.transporttype = TRANSPORT_TYPE.STATION;
        }
        this.#currentPosition = position;
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

    #readStationVisitState() {
        try {
            const stored = JSON.parse(localStorage.getItem("_stationvisitstate"));
            if (stored && typeof stored === "object") {
                return {
                    stationId: stored.stationId ?? null,
                    enteredAt: stored.enteredAt ?? null,
                    previousLineId: stored.previousLineId ?? null,
                    previousTripId: stored.previousTripId ?? null,
                    visitedStationIds: Array.isArray(stored.visitedStationIds)
                        ? stored.visitedStationIds.map(Number)
                        : []
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
            visitedStationIds: this.#readArray("_visitedstations").map(Number)
        };
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
