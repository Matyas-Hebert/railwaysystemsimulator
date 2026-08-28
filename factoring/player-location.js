const playerLocation = (() => {
    const POLYGON_EPSILON = 1e-10;

    function getStationCoords(stationId) {
        const station = timetable.stations[stationId];
        if (!station) return null;
        return { lat: station.lat, lon: station.lon };
    }

    function interpolateCoords(start, end, progress) {
        const normalizedProgress = Math.min(1, Math.max(0, progress));
        return {
            lat: start.lat + (end.lat - start.lat) * normalizedProgress,
            lon: start.lon + (end.lon - start.lon) * normalizedProgress
        };
    }

    function getWalkingCoords(position) {
        if (!position.coords || !position.goalCoords) return position.coords ?? null;

        const distance = walking.getDistance(position.coords, position.goalCoords);
        const duration = distance * 8 * 60 * 1000;
        if (duration <= 0) return { ...position.goalCoords };

        const progress = (
            getCurrentTimeInMilliseconds() - position.time
        ) / duration;
        return interpolateCoords(position.coords, position.goalCoords, progress);
    }

    function getTrainCoords(position) {
        const line = timetable.lines[position.lineID];
        const route = tripRoutes.getTripRoute(position.lineID, position.tripID);
        if (!line || route === null) return getStationCoords(position.statID);

        const daysSinceEpoch = Math.floor(
            getCurrentTimeInMilliseconds() / MILLISECONDS_PER_DAY
        );
        const relativeDay = position.day >= 100
            ? position.day - daysSinceEpoch
            : position.day;
        const trainState = delays.get(
            position.lineID,
            position.tripID,
            getCurrentTimeInSeconds(),
            route.destinationStationId,
            relativeDay
        );
        if (trainState === null) return getStationCoords(position.statID);

        if (trainState.status === TRAIN_STATUS.FINISHED) {
            return getStationCoords(route.destinationStationId);
        }

        const stop = line.stops[trainState.stopIndex];
        if (!stop) return getStationCoords(trainState.station ?? position.statID);

        const isMoving = trainState.status === TRAIN_STATUS.TRAVELLING_TO_TARGET
            || trainState.status === TRAIN_STATUS.TRAVELLING_PAST_TARGET;
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
        const position = gameState.getCurrentPosition();
        if (position === null) return null;

        if (position.transporttype === TRANSPORT_TYPE.STATION) {
            return getStationCoords(position.statID);
        }
        if (position.transporttype === TRANSPORT_TYPE.FIELD) {
            return position.coords === null ? null : { ...position.coords };
        }
        if (position.transporttype === TRANSPORT_TYPE.WALKING) {
            return getWalkingCoords(position);
        }
        if (position.transporttype === TRANSPORT_TYPE.TRAIN) {
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

        const district = districtBorders.find(candidate =>
            pointIsInsidePolygon(coords, candidate.borderVertices)
        );
        if (district) return district.name;

        const closestDistrict = districtBorders.reduce((closest, candidate) => {
            const latitudeDifference = coords.lat - candidate.capital.lat;
            const longitudeDifference = coords.lon - candidate.capital.lon;
            const distanceSquared = latitudeDifference ** 2 + longitudeDifference ** 2;
            return closest === null || distanceSquared < closest.distanceSquared
                ? { name: candidate.name, distanceSquared }
                : closest;
        }, null);
        return closestDistrict?.name ?? null;
    }

    return { getCurrentPlayerCoords, getDistrictAtCoords };
})();
