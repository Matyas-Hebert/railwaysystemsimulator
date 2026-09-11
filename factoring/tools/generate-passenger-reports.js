import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timetable } from "../generated/timetable.js";

const TOOL_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const APP_DIRECTORY = path.resolve(TOOL_DIRECTORY, "..");
const REPORT_DIRECTORY = path.join(APP_DIRECTORY, "reports", "passengers");

// Calibration and behaviour. These are deliberately all in one place.
const TOTAL_DAILY_PASSENGER_DEMAND = 9_000_000;
const DEFAULT_SIMULATED_JOURNEYS = 50_000;
const requestedJourneyCount = Number(process.argv[2] ?? DEFAULT_SIMULATED_JOURNEYS);
const SIMULATED_JOURNEYS = Number.isInteger(requestedJourneyCount)
    && requestedJourneyCount > 0
    ? requestedJourneyCount : DEFAULT_SIMULATED_JOURNEYS;
const DESTINATION_CANDIDATES = 40;
const PASSENGERS_PER_TRIP = 300;
const SAME_PS_OR_PX_SYSTEM_MULTIPLIER = 2;
const TRANSFER_PENALTY_MINUTES = 12;
const PRICE_PENALTY_MINUTES_PER_CURRENCY_UNIT = 0.005;
const ALTERNATIVE_OVERLAP_PENALTY_MINUTES = 25;
const ROUTE_SPLIT_TEMPERATURE_MINUTES = 35;
const RANDOM_SEED = 0x4d44524d;

const lineTypes = JSON.parse(fs.readFileSync(
    path.join(APP_DIRECTORY, "config", "line-types.json"),
    "utf8"
));
const pricing = JSON.parse(fs.readFileSync(
    path.join(APP_DIRECTORY, "config", "journey-pricing.json"),
    "utf8"
));

function createRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

const random = createRandom(RANDOM_SEED);

function distanceKm(first, second) {
    const radius = 6371;
    const latitude = (second.lat - first.lat) * Math.PI / 180;
    const longitude = (second.lon - first.lon) * Math.PI / 180;
    const value = Math.sin(latitude / 2) ** 2
        + Math.cos(first.lat * Math.PI / 180)
        * Math.cos(second.lat * Math.PI / 180)
        * Math.sin(longitude / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function mergeDefined(target, source) {
    if (!source) return target;
    Object.entries(source).forEach(([key, value]) => {
        if (key !== "train_types" && value !== undefined) target[key] = value;
    });
    return target;
}

function getLinePricePerKm(line) {
    const typeCode = lineTypes[line.type]?.code;
    const company = pricing.companies?.[line.company];
    const result = {};
    mergeDefined(result, pricing.default);
    mergeDefined(result, pricing.train_types?.[line.type]);
    mergeDefined(result, company);
    mergeDefined(result, company?.train_types?.[typeCode]);
    return Number(result.price_per_km) || 0;
}

const pricePerKmByLine = timetable.lines.map(getLinePricePerKm);

function getConfiguredRoute(line, tripId) {
    const fullRoute = [0, line.stops.length - 1];
    const routeIndex = Number(line.routes?.[tripId]);
    const route = Number.isInteger(routeIndex)
        ? line.possibleRoutes?.[routeIndex]
        : null;
    return Array.isArray(route) && route.length === 2 ? route : fullRoute;
}

function buildNetwork() {
    const adjacency = Array.from(
        { length: timetable.stations.length },
        () => []
    );
    const patterns = [];
    const sections = new Map();

    timetable.lines.forEach(line => {
        const routeCounts = new Map();
        for (let tripId = 0; tripId < line.trips; tripId++) {
            const [startIndex, endIndex] = getConfiguredRoute(line, tripId);
            const key = `${startIndex}:${endIndex}`;
            routeCounts.set(key, (routeCounts.get(key) || 0) + 1);
        }

        const patternByEndIndex = new Map();
        const edgeByPatternAndSection = new Map();
        routeCounts.forEach((trips, key) => {
            const [startIndex, endIndex] = key.split(":").map(Number);
            let pattern = patternByEndIndex.get(endIndex);
            if (!pattern) {
                pattern = {
                    id: patterns.length,
                    lineId: line.id,
                    endIndex
                };
                patternByEndIndex.set(endIndex, pattern);
                patterns.push(pattern);
            }

            for (let index = startIndex; index < endIndex; index++) {
                const from = line.stops[index];
                const to = line.stops[index + 1];
                const sectionKey = `${line.id}:${index}`;
                if (!sections.has(sectionKey)) {
                    sections.set(sectionKey, {
                        key: sectionKey,
                        lineId: line.id,
                        stopIndex: index,
                        fromId: from.sid,
                        toId: to.sid,
                        distance: Number(to.dist) || 0,
                        capacity: 0,
                        demand: 0
                    });
                }
                sections.get(sectionKey).capacity += trips * PASSENGERS_PER_TRIP;

                const edgeKey = `${pattern.id}:${index}`;
                const existingEdge = edgeByPatternAndSection.get(edgeKey);
                if (existingEdge) {
                    existingEdge.trips += trips;
                }
                else {
                    const edge = {
                        patternId: pattern.id,
                        lineId: line.id,
                        sectionKey,
                        fromId: from.sid,
                        toId: to.sid,
                        distance: Number(to.dist) || 0,
                        travelMinutes: Math.max(0, (to.arr - from.dep) / 60),
                        trips
                    };
                    edgeByPatternAndSection.set(edgeKey, edge);
                    adjacency[from.sid].push(edge);
                }
            }
        });
    });
    return { adjacency, patterns, sections };
}

class MinHeap {
    constructor() {
        this.items = [];
    }
    push(item) {
        this.items.push(item);
        let index = this.items.length - 1;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.items[parent].priority <= item.priority) break;
            this.items[index] = this.items[parent];
            index = parent;
        }
        this.items[index] = item;
    }
    pop() {
        if (this.items.length === 0) return null;
        const first = this.items[0];
        const last = this.items.pop();
        if (this.items.length > 0) {
            let index = 0;
            while (true) {
                let child = index * 2 + 1;
                if (child >= this.items.length) break;
                if (child + 1 < this.items.length
                    && this.items[child + 1].priority < this.items[child].priority) {
                    child++;
                }
                if (this.items[child].priority >= last.priority) break;
                this.items[index] = this.items[child];
                index = child;
            }
            this.items[index] = last;
        }
        return first;
    }
}

