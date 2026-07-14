class GameState {
    #currentPosition = null;
    #pinnedStations = [];
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

        const saved = localStorage.getItem("_currentposition");
        if (saved === null) return;
        const position = JSON.parse(saved);
        position.iswifi = false;
        if (!("statID" in position)) return;
        if (!("transporttype" in position)) position.transporttype = 0;
        if (!(parseInt(position.statID) <= 10000)) {
            position.statID = this.#stationIdByLonLat[position.statID];
            if (position.statID == null) return;
        }
        if (!("goalStatID" in position)) {
            if (position.transporttype === 2) position.transporttype = 0;
            position.goalStatID = position.statID;
        } else if (!(parseInt(position.goalStatID) <= 10000)) {
            position.goalStatID = this.#stationIdByLonLat[position.goalStatID];
        }
        if (position.goalStatID == null) {
            position.goalStatID = position.statID;
            position.transporttype = 0;
        }
        this.#currentPosition = position;
    }
}
