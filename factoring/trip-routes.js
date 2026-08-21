const tripRoutes = (() => {
    function getTripRoute(lineID, tripID) {
        const normalizedLineID = Number(lineID);
        const normalizedTripID = Number(tripID);
        const line = timetable.lines[normalizedLineID];
        if (!line || !Array.isArray(line.stops) || line.stops.length === 0) return null;

        const fullRoute = [0, line.stops.length - 1];
        const routeIndex = Array.isArray(line.routes)
            ? Number(line.routes[normalizedTripID])
            : null;
        const configuredRoute = Number.isInteger(routeIndex)
            && Array.isArray(line.possibleRoutes)
            ? line.possibleRoutes[routeIndex]
            : null;
        const route = Array.isArray(configuredRoute) && configuredRoute.length === 2
            ? configuredRoute
            : fullRoute;
        const startIndex = Number(route[0]);
        const endIndex = Number(route[1]);
        const hasValidBounds = Number.isInteger(startIndex)
            && Number.isInteger(endIndex)
            && startIndex >= 0
            && endIndex >= startIndex
            && endIndex < line.stops.length;
        const [safeStartIndex, safeEndIndex] = hasValidBounds
            ? [startIndex, endIndex]
            : fullRoute;

        return {
            lineID: normalizedLineID,
            tripID: normalizedTripID,
            routeIndex: Number.isInteger(routeIndex) ? routeIndex : null,
            startIndex: safeStartIndex,
            endIndex: safeEndIndex,
            stops: line.stops.slice(safeStartIndex, safeEndIndex + 1),
            originStationId: line.stops[safeStartIndex].sid,
            destinationStationId: line.stops[safeEndIndex].sid
        };
    }

    function getTripStopIndex(lineID, tripID, stationID) {
        const route = getTripRoute(lineID, tripID);
        const line = timetable.lines[Number(lineID)];
        const normalizedStationID = Number(stationID);
        if (route === null || !line) return -1;

        for (let stopIndex = route.startIndex; stopIndex <= route.endIndex; stopIndex++) {
            if (line.stops[stopIndex].sid === normalizedStationID) return stopIndex;
        }
        return -1;
    }

    function tripServesStop(lineID, tripID, stationID) {
        return getTripStopIndex(lineID, tripID, stationID) !== -1;
    }

    function getTripOriginStationId(lineID, tripID) {
        return getTripRoute(lineID, tripID)?.originStationId ?? null;
    }

    function getTripDestinationStationId(lineID, tripID) {
        return getTripRoute(lineID, tripID)?.destinationStationId ?? null;
    }

    return {
        getTripRoute,
        getTripStopIndex,
        tripServesStop,
        getTripOriginStationId,
        getTripDestinationStationId
    };
})();
