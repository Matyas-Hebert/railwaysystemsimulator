export const SECONDS_PER_DAY = 86400;
export const MILLISECONDS_PER_DAY = 86400000;

export const ENERGY_RESTORATION_IDLE = 0.06;

//kmh
export const SPEEDS = [0, 0, 0, 7.5, 12.5, 18, 20, 30];

//kjs
export const CONSUMPTION = [0, 0, 0, 0.82, 2.5, 5, 1.5, 2.5];

export const TRANSPORT_TYPE = Object.freeze({
    FIELD: 0,
    STATION: 1,
    TRAIN: 2,
    WALKING: 3,
    RUNNING: 4,
    SPRINTING: 5,
    BIKING: 6,
    FASTBIKING: 7
});

export const TRAIN_STATUS = Object.freeze({
    NOT_DEPARTED: 0,
    STOPPED_BEFORE_TARGET: 1,
    TRAVELLING_TO_TARGET: 2,
    STOPPED_AT_TARGET: 3,
    TRAVELLING_PAST_TARGET: 4,
    STOPPED_PAST_TARGET: 5,
    FINISHED: 6,
    CANCELLED_BEFORE_TARGET: -1,
    CANCELLED_AFTER_TARGET: 7
});

export const SHOP_TYPE = Object.freeze({
   DATA_SHOP: 0 
});

export const DATA_OPERATOR = Object.freeze({
   NACL: 0,
   PIVOFONE: 1,
   POMELO: 2,
   CSTATIC: 3,
   OSPIK: 4 
});

export const TRAIN_TYPES = Object.freeze({
    PS: 0,
    PX: 1,
    OS: 2,
    OX: 3,
    SP: 4,
    R: 5,
    SH: 6,
    IC: 7,
    EC: 8,
    NJ: 9,
    AR: 10,
    AJ: 11,
    PAR: 12
});