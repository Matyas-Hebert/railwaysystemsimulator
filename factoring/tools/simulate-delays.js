import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timetable } from "../generated/timetable.js";
import lineTypes from "../config/line-types.json" with { type: "json" };

const DAYS = 30;
const FIRST_DAY = 21000;
const output = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../reports/delay-simulation.txt"
);

function random(seed) {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

function startingDelay(seed, type) {
    return -Math.log(1 - random(seed))
        * lineTypes[type].startingDelayMeanSeconds;
}

function delayMultiplier(seed, currentDelayRatio, type) {
    const model = lineTypes[type].delayModel;
    let result = -Math.log(
        1 - (random(seed) + model.randomOffset) * model.randomScale
    ) / model.logarithmDivisor;
    result = Math.min(model.maximumMultiplier, result) - model.baseOffset;
    if (model.minimumMultiplier !== null) {
        result = Math.max(model.minimumMultiplier, result);
    }
    if (model.respectCurrentDelayMinimum || result < 0) {
        return Math.max(
            result * model.recoveryMultiplier,
            -currentDelayRatio
        );
    }
    return result;
}

function routeFor(line, trip) {
    const routeIndex = Array.isArray(line.routes)
        ? Number(line.routes[trip])
        : null;
    const route = Number.isInteger(routeIndex)
        ? line.possibleRoutes?.[routeIndex]
        : null;
    const selected = Array.isArray(route)
        ? route
        : [0, line.stops.length - 1];
    return { start: Number(selected[0]), end: Number(selected[1]) };
}

function statsFor(type) {
    return {
        type, trips: 0, completed: 0, cancelled: 0, sections: 0,
        gains: 0, recoveries: 0, unchanged: 0,
        startingSum: 0, multiplierSum: 0, rawSum: 0,
        stationRecoverySum: 0, netSum: 0,
        starts: [], termini: [],
        buckets: [
            ["0-1 min", 0, 60, 0, 0],
            ["1-3 min", 60, 180, 0, 0],
            ["3-5 min", 180, 300, 0, 0],
            ["5-10 min", 300, 600, 0, 0],
            ["10+ min", 600, Infinity, 0, 0]
        ]
    };
}

function simulate(line, lineID, trip, day, stats) {
    const route = routeFor(line, trip);
    if (route.end <= route.start) return;
    let delay = startingDelay(
        (trip + 1) * 100 + lineID * 100000,
        line.type
    );
    stats.trips++;
    stats.startingSum += delay;
    stats.starts.push(delay);

    for (let i = route.start + 1; i <= route.end; i++) {
        const travel = line.stops[i].arr - line.stops[i - 1].dep;
        if (!(travel > 0)) continue;
        const before = delay;
        const seed = i + (trip + 1) * 50
            + lineID * 25000 + day * 100000000;
        const multiplier = delayMultiplier(
            seed, delay / travel, line.type
        );
        const raw = multiplier * travel;
        const arrivalDelay = delay + raw;
        stats.sections++;
        stats.multiplierSum += multiplier;
        stats.rawSum += raw;
        if (raw > 1e-9) stats.gains++;
        else if (raw < -1e-9) stats.recoveries++;
        else stats.unchanged++;

        if (
            i < route.end
            && random(seed * 2 + 1)
                <= lineTypes[line.type].cancellationProbabilityPerStop
        ) {
            stats.cancelled++;
            return;
        }

        delay = arrivalDelay;
        const stationRecovery = Math.min(
            delay,
            (line.stops[i].dep - line.stops[i].arr) / 3
        );
        delay -= stationRecovery;
        const net = delay - before;
        stats.stationRecoverySum += stationRecovery;
        stats.netSum += net;
        const bucket = stats.buckets.find(
            item => before >= item[1] && before < item[2]
        );
        if (bucket) {
            bucket[3]++;
            bucket[4] += net;
        }
        if (i === route.end) {
            stats.completed++;
            stats.termini.push(arrivalDelay);
        }
    }
}

const mean = (sum, count) => count ? sum / count : 0;
const seconds = value => `${value.toFixed(1)} s`;
const percent = (value, total) =>
    total ? `${(value / total * 100).toFixed(2)}%` : "0.00%";
function percentile(values, ratio) {
    if (!values.length) return 0;
    const index = (values.length - 1) * ratio;
    const low = Math.floor(index);
    const high = Math.ceil(index);
    return values[low] + (values[high] - values[low]) * (index - low);
}

function report(stats) {
    stats.starts.sort((a, b) => a - b);
    stats.termini.sort((a, b) => a - b);
    const terminusSum = stats.termini.reduce((a, b) => a + b, 0);
    const within = limit => stats.termini.filter(v => v <= limit).length;
    return [
        stats.type, "=".repeat(stats.type.length),
        `Trips simulated:              ${stats.trips}`,
        `Trips reaching terminus:      ${stats.completed}`,
        `Cancelled trips:              ${stats.cancelled}`,
        `Sections simulated:           ${stats.sections}`, "",
        "Starting delay",
        `  Mean:                       ${seconds(mean(stats.startingSum, stats.trips))}`,
        `  Median:                     ${seconds(percentile(stats.starts, .5))}`, "",
        "Raw section changes (before station recovery)",
        `  Gaining delay:              ${percent(stats.gains, stats.sections)}`,
        `  Recovering:                 ${percent(stats.recoveries, stats.sections)}`,
        `  Unchanged:                  ${percent(stats.unchanged, stats.sections)}`,
        `  Average multiplier:         ${mean(stats.multiplierSum, stats.sections).toFixed(5)}`,
        `  Average time change:        ${seconds(mean(stats.rawSum, stats.sections))}`, "",
        "Including station recovery",
        `  Average station recovery:   ${seconds(mean(stats.stationRecoverySum, stats.sections))}`,
        `  Average net section change: ${seconds(mean(stats.netSum, stats.sections))}`, "",
        "Terminus delay",
        `  Mean:                       ${seconds(mean(terminusSum, stats.termini.length))}`,
        `  Median:                     ${seconds(percentile(stats.termini, .5))}`,
        `  90th percentile:            ${seconds(percentile(stats.termini, .9))}`,
        `  99th percentile:            ${seconds(percentile(stats.termini, .99))}`,
        `  Maximum:                    ${seconds(stats.termini.at(-1) ?? 0)}`, "",
        "Arrival reliability",
        `  Within 1 minute:            ${percent(within(60), stats.termini.length)}`,
        `  Within 3 minutes:           ${percent(within(180), stats.termini.length)}`,
        `  Within 5 minutes:           ${percent(within(300), stats.termini.length)}`,
        `  More than 10 minutes:       ${percent(stats.termini.length - within(600), stats.termini.length)}`, "",
        "Average net change by delay before section",
        ...stats.buckets.map(item =>
            `  ${item[0].padEnd(10)} ${seconds(mean(item[4], item[3])).padStart(10)}  (${item[3]} sections)`
        ), ""
    ].join("\n");
}

const allStats = new Map(
    lineTypes.map(type => [type.id, statsFor(type.code)])
);
for (let offset = 0; offset < DAYS; offset++) {
    timetable.lines.forEach((line, lineID) => {
        if (!line || !allStats.has(line.type)) return;
        for (let trip = 0; trip < line.trips; trip++) {
            simulate(line, lineID, trip, FIRST_DAY + offset, allStats.get(line.type));
        }
    });
}
const text = [
    "DELAY SIMULATION REPORT", "=======================",
    `Simulated days: ${DAYS}`, `Starting day: ${FIRST_DAY}`, "",
    ...[...allStats.values()].map(report)
].join("\n");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, text, "utf8");