const network = buildNetwork();
const STATE_MULTIPLIER = network.patterns.length + 1;

function getStateKey(stationId, patternId) {
    return stationId * STATE_MULTIPLIER + patternId + 1;
}

function findRoute(originId, destinationId, penalizedPatterns = new Set()) {
    const heap = new MinHeap();
    const best = new Map();
    const previous = new Map();
    const heuristicByStation = new Float64Array(timetable.stations.length);
    heuristicByStation.fill(-1);
    const getHeuristic = stationId => {
        if (heuristicByStation[stationId] >= 0) {
            return heuristicByStation[stationId];
        }
        const value = distanceKm(
            timetable.stations[stationId],
            timetable.stations[destinationId]
        ) / 900 * 60;
        heuristicByStation[stationId] = value;
        return value;
    };
    const startKey = getStateKey(originId, -1);
    best.set(startKey, 0);
    heap.push({ stationId: originId, patternId: -1, cost: 0, priority: getHeuristic(originId), key: startKey });
    let destinationState = null;

    while (heap.items.length > 0) {
        const state = heap.pop();
        if (state.cost !== best.get(state.key)) continue;
        if (state.stationId === destinationId) {
            destinationState = state;
            break;
        }
        for (const edge of network.adjacency[state.stationId]) {
            const changingService = state.patternId !== edge.patternId;
            let addedCost = edge.travelMinutes
                + edge.distance
                * pricePerKmByLine[edge.lineId]
                * PRICE_PENALTY_MINUTES_PER_CURRENCY_UNIT;
            if (changingService) {
                addedCost += 720 / Math.max(1, edge.trips);
                if (state.patternId !== -1) addedCost += TRANSFER_PENALTY_MINUTES;
            }
            if (penalizedPatterns.has(edge.patternId)) {
                addedCost += ALTERNATIVE_OVERLAP_PENALTY_MINUTES;
            }
            const nextKey = getStateKey(edge.toId, edge.patternId);
            const nextCost = state.cost + addedCost;
            if (nextCost >= (best.get(nextKey) ?? Infinity)) continue;
            best.set(nextKey, nextCost);
            previous.set(nextKey, { previousKey: state.key, edge });
            heap.push({
                stationId: edge.toId,
                patternId: edge.patternId,
                cost: nextCost,
                priority: nextCost + getHeuristic(edge.toId),
                key: nextKey
            });
        }
    }

    if (destinationState === null) return null;
    const edges = [];
    let key = destinationState.key;
    while (key !== startKey) {
        const step = previous.get(key);
        if (!step) return null;
        edges.push(step.edge);
        key = step.previousKey;
    }
    edges.reverse();
    return { cost: destinationState.cost, edges };
}

function getAlternatives(originId, destinationId) {
    const first = findRoute(originId, destinationId);
    if (!first) return [];
    const usedPatterns = new Set(first.edges.map(edge => edge.patternId));
    const second = findRoute(originId, destinationId, usedPatterns);
    if (!second) return [first];
    const firstSignature = first.edges.map(edge => edge.patternId).join(",");
    const secondSignature = second.edges.map(edge => edge.patternId).join(",");
    return firstSignature === secondSignature ? [first] : [first, second];
}

