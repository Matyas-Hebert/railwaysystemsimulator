import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const LINE_TYPES_PATH = path.resolve(
    TOOL_DIRECTORY,
    "../config/line-types.json"
);

function printUsage() {
    console.log(
        "Použití: node factoring/tools/calculate-line-time.js "
        + "<typ linky> <délka v km> <počet stanic>"
    );
    console.log(
        "Příklad: node factoring/tools/calculate-line-time.js SC 300 6"
    );
}

function parsePositiveNumber(value, label) {
    const number = Number(String(value).replace(",", "."));
    if (!Number.isFinite(number) || number <= 0) {
        throw new TypeError(label + " musí být kladné číslo.");
    }
    return number;
}

function parseStationCount(value) {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 2) {
        throw new TypeError(
            "Počet stanic musí být celé číslo větší nebo rovné 2."
        );
    }
    return count;
}

function getTravelTimeSeconds(distanceKm, typeConfig) {
    const maxSpeed = typeConfig.maxSpeedKmh;
    const acceleration = typeConfig.accelerationKmhPerHourSquared;
    const overhead = typeConfig.travelTimeOverheadSeconds ?? 0;
    const criticalDistance = maxSpeed ** 2 / acceleration;

    if (distanceKm <= criticalDistance) {
        return 2 * Math.sqrt(distanceKm / acceleration) * 3600
            + overhead;
    }

    return (
        distanceKm / maxSpeed
        + maxSpeed / acceleration
    ) * 3600 + overhead;
}

function formatDuration(seconds) {
    const rounded = Math.round(seconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor(rounded % 3600 / 60);
    const remainingSeconds = rounded % 60;

    return [
        hours,
        minutes,
        remainingSeconds
    ].map(value => String(value).padStart(2, "0")).join(":");
}

function buildStationTimes(
    stationCount,
    sectionLengthKm,
    sectionTravelSeconds,
    stopTimeSeconds
) {
    const stations = [];
    let elapsedSeconds = 0;

    for (let stationIndex = 0; stationIndex < stationCount; stationIndex++) {
        if (stationIndex > 0) {
            elapsedSeconds += sectionTravelSeconds;
        }

        const isFirst = stationIndex === 0;
        const isLast = stationIndex === stationCount - 1;
        const arrivalSeconds = isFirst ? null : elapsedSeconds;
        const departureSeconds = isLast ? null : elapsedSeconds;

        stations.push({
            number: stationIndex + 1,
            distanceKm: stationIndex * sectionLengthKm,
            arrivalSeconds,
            departureSeconds
        });

        if (!isFirst && !isLast) {
            elapsedSeconds += stopTimeSeconds;
            stations[stations.length - 1].departureSeconds = elapsedSeconds;
        }
    }

    return {
        stations,
        totalSeconds: elapsedSeconds
    };
}

function main() {
    const [typeArgument, lengthArgument, stationCountArgument] =
        process.argv.slice(2);

    if (
        typeArgument === undefined
        || lengthArgument === undefined
        || stationCountArgument === undefined
    ) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    const lineTypes = JSON.parse(
        fs.readFileSync(LINE_TYPES_PATH, "utf8")
    );
    const typeConfig = lineTypes.find(type =>
        type.code.toLowerCase() === typeArgument.toLowerCase()
    );
    if (typeConfig === undefined) {
        throw new TypeError(
            "Neznámý typ linky "
            + typeArgument
            + ". Dostupné typy: "
            + lineTypes.map(type => type.code).join(", ")
        );
    }

    const lineLengthKm = parsePositiveNumber(
        lengthArgument,
        "Délka linky"
    );
    const stationCount = parseStationCount(stationCountArgument);
    const sectionCount = stationCount - 1;
    const sectionLengthKm = lineLengthKm / sectionCount;
    const sectionTravelSeconds = getTravelTimeSeconds(
        sectionLengthKm,
        typeConfig
    );
    const stopTimeSeconds = typeConfig.stopTimeSeconds;
    const totalMovementSeconds = sectionTravelSeconds * sectionCount;
    const totalDwellSeconds = stopTimeSeconds * Math.max(
        0,
        stationCount - 2
    );
    const { stations, totalSeconds } = buildStationTimes(
        stationCount,
        sectionLengthKm,
        sectionTravelSeconds,
        stopTimeSeconds
    );

    console.log("\nVÝPOČET JÍZDNÍ DOBY");
    console.log("====================");
    console.log("Typ linky:           " + typeConfig.code);
    console.log("Délka linky:         " + lineLengthKm.toFixed(2) + " km");
    console.log("Počet stanic:        " + stationCount);
    console.log("Počet úseků:         " + sectionCount);
    console.log(
        "Délka jednoho úseku: "
        + sectionLengthKm.toFixed(2)
        + " km"
    );
    console.log(
        "Max. rychlost:       "
        + typeConfig.maxSpeedKmh
        + " km/h"
    );
    console.log(
        "Zrychlení:           "
        + typeConfig.accelerationKmhPerHourSquared
        + " km/h²"
    );
    console.log(
        "Jízda v úsecích:     "
        + formatDuration(totalMovementSeconds)
    );
    console.log(
        "Stání ve stanicích:  "
        + formatDuration(totalDwellSeconds)
        + " ("
        + Math.max(0, stationCount - 2)
        + " mezilehlých stanic)"
    );
    console.log(
        "CELKOVÁ JÍZDNÍ DOBA: "
        + formatDuration(totalSeconds)
    );

    console.log("\nROZMÍSTĚNÍ STANIC");
    console.log("==================");
    stations.forEach(station => {
        const arrival = station.arrivalSeconds === null
            ? "—"
            : formatDuration(station.arrivalSeconds);
        const departure = station.departureSeconds === null
            ? "—"
            : formatDuration(station.departureSeconds);
        console.log(
            String(station.number).padStart(3, " ")
            + ". "
            + station.distanceKm.toFixed(2).padStart(9, " ")
            + " km | příjezd "
            + arrival
            + " | odjezd "
            + departure
        );
    });
}

try {
    main();
} catch (error) {
    console.error("Chyba: " + error.message);
    printUsage();
    process.exitCode = 1;
}
