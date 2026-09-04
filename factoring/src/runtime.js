let gameState = null;
let currentSection = 0;
let stationSectionId = 200;
let trainSectionData = { lineID: 1, tripID: 1, day: 0, hidesinfront: true };
let startStationId = -1;
let openedDetail = "";
let connectionStructure = {};
let pinnedStationsOpened = false;
let ticketSelectionOpen = false;

const filters = {
    departures: true,
    types: Array(12).fill(true),
    statid: -1,
    ticketDestinationStatId: -1
};

export function initializeGameState(instance) {
    if (gameState !== null) throw new Error("GameState has already been initialized.");
    gameState = instance;
}
export function getGameState() {
    if (gameState === null) throw new Error("GameState has not been initialized.");
    return gameState;
}
export function getCurrentSection(){ return currentSection; }
export function setCurrentSection(value){ currentSection = Number(value); }
export function getStationSectionId(){ return stationSectionId; }
export function setStationSectionId(value){ stationSectionId = Number(value); }
export function getTrainSectionData(){ return trainSectionData; }
export function setTrainSectionData(value){ trainSectionData = structuredClone(value); }
export function getStartStationId(){ return startStationId; }
export function setStartStationId(value){ startStationId = Number(value); }
export function getOpenedDetail(){ return openedDetail; }
export function setOpenedDetail(value){ openedDetail = String(value); }
export function getConnectionStructure(){ return connectionStructure; }
export function setConnectionStructure(value){ connectionStructure = structuredClone(value); }
export function arePinnedStationsOpened(){ return pinnedStationsOpened; }
export function setPinnedStationsOpened(value){ pinnedStationsOpened = Boolean(value); }
export function isTicketSelectionOpen(){ return ticketSelectionOpen; }
export function setTicketSelectionOpen(value){ ticketSelectionOpen = Boolean(value); }
export function getFilters(){ return filters; }