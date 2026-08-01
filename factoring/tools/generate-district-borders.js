const EPSILON = 1e-12;
const VERTEX_EPSILON_SQUARED = 1e-20;
const BOUNDS_PADDING_DEGREES = 0.05;

function squaredDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function distance(a, b) {
    return Math.sqrt(squaredDistance(a, b));
}

function getCapitalEntries(capitalsData, project) {
    if (!Array.isArray(capitalsData?.features)) {
        throw new TypeError("Capital data must be a GeoJSON FeatureCollection.");
    }

    return capitalsData.features.map(feature => {
        const name = feature?.properties?.name;
        const coordinates = feature?.geometry?.coordinates;
        const lon = Number(coordinates?.[0]);
        const lat = Number(coordinates?.[1]);
        if (!name || feature?.geometry?.type !== "Point"
            || !Number.isFinite(lon) || !Number.isFinite(lat)) {
            throw new TypeError("Every district capital must be a named GeoJSON Point.");
        }
        return { name, lon, lat, point: project(lon, lat) };
    });
}

function getDifferenceFromBisector(point, selectedCapital, otherCapital) {
    return squaredDistance(point, selectedCapital)
        - squaredDistance(point, otherCapital);
}

function getIntersection(start, end, startDifference, endDifference) {
    const denominator = startDifference - endDifference;
    if (Math.abs(denominator) <= EPSILON) return { ...start };
    const ratio = startDifference / denominator;
    return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
    };
}

function removeDuplicateVertices(vertices) {
    const cleaned = [];
    vertices.forEach(vertex => {
        if (cleaned.length === 0
            || squaredDistance(vertex, cleaned[cleaned.length - 1]) > VERTEX_EPSILON_SQUARED) {
            cleaned.push(vertex);
        }
    });
    if (cleaned.length > 1
        && squaredDistance(cleaned[0], cleaned[cleaned.length - 1]) <= VERTEX_EPSILON_SQUARED) {
        cleaned.pop();
    }
    return cleaned;
}

function clipToSelectedCapital(polygon, selectedCapital, otherCapital) {
    const clipped = [];
    for (let index = 0; index < polygon.length; index++) {
        const start = polygon[index];
        const end = polygon[(index + 1) % polygon.length];
        const startDifference = getDifferenceFromBisector(
            start,
            selectedCapital,
            otherCapital
        );
        const endDifference = getDifferenceFromBisector(
            end,
            selectedCapital,
            otherCapital
        );
        const startInside = startDifference <= EPSILON;
        const endInside = endDifference <= EPSILON;

        if (startInside && endInside) {
            clipped.push(end);
        }
        else if (startInside && !endInside) {
            clipped.push(getIntersection(start, end, startDifference, endDifference));
        }
        else if (!startInside && endInside) {
            clipped.push(getIntersection(start, end, startDifference, endDifference));
            clipped.push(end);
        }
    }
    return removeDuplicateVertices(clipped);
}

function getFurthestBorderDistance(capital, polygon) {
    return polygon.reduce(
        (furthest, vertex) => Math.max(furthest, distance(capital, vertex)),
        0
    );
}

function pointIsInsidePolygon(point, polygon) {
    let inside = false;
    for (let current = 0, previous = polygon.length - 1;
        current < polygon.length;
        previous = current++) {
        const a = polygon[current];
        const b = polygon[previous];
        const cross = (point.x - a.x) * (b.y - a.y)
            - (point.y - a.y) * (b.x - a.x);
        const onSegment = Math.abs(cross) <= EPSILON
            && point.x >= Math.min(a.x, b.x) - EPSILON
            && point.x <= Math.max(a.x, b.x) + EPSILON
            && point.y >= Math.min(a.y, b.y) - EPSILON
            && point.y <= Math.max(a.y, b.y) + EPSILON;
        if (onSegment) return true;

        const crossesRay = (a.y > point.y) !== (b.y > point.y)
            && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
        if (crossesRay) inside = !inside;
    }
    return inside;
}

function roundCoordinate(value) {
    return Math.round(value * 1e7) / 1e7;
}

function generateDistrictBorders(stations, capitalsData) {
    const stationCoordinates = stations
        .map(station => ({ lon: Number(station.lon), lat: Number(station.lat) }))
        .filter(point => Number.isFinite(point.lon) && Number.isFinite(point.lat));
    const capitalCoordinates = capitalsData.features.map(feature => ({
        lon: Number(feature.geometry.coordinates[0]),
        lat: Number(feature.geometry.coordinates[1])
    }));
    const allCoordinates = [...stationCoordinates, ...capitalCoordinates];
    if (stationCoordinates.length === 0 || allCoordinates.length === 0) {
        throw new Error("District borders require stations and district capitals.");
    }

    const referenceLatitude = allCoordinates.reduce(
        (total, point) => total + point.lat,
        0
    ) / allCoordinates.length;
    const longitudeScale = Math.cos(referenceLatitude * Math.PI / 180);
    const project = (lon, lat) => ({ x: lon * longitudeScale, y: lat });
    const unproject = point => [
        roundCoordinate(point.x / longitudeScale),
        roundCoordinate(point.y)
    ];
    const capitals = getCapitalEntries(capitalsData, project);

    for (let first = 0; first < capitals.length; first++) {
        for (let second = first + 1; second < capitals.length; second++) {
            if (squaredDistance(capitals[first].point, capitals[second].point) <= EPSILON) {
                throw new Error(
                    `District capitals ${capitals[first].name} and ${capitals[second].name} overlap.`
                );
            }
        }
    }

    const projectedCoordinates = allCoordinates.map(point => project(point.lon, point.lat));
    const minX = Math.min(...projectedCoordinates.map(point => point.x))
        - BOUNDS_PADDING_DEGREES * longitudeScale;
    const maxX = Math.max(...projectedCoordinates.map(point => point.x))
        + BOUNDS_PADDING_DEGREES * longitudeScale;
    const minY = Math.min(...projectedCoordinates.map(point => point.y))
        - BOUNDS_PADDING_DEGREES;
    const maxY = Math.max(...projectedCoordinates.map(point => point.y))
        + BOUNDS_PADDING_DEGREES;
    const initialBorder = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
    ];

    return capitals.map(selected => {
        let border = initialBorder.map(vertex => ({ ...vertex }));
        let dist1 = getFurthestBorderDistance(selected.point, border);
        const otherCapitals = capitals
            .filter(capital => capital !== selected)
            .sort((a, b) => distance(selected.point, a.point)
                - distance(selected.point, b.point));

        for (const other of otherCapitals) {
            const capitalDistance = distance(selected.point, other.point);
            if (capitalDistance > 2 * dist1 + EPSILON) break;

            border = clipToSelectedCapital(border, selected.point, other.point);
            if (border.length < 3) {
                throw new Error(`District ${selected.name} produced an invalid border.`);
            }
            dist1 = getFurthestBorderDistance(selected.point, border);
        }

        if (!pointIsInsidePolygon(selected.point, border)) {
            throw new Error(`Capital of ${selected.name} is outside its generated border.`);
        }

        return {
            name: selected.name,
            capital: { lon: selected.lon, lat: selected.lat },
            borderVertices: border.map(unproject)
        };
    });
}

module.exports = { generateDistrictBorders };
