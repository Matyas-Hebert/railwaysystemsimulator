const TRAIN_TYPES = Object.freeze({
    PS: 0,
    PX: 1,
    OS: 2,
    OX: 3,
    SP: 4,
    R: 5,
    SH: 6,
    IC: 7,
    EC: 8,
    NJ: 9
});

const { PS, PX, OS, OX, SP, R, SH, IC, EC, NJ } = TRAIN_TYPES;

if (typeof module !== "undefined") {
    module.exports = TRAIN_TYPES;
}