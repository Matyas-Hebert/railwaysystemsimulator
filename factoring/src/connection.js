import * as delays from "./delays.js";
import * as playerLocation from "./player-location.js";
import * as walking from "./walking.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as config from "../generated/config.js";
import * as constants from "./constants.js";

    const MAX_DISPLAYED_USES = 5;

    function getNativeWifiAvailability(position) {
        if (position === null) return false;

        if (position.transporttype === constants.TRANSPORT_TYPE.STATION) {
            return delays.hasStationWifi(position.statID, position.day);
        }
        if (position.transporttype === constants.TRANSPORT_TYPE.TRAIN) {
            const line = data.timetable.lines[position.lineID];
            return line !== undefined && delays.hasTrainWifi(
                position.lineID,
                position.tripID,
                position.day,
                line.type
            );
        }
        if (position.transporttype === constants.TRANSPORT_TYPE.WALKING) {
            const start = position.time;
            const distance = walking.getDistance(
                position.coords,
                position.goalCoords
            );
            const end = start + distance * 8 * 60 * 1000;
            const current = app.getCurrentTimeInMilliseconds();

            if (position.statID !== null
                && Math.abs(current - start) < 60000) {
                return delays.hasStationWifi(position.statID, position.day);
            }
            if (position.goalStatID !== null
                && Math.abs(current - end) < 60000) {
                return delays.hasStationWifi(position.goalStatID, position.day);
            }
        }
        return false;
    }

    function getOperator(operatorNumber) {
        if (!Number.isInteger(operatorNumber)
            || operatorNumber < 1
            || operatorNumber > config.dataOperators.length) {
            return null;
        }
        return config.dataOperators[operatorNumber - 1];
    }

    function hasOperatorCoverage(operatorNumber) {
        const operator = getOperator(operatorNumber);
        if (operator === null) return false;

        const coords = playerLocation.getCurrentPlayerCoords();
        const district = playerLocation.getDistrictAtCoords(coords);
        return district !== null && operator.districts.includes(district);
    }

    function renderIcon(status) {
        const icon = document.querySelector("#_wifi");
        if (icon === null) return;

        if (status.selectedOperator === 0) {
            icon.className = status.hasConnection ? "wifi" : "nowifi";
            icon.setAttribute(
                "aria-label",
                status.hasConnection
                    ? "Wi-Fi připojení je dostupné"
                    : "Wi-Fi připojení není dostupné"
            );
            return;
        }

        const displayedUses = Math.min(
            MAX_DISPLAYED_USES,
            status.usesRemaining
        );
        icon.className = "data-signal data-uses-" + String(displayedUses);
        if (!status.hasCoverage && status.usesRemaining > 0) {
            icon.classList.add("data-warning");
        }

        const operator = getOperator(status.selectedOperator);
        const coverageText = status.hasCoverage
            ? "pokrytí je dostupné"
            : "bez pokrytí";
        icon.setAttribute(
            "aria-label",
            operator.name + ": " + String(status.usesRemaining)
                + " použití, " + coverageText
        );
    }

    function getStatus() {
        const position = runtime.getGameState().getCurrentPosition();
        const selectedOperator = runtime.getGameState().getSelectedOperator();
        const uses = runtime.getGameState().getUsesRemaining();
        const usesRemaining = selectedOperator === 0
            ? 0
            : uses[selectedOperator - 1];
        const hasCoverage = selectedOperator === 0
            ? getNativeWifiAvailability(position)
            : hasOperatorCoverage(selectedOperator);
        return {
            selectedOperator,
            usesRemaining,
            hasCoverage,
            hasConnection: selectedOperator === 0
                ? hasCoverage
                : hasCoverage && usesRemaining > 0
        };
    }

    function refresh() {
        const position = runtime.getGameState().getCurrentPosition();
        if (position === null) return false;

        const status = getStatus();
        if (position.hasConnection !== status.hasConnection) {
            runtime.getGameState().updateCurrentPosition({
                hasConnection: status.hasConnection
            });
        }
        renderIcon(status);
        renderOperatorSelection();
        return status.hasConnection;
    }

    function use(uses) {
        if (!Number.isInteger(uses) || uses < 0) {
            throw new TypeError("Connection uses must be a non-negative integer.");
        }

        const status = getStatus();
        if (!status.hasConnection) {
            refresh();
            return false;
        }
        if (status.selectedOperator === 0 || uses === 0) {
            refresh();
            return true;
        }
        if (status.usesRemaining < uses) {
            refresh();
            return false;
        }

        const usesRemaining = runtime.getGameState().getUsesRemaining();
        usesRemaining[status.selectedOperator - 1] -= uses;
        runtime.getGameState().setUsesRemaining(usesRemaining);
        return true;
    }

    function selectOperator(operatorNumber) {
        runtime.getGameState().setOpenedOperatorSelection(false);
        runtime.getGameState().setSelectedOperator(operatorNumber);
    }

    function renderOperatorSelection() {
        const selection = document.querySelector("#_operatorselection");
        if (selection === null) return;

        selection.hidden = !runtime.getGameState().getOpenedOperatorSelection();
        selection.replaceChildren();
        if (selection.hidden) return;

        const position = runtime.getGameState().getCurrentPosition();
        const usesRemaining = runtime.getGameState().getUsesRemaining();
        const operatorNames = [
            "Wi-Fi",
            ...config.dataOperators.map(operator => operator.name)
        ];
        operatorNames.forEach((operatorName, operatorNumber) => {
            const option = document.createElement("button");
            const statusIcon = document.createElement("span");
            const name = document.createElement("span");
            option.type = "button";
            option.className = operatorNumber === runtime.getGameState().getSelectedOperator()
                ? "operator-option selected"
                : "operator-option";
            if (operatorNumber === 0) {
                statusIcon.className = getNativeWifiAvailability(position)
                    ? "operator-status-icon wifi"
                    : "operator-status-icon nowifi";
            } else {
                const uses = usesRemaining[operatorNumber - 1];
                statusIcon.className = "operator-status-icon data-signal data-uses-"
                    + String(Math.min(MAX_DISPLAYED_USES, uses));
                if (!hasOperatorCoverage(operatorNumber) && uses > 0) {
                    statusIcon.classList.add("data-warning");
                }
            }
            name.textContent = operatorName;
            option.appendChild(statusIcon);
            option.appendChild(name);
            option.addEventListener("click", () => {
                selectOperator(operatorNumber);
            });
            selection.appendChild(option);
        });
    }

    function handleIconClick() {
        runtime.getGameState().setOpenedOperatorSelection(
            !runtime.getGameState().getOpenedOperatorSelection()
        );
        renderOperatorSelection();
    }

    export {
    getStatus,
    hasOperatorCoverage,
    refresh,
    use,
    selectOperator,
    handleIconClick
};
