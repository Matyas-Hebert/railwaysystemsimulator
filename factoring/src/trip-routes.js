import * as data from "../generated/timetable.js";

    function getTripRoute(lineID, tripID) {
        const normalizedLineID = Number(lineID);
        const normalizedTripID = Number(tripID);
        const line = data.timetable.lines[normalizedLineID];
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

    function getTripStopIndices(lineID, tripID, stationID) {
        const route = getTripRoute(lineID, tripID);
        const line = data.timetable.lines[Number(lineID)];
        const normalizedStationID = Number(stationID);
        if (route === null || !line) return [];

        const stopIndices = [];
        for (
            let stopIndex = route.startIndex;
            stopIndex <= route.endIndex;
            stopIndex++
        ) {
            if (line.stops[stopIndex].sid === normalizedStationID) {
                stopIndices.push(stopIndex);
            }
        }
        return stopIndices;
    }

    function getTripStopIndex(
        lineID,
        tripID,
        stationID,
        afterStopIndex = -1
    ) {
        return getTripStopIndices(lineID, tripID, stationID)
            .find(stopIndex => stopIndex > afterStopIndex) ?? -1;
    }

    function tripServesStop(lineID, tripID, stationID) {
        return getTripStopIndices(lineID, tripID, stationID).length > 0;
    }

    function getTripOriginStationId(lineID, tripID) {
        return getTripRoute(lineID, tripID)?.originStationId ?? null;
    }

    function getTripDestinationStationId(lineID, tripID) {
        return getTripRoute(lineID, tripID)?.destinationStationId ?? null;
    }

    export {
    getTripRoute,
    getTripStopIndices,
    getTripStopIndex,
    tripServesStop,
    getTripOriginStationId,
    getTripDestinationStationId
};
