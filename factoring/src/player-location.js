import * as delays from "./delays.js";
import * as tripRoutes from "./trip-routes.js";
import * as walking from "./walking.js";
import * as app from "./timetable-analysis.js";
import * as runtime from "./runtime.js";
import * as data from "../generated/timetable.js";
import * as districtData from "../generated/district-borders.js";
import * as constants from "./constants.js";
import * as config from "../generated/config.js";

    const POLYGON_EPSILON = 1e-10;

    function getStationCoords(stationId) {
        const station = data.timetable.stations[stationId];
        if (!station) return null;
        return { lat: station.lat, lon: station.lon };
    }

    function getCurrentSpeedOfTrain(lineID, tripID, day) {
        let gs = runtime.getGameState();
        const line = gs.getLine(lineID);
        const typeConfig = config.lineTypes[line.type];
        const maxSpeed = typeConfig.maxSpeedKmh;
        const acceleration = typeConfig.accelerationKmhPerHourSquared;

        const route = tripRoutes.getTripRoute(lineID, tripID);
        if (route === null) {
            return 0;
        }
        const relativeDay = day >= 100
        ? day - app.getCurrentDayNumber()
        : day;
        let delay = delays.get(
            lineID,
            tripID,
            app.getCurrentTimeInSeconds(),
            route.destinationStationId,
            relativeDay,
            route.endIndex
        );

        if (delay == null){
            return 0;
        }

        if (delay.status == constants.TRAIN_STATUS.CANCELLED_AFTER_TARGET ||
            delay.status == constants.TRAIN_STATUS.CANCELLED_BEFORE_TARGET ||
            delay.status == constants.TRAIN_STATUS.FINISHED ||
            delay.status == constants.TRAIN_STATUS.NOT_DEPARTED ||
            delay.status == constants.TRAIN_STATUS.STOPPED_AT_TARGET ||
            delay.status == constants.TRAIN_STATUS.STOPPED_BEFORE_TARGET ||
            delay.status == constants.TRAIN_STATUS.STOPPED_PAST_TARGET){
                return 0;
            }
        else{
            const sectionLength = line.stops[delay.stopIndex].dist;
            const sectionDuration =
                line.stops[delay.stopIndex].arr
                - line.stops[delay.stopIndex - 1].dep;
            const delayedSectionDuration = delay.arrtime - delay.deptime;

            if (
                !(sectionLength > 0)
                || !(sectionDuration > 0)
                || !(delayedSectionDuration > 0)
            ){
                return 0;
            }

            const plannedElapsedSeconds =
                delay.progress * sectionDuration;
            const overheadSeconds =
                typeConfig.travelTimeOverheadSeconds ?? 0;
            const movementElapsedHours =
                (plannedElapsedSeconds - overheadSeconds / 2) / 3600;

            const criticalDistance = maxSpeed ** 2 / acceleration;
            const peakSpeed = sectionLength <= criticalDistance
                ? Math.sqrt(sectionLength * acceleration)
                : maxSpeed;
            const accelerationTimeHours = peakSpeed / acceleration;
            const movementDurationHours = sectionLength <= criticalDistance
                ? 2 * accelerationTimeHours
                : sectionLength / maxSpeed + maxSpeed / acceleration;

            if (
                movementElapsedHours <= 0
                || movementElapsedHours >= movementDurationHours
            ){
                return 0;
            }

            let speedWithoutDelay = peakSpeed;
            if (movementElapsedHours < accelerationTimeHours){
                speedWithoutDelay =
                    acceleration * movementElapsedHours;
            }
            else if (
                movementElapsedHours
                > movementDurationHours - accelerationTimeHours
            ){
                speedWithoutDelay = acceleration
                    * (movementDurationHours - movementElapsedHours);
            }

            const delayTimeMultiplier =
                delayedSectionDuration / sectionDuration;
            return Math.max(
                0,
                speedWithoutDelay / delayTimeMultiplier
            );
        }
    }

    function getCurrentSpeed() {
        let gs = runtime.getGameState(0);
        let position = gs.getCurrentPosition();
        if (position.transporttype == constants.TRANSPORT_TYPE.WALKING ||
            position.transporttype == constants.TRANSPORT_TYPE.RUNNING ||
            position.transporttype == constants.TRANSPORT_TYPE.SPRINTING
        ){
            console.log("speed is: ", walking.getSpeedFromTransportType(position.transporttype))
            return walking.getSpeedFromTransportType(position.transporttype);
        }

        if (position.transporttype == constants.TRANSPORT_TYPE.STATION ||
            position.transporttype == constants.TRANSPORT_TYPE.FIELD
        ){
            console.log("speed is 0");
            return 0;
        }

        if (position.transporttype == constants.TRANSPORT_TYPE.TRAIN){
            return getCurrentSpeedOfTrain(position.lineID, position.tripID, position.day);
        }
    }

    function interpolateCoords(start, end, progress) {
        const normalizedProgress = Math.min(1, Math.max(0, progress));
        return {
            lat: start.lat + (end.lat - start.lat) * normalizedProgress,
            lon: start.lon + (end.lon - start.lon) * normalizedProgress
        };
    }

    export function getWalkingCoords(position) {
        if (!position.coords || !position.goalCoords) return position.coords ?? null;

        const distance = walking.getDistance(position.coords, position.goalCoords);
        let speedkmh = walking.getSpeedFromTransportType(position.transporttype);
        const duration = (distance/speedkmh) * 3600 * 1000;
        if (duration <= 0) return { ...position.goalCoords };

        const progress = (
            app.getCurrentTimeInMilliseconds() - position.time
        ) / duration;
        return interpolateCoords(position.coords, position.goalCoords, progress);
    }

    function getTrainCoords(position) {
        const line = data.timetable.lines[position.lineID];
        const route = tripRoutes.getTripRoute(position.lineID, position.tripID);
        if (!line || route === null) return getStationCoords(position.statID);

        const relativeDay = position.day >= 100
            ? position.day - app.getCurrentDayNumber()
            : position.day;
        const trainState = delays.get(
            position.lineID,
            position.tripID,
            app.getCurrentTimeInSeconds(),
            route.destinationStationId,
            relativeDay,
            route.endIndex
        );
        if (trainState === null) return getStationCoords(position.statID);

        if (trainState.status === constants.TRAIN_STATUS.FINISHED) {
            return getStationCoords(route.destinationStationId);
        }

        const stop = line.stops[trainState.stopIndex];
        if (!stop) return getStationCoords(trainState.station ?? position.statID);

        const isMoving = trainState.status === constants.TRAIN_STATUS.TRAVELLING_TO_TARGET
            || trainState.status === constants.TRAIN_STATUS.TRAVELLING_PAST_TARGET;
        if (!isMoving) return getStationCoords(stop.sid);

        const previousStop = line.stops[trainState.stopIndex - 1];
        if (!previousStop) return getStationCoords(stop.sid);
        return interpolateCoords(
            getStationCoords(previousStop.sid),
            getStationCoords(stop.sid),
            trainState.progress
        );
    }

    function getCurrentPlayerCoords() {
        const position = runtime.getGameState().getCurrentPosition();
        if (position === null) return null;

        if (position.transporttype === constants.TRANSPORT_TYPE.STATION) {
            return getStationCoords(position.statID);
        }
        if (position.transporttype === constants.TRANSPORT_TYPE.FIELD) {
            return position.coords === null ? null : { ...position.coords };
        }
        if (position.transporttype === constants.TRANSPORT_TYPE.WALKING ||
            position.transporttype === constants.TRANSPORT_TYPE.RUNNING ||
            position.transporttype === constants.TRANSPORT_TYPE.SPRINTING
        ) {
            return getWalkingCoords(position);
        }
        if (position.transporttype === constants.TRANSPORT_TYPE.TRAIN) {
            return getTrainCoords(position);
        }
        return null;
    }

    function pointIsInsidePolygon(coords, vertices) {
        let inside = false;
        for (
            let current = 0, previous = vertices.length - 1;
            current < vertices.length;
            previous = current++
        ) {
            const currentVertex = vertices[current];
            const previousVertex = vertices[previous];
            const cross = (coords.lon - currentVertex[0])
                * (previousVertex[1] - currentVertex[1])
                - (coords.lat - currentVertex[1])
                * (previousVertex[0] - currentVertex[0]);
            const onBorder = Math.abs(cross) <= POLYGON_EPSILON
                && coords.lon >= Math.min(currentVertex[0], previousVertex[0]) - POLYGON_EPSILON
                && coords.lon <= Math.max(currentVertex[0], previousVertex[0]) + POLYGON_EPSILON
                && coords.lat >= Math.min(currentVertex[1], previousVertex[1]) - POLYGON_EPSILON
                && coords.lat <= Math.max(currentVertex[1], previousVertex[1]) + POLYGON_EPSILON;
            if (onBorder) return true;

            const crossesRay = (currentVertex[1] > coords.lat)
                !== (previousVertex[1] > coords.lat)
                && coords.lon < (
                    (previousVertex[0] - currentVertex[0])
                    * (coords.lat - currentVertex[1])
                    / (previousVertex[1] - currentVertex[1])
                    + currentVertex[0]
                );
            if (crossesRay) inside = !inside;
        }
        return inside;
    }

    function getDistrictAtCoords(coords) {
        if (!Number.isFinite(coords?.lat) || !Number.isFinite(coords?.lon)) {
            return null;
        }

        const district = districtData.districtBorders.find(candidate =>
            pointIsInsidePolygon(coords, candidate.borderVertices)
        );
        if (district) return district.name;

        const closestDistrict = districtData.districtBorders.reduce((closest, candidate) => {
            const latitudeDifference = coords.lat - candidate.capital.lat;
            const longitudeDifference = coords.lon - candidate.capital.lon;
            const distanceSquared = latitudeDifference ** 2 + longitudeDifference ** 2;
            return closest === null || distanceSquared < closest.distanceSquared
                ? { name: candidate.name, distanceSquared }
                : closest;
        }, null);
        return closestDistrict?.name ?? null;
    }

    export {
        interpolateCoords,
    getCurrentPlayerCoords,
    getDistrictAtCoords,
    getCurrentSpeed,
    getCurrentSpeedOfTrain
};
