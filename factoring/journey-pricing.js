const journeyPricing = (() => {
    function getLineConfig(lineID) {
        const normalizedLineID = Number(lineID);
        const line = timetable.lines[normalizedLineID];
        if (!Number.isInteger(normalizedLineID) || !line) {
            throw new TypeError("A valid timetable lineID is required.");
        }

        const typeCode = lineTypeConfig[line.type]?.code;
        const typeConfig = journeyPricingConfig.train_types[line.type] ?? {};
        const companyConfig = journeyPricingConfig.companies[line.company] ?? {};
        const { train_types: companyTrainTypes, ...companyValues } = companyConfig;
        const companyTypeConfig = companyTrainTypes?.[typeCode] ?? {};

        return {
            ...journeyPricingConfig.default,
            ...typeConfig,
            ...companyValues,
            ...companyTypeConfig
        };
    }

    function getDistanceBetweenStops(lineID, startStationId, endStationId) {
        const line = timetable.lines[Number(lineID)];
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
        const line = timetable.lines[Number(lineID)];
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

    return {
        getLineConfig,
        getDistanceBetweenStops,
        getDistanceDifferenceBetweenStops
    };
})();