const originWeights = timetable.stations.map(
    station => Math.max(0.000001, Number(station.importance) || 0)
);
const cumulativeOriginWeights = [];
originWeights.reduce((sum, value, index) => {
    cumulativeOriginWeights[index] = sum + value;
    return sum + value;
}, 0);
const totalOriginWeight = cumulativeOriginWeights.at(-1);

function weightedIndex(cumulative, total) {
    const target = random() * total;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (cumulative[middle] < target) low = middle + 1;
        else high = middle;
    }
    return low;
}

function shareLocalSystem(first, second) {
    return (first.psSystemID !== undefined
            && first.psSystemID === second.psSystemID)
        || (first.pxSystemID !== undefined
            && first.pxSystemID === second.pxSystemID);
}

function chooseDestination(originId) {
    const origin = timetable.stations[originId];
    const candidates = [];
    let total = 0;
    for (let index = 0; index < DESTINATION_CANDIDATES; index++) {
        const stationId = Math.floor(random() * timetable.stations.length);
        if (stationId === originId) continue;
        const station = timetable.stations[stationId];
        const distance = Math.max(0.25, distanceKm(origin, station));
        const localMultiplier = shareLocalSystem(origin, station)
            ? SAME_PS_OR_PX_SYSTEM_MULTIPLIER
            : 1;
        const weight = Math.max(0.000001, Number(station.importance) || 0)
            * localMultiplier / Math.sqrt(distance);
        total += weight;
        candidates.push({ stationId, cumulative: total });
    }
    if (candidates.length === 0) return null;
    const target = random() * total;
    return candidates.find(candidate => candidate.cumulative >= target)?.stationId
        ?? candidates.at(-1).stationId;
}

const lineStats = timetable.lines.map(line => ({
    lineId: line.id,
    boardings: 0,
    passengerKm: 0
}));
const stationStats = timetable.stations.map(station => ({
    stationId: station.id,
    origins: 0,
    destinations: 0,
    boardings: 0,
    alightings: 0
}));

function assignRoute(route, passengers) {
    let previousPattern = -1;
    route.edges.forEach((edge, index) => {
        network.sections.get(edge.sectionKey).demand += passengers;
        lineStats[edge.lineId].passengerKm += passengers * edge.distance;
        if (edge.patternId !== previousPattern) {
            lineStats[edge.lineId].boardings += passengers;
            stationStats[edge.fromId].boardings += passengers;
        }
        const nextEdge = route.edges[index + 1];
        if (!nextEdge || nextEdge.patternId !== edge.patternId) {
            stationStats[edge.toId].alightings += passengers;
        }
        previousPattern = edge.patternId;
    });
}

let unreachableDemand = 0;
const passengersPerSample = TOTAL_DAILY_PASSENGER_DEMAND / SIMULATED_JOURNEYS;
for (let sample = 0; sample < SIMULATED_JOURNEYS; sample++) {
    if (sample%100 == 0){
        console.log(sample+"/"+SIMULATED_JOURNEYS);
    }
    const originId = weightedIndex(cumulativeOriginWeights, totalOriginWeight);
    const destinationId = chooseDestination(originId);
    if (destinationId === null) continue;
    stationStats[originId].origins += passengersPerSample;
    stationStats[destinationId].destinations += passengersPerSample;

    const alternatives = getAlternatives(originId, destinationId);
    if (alternatives.length === 0) {
        unreachableDemand += passengersPerSample;
        continue;
    }
    const minimumCost = Math.min(...alternatives.map(route => route.cost));
    const attractiveness = alternatives.map(route =>
        Math.exp(-(route.cost - minimumCost) / ROUTE_SPLIT_TEMPERATURE_MINUTES)
    );
    const totalAttractiveness = attractiveness.reduce((sum, value) => sum + value, 0);
    alternatives.forEach((route, index) => {
        assignRoute(
            route,
            passengersPerSample * attractiveness[index] / totalAttractiveness
        );
    });
    if ((sample + 1) % 250 === 0) {
        process.stdout.write(`\rSimulated ${sample + 1}/${SIMULATED_JOURNEYS} journeys`);
    }
}
process.stdout.write("\n");

function lineName(line) {
    return `${line.company} ${lineTypes[line.type]?.code ?? "?"} ${line.number}`;
}

function stationName(stationId) {
    return timetable.stations[stationId]?.name ?? `Stanice ${stationId}`;
}

const sectionStats = [...network.sections.values()].map(section => ({
    ...section,
    utilization: section.capacity > 0 ? section.demand / section.capacity : Infinity,
    transported: Math.min(section.demand, section.capacity),
    unmet: Math.max(0, section.demand - section.capacity)
}));

