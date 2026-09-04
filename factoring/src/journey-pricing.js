import * as tripRoutes from "./trip-routes.js";
import * as data from "../generated/timetable.js";
import * as config from "../generated/config.js";

    function getLineConfig(lineID) {
        const normalizedLineID = Number(lineID);
        const line = data.timetable.lines[normalizedLineID];
        if (!Number.isInteger(normalizedLineID) || !line) {
            throw new TypeError("A valid data.timetable lineID is required.");
        }

        const typeCode = config.lineTypes[line.type]?.code;
        const typeConfig = config.journeyPricing.train_types[line.type] ?? {};
        const companyConfig = config.journeyPricing.companies[line.company] ?? {};
        const { train_types: companyTrainTypes, ...companyValues } = companyConfig;
        const companyTypeConfig = companyTrainTypes?.[typeCode] ?? {};

        return {
            ...config.journeyPricing.default,
            ...typeConfig,
            ...companyValues,
            ...companyTypeConfig
        };
    }

    function getDistanceBetweenStops(lineID, startStationId, endStationId) {
        const line = data.timetable.lines[Number(lineID)];
        if (!line || !Array.isArray(line.stops)) return null;

        const startIndex = line.stops.findIndex(stop => stop.sid === Number(startStationId));
        const endIndex = line.stops.findIndex(
            (stop, index) => index > startIndex && stop.sid === Number(endStationId)
        );
        if (startIndex < 0 || endIndex < 0) return null;

        const distanceToCurrentStation = line.stops
            .slice(0, startIndex + 1)
            .reduce((distance, stop) => distance + Number(stop.dist), 0);
        const distanceToDestination = line.stops
            .slice(0, endIndex + 1)
            .reduce((distance, stop) => distance + Number(stop.dist), 0);

        return distanceToDestination - distanceToCurrentStation;
    }

    function getDistanceDifferenceBetweenStops(lineID, fromStationId, toStationId) {
        const line = data.timetable.lines[Number(lineID)];
        if (!line || !Array.isArray(line.stops)) return null;

        const fromIndex = line.stops.findIndex(stop => stop.sid === Number(fromStationId));
        const toIndex = line.stops.findIndex(stop => stop.sid === Number(toStationId));
        if (fromIndex < 0 || toIndex < 0) return null;

        const distanceToFromStation = line.stops
            .slice(0, fromIndex + 1)
            .reduce((distance, stop) => distance + Number(stop.dist), 0);
        const distanceToToStation = line.stops
            .slice(0, toIndex + 1)
            .reduce((distance, stop) => distance + Number(stop.dist), 0);

        return distanceToToStation - distanceToFromStation;
    }
    function getTripDistanceBetweenStops(
        lineID,
        tripID,
        startStationId,
        endStationId,
        startStopIndex = null,
        endStopIndex = null
    ) {
        const line = data.timetable.lines[Number(lineID)];
        const route = tripRoutes.getTripRoute(lineID, tripID);
        if (!line || route === null) return null;

        const hasExplicitStartIndex = Number.isInteger(startStopIndex)
            && startStopIndex >= route.startIndex
            && startStopIndex <= route.endIndex
            && line.stops[startStopIndex].sid === Number(startStationId);
        const startIndex = hasExplicitStartIndex
            ? startStopIndex
            : tripRoutes.getTripStopIndex(
                lineID,
                tripID,
                startStationId
            );
        const hasExplicitEndIndex = Number.isInteger(endStopIndex)
            && endStopIndex > startIndex
            && endStopIndex <= route.endIndex
            && line.stops[endStopIndex].sid === Number(endStationId);
        const endIndex = hasExplicitEndIndex
            ? endStopIndex
            : tripRoutes.getTripStopIndex(
                lineID,
                tripID,
                endStationId,
                startIndex
            );
        if (startIndex < route.startIndex
            || endIndex > route.endIndex
            || endIndex <= startIndex) {
            return null;
        }

        return line.stops
            .slice(startIndex + 1, endIndex + 1)
            .reduce((distance, stop) => distance + Number(stop.dist), 0);
    }

    function getTripDistanceDifferenceBetweenStops(
        lineID,
        tripID,
        fromStationId,
        toStationId
    ) {
        const line = data.timetable.lines[Number(lineID)];
        const route = tripRoutes.getTripRoute(lineID, tripID);
        if (!line || route === null) return null;

        const fromIndex = tripRoutes.getTripStopIndex(
            lineID,
            tripID,
            fromStationId
        );
        const toIndex = tripRoutes.getTripStopIndex(
            lineID,
            tripID,
            toStationId
        );
        if (fromIndex < route.startIndex
            || fromIndex > route.endIndex
            || toIndex < route.startIndex
            || toIndex > route.endIndex) {
            return null;
        }

        const distanceToFromStation = line.stops
            .slice(route.startIndex + 1, fromIndex + 1)
            .reduce((distance, stop) => distance + Number(stop.dist), 0);
        const distanceToToStation = line.stops
            .slice(route.startIndex + 1, toIndex + 1)
            .reduce((distance, stop) => distance + Number(stop.dist), 0);
        return distanceToToStation - distanceToFromStation;
    }


    export {
    getLineConfig,
    getDistanceBetweenStops,
    getDistanceDifferenceBetweenStops,
    getTripDistanceBetweenStops,
    getTripDistanceDifferenceBetweenStops
};
