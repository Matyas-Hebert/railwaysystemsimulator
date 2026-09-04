import * as constants from "./constants.js";
import * as runtime from "./runtime.js";
import * as clock from "./clock.js";

export function updateEnergy(){
    let gameState = runtime.getGameState();
    let energySnap = gameState.getEnergySnapshot();
    const now = clock.getCurrentTimeInMilliseconds();

    let timeAtCurrentRate = 0;
    let timeAtIdleRate = 0;

    if (energySnap.idleStartTime == null || energySnap.idleStartTime > now){
        timeAtCurrentRate = (now-energySnap.savedAt)/1000;
    }
    else{
        timeAtCurrentRate = (energySnap.idleStartTime-energySnap.savedAt)/1000;
        timeAtIdleRate = (now-energySnap.idleStartTime)/1000;
    }

    gameState.setEnergy(gameState.getEnergy()+energySnap.energyRate*timeAtCurrentRate);
    gameState.setEnergy(gameState.getEnergy()+constants.ENERGY_RESTORATION_IDLE*timeAtIdleRate);

    if (timeAtIdleRate > 0){
        gameState.setCurrentPosition(energySnap.positionAtIdleStart);
        gameState.setEnergySnapshot(null, constants.ENERGY_RESTORATION_IDLE, gameState.getEnergy(), null, now);
    }
    else{
        gameState.setEnergySnapshotLastEnergy(gameState.getEnergy());
        gameState.setEnergySnapshotSavedAt(now);
    }
}