let renderIntervalId = null;
let renderIntervalMs = null;
let renderCallback = null;

function initialize(callback, milliseconds = 5000) {
    renderCallback = callback;
    setRenderInterval(milliseconds);
}

function setRenderInterval(milliseconds) {
    if (
        milliseconds === renderIntervalMs
        && renderIntervalId !== null
    ) {
        return;
    }

    renderIntervalMs = milliseconds;

    if (renderIntervalId !== null) {
        clearInterval(renderIntervalId);
    }

    renderIntervalId = setInterval(() => {
        renderCallback?.();
    }, renderIntervalMs);
}

function getRenderInterval() {
    return renderIntervalMs;
}

export {
    initialize,
    setRenderInterval,
    getRenderInterval
};