sectionStats.forEach(section => {
    const stats = lineStats[section.lineId];
    stats.peakUtilization = Math.max(stats.peakUtilization || 0, section.utilization);
    if (!stats.busiestSection || section.demand > stats.busiestSection.demand) {
        stats.busiestSection = section;
    }
});

function formatNumber(value) {
    return Math.round(value).toLocaleString("cs-CZ");
}

function formatPercent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)} %` : "∞";
}

fs.mkdirSync(REPORT_DIRECTORY, { recursive: true });

const summary = [
    "ODHAD DENNÍ POPTÁVKY CESTUJÍCÍCH",
    "================================",
    `Celková modelovaná poptávka: ${formatNumber(TOTAL_DAILY_PASSENGER_DEMAND)}`,
    `Simulovaných cest: ${formatNumber(SIMULATED_JOURNEYS)}`,
    `Poptávka bez nalezeného spojení: ${formatNumber(unreachableDemand)}`,
    `Kapacita jednoho spoje: ${PASSENGERS_PER_TRIP}`,
    "",
    "Model používá důležitost obou stanic, 1/sqrt(vzdálenosti), dvojnásobnou",
    "lokální poptávku uvnitř stejného Ps/Px systému, intervaly, jízdní dobu,",
    "přestupy, cenu, zkrácené trasy spojů a dvě rozdělené alternativy.",
    "",
    "Čísla jsou syntetický herní odhad. Absolutní úroveň určuje konstanta",
    "TOTAL_DAILY_PASSENGER_DEMAND na začátku skriptu."
].join("\n");

const lineReport = lineStats
    .filter(stats => stats.boardings > 0)
    .sort((first, second) => second.boardings - first.boardings)
    .map((stats, index) => {
        const line = timetable.lines[stats.lineId];
        const section = stats.busiestSection;
        return [
            `${index + 1}. ${lineName(line)} (ID ${line.id})`,
            `   Nástupy: ${formatNumber(stats.boardings)} / den`,
            `   Osobokilometry: ${formatNumber(stats.passengerKm)}`,
            `   Nejvytíženější úsek: ${stationName(section.fromId)} → ${stationName(section.toId)}`,
            `   Poptávka / kapacita: ${formatNumber(section.demand)} / ${formatNumber(section.capacity)} (${formatPercent(section.utilization)})`
        ].join("\n");
    }).join("\n\n");

const sectionReport = [...sectionStats]
    .sort((first, second) => second.demand - first.demand)
    .map((section, index) => [
        `${index + 1}. ${lineName(timetable.lines[section.lineId])}`,
        `   ${stationName(section.fromId)} → ${stationName(section.toId)}`,
        `   Poptávka: ${formatNumber(section.demand)} | Kapacita: ${formatNumber(section.capacity)} | Vytížení: ${formatPercent(section.utilization)}`,
        `   Přepraveno: ${formatNumber(section.transported)} | Neuspokojená poptávka: ${formatNumber(section.unmet)}`
    ].join("\n")).join("\n\n");

const overcrowdedReport = sectionStats
    .filter(section => section.demand > section.capacity)
    .sort((first, second) => second.utilization - first.utilization)
    .map((section, index) => [
        `${index + 1}. ${lineName(timetable.lines[section.lineId])}`,
        `   ${stationName(section.fromId)} → ${stationName(section.toId)}`,
        `   ${formatNumber(section.demand)} / ${formatNumber(section.capacity)} (${formatPercent(section.utilization)})`,
        `   Chybějící kapacita: ${formatNumber(section.unmet)} cestujících`
    ].join("\n")).join("\n\n") || "Žádné přetížené úseky.";

const stationReport = stationStats
    .sort((first, second) =>
        second.origins + second.destinations - first.origins - first.destinations
    )
    .map((stats, index) => [
        `${index + 1}. ${stationName(stats.stationId)} (ID ${stats.stationId})`,
        `   Výchozí cesty: ${formatNumber(stats.origins)} | Cílové cesty: ${formatNumber(stats.destinations)}`,
        `   Nástupy: ${formatNumber(stats.boardings)} | Výstupy: ${formatNumber(stats.alightings)}`
    ].join("\n")).join("\n\n");

fs.writeFileSync(path.join(REPORT_DIRECTORY, "summary.txt"), summary + "\n");
fs.writeFileSync(path.join(REPORT_DIRECTORY, "passengers-by-line.txt"), lineReport + "\n");
fs.writeFileSync(path.join(REPORT_DIRECTORY, "passengers-by-section.txt"), sectionReport + "\n");
fs.writeFileSync(path.join(REPORT_DIRECTORY, "passengers-by-station.txt"), stationReport + "\n");
fs.writeFileSync(path.join(REPORT_DIRECTORY, "overcrowded-sections.txt"), overcrowdedReport + "\n");

console.log(`Passenger reports written to ${REPORT_DIRECTORY}`);
