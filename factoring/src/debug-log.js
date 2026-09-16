(function () {
    "use strict";

    const STORAGE_KEY = "_debugLog";
    const MAX_ENTRIES = 200;
    const MAX_VALUE_LENGTH = 4000;
    const nativeConsole = {};
    let entries = loadEntries();

    function loadEntries() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return Array.isArray(saved) ? saved.slice(-MAX_ENTRIES) : [];
        } catch (_) {
            return [];
        }
    }

    function saveEntries() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } catch (_) {
            // Logging must never break the game, even when storage is unavailable.
        }
    }

    function stringify(value) {
        if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
        if (typeof value === "string") return value;
        if (typeof value === "undefined") return "undefined";
        if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;

        try {
            const seen = new WeakSet();
            return JSON.stringify(value, (_, nestedValue) => {
                if (typeof nestedValue === "bigint") return `${nestedValue}n`;
                if (typeof nestedValue === "object" && nestedValue !== null) {
                    if (seen.has(nestedValue)) return "[Circular]";
                    seen.add(nestedValue);
                }
                return nestedValue;
            });
        } catch (_) {
            return String(value);
        }
    }

    function add(level, values) {
        const message = values.map(stringify).join(" ").slice(0, MAX_VALUE_LENGTH);
        const entry = { time: new Date().toLocaleTimeString("cs-CZ"), level, message };
        const previous = entries[entries.length - 1];

        if (previous && previous.level === entry.level && previous.message === entry.message) {
            previous.count = (previous.count || 1) + 1;
            previous.time = entry.time;
        } else {
            entries.push(entry);
            if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
        }

        saveEntries();
        render();
    }

    function formatEntry(entry) {
        const repeated = entry.count > 1 ? ` (×${entry.count})` : "";
        return `[${entry.time}] [${entry.level.toUpperCase()}]${repeated} ${entry.message}`;
    }

    function getText() {
        return entries.map(formatEntry).join("\n\n");
    }

    function render() {
        const output = document.getElementById("_debuglog");
        if (output === null) return;
        output.value = getText() || "Zatím nebyly zaznamenány žádné zprávy.";
        output.scrollTop = output.scrollHeight;
    }

    function clear() {
        entries = [];
        saveEntries();
        render();
    }

    ["debug", "info", "log", "warn", "error"].forEach(level => {
        nativeConsole[level] = console[level].bind(console);
        console[level] = (...values) => {
            nativeConsole[level](...values);
            add(level, values);
        };
    });

    window.addEventListener("error", event => {
        const location = event.filename
            ? ` (${event.filename}:${event.lineno || 0}:${event.colno || 0})`
            : "";
        add("error", [event.error || `${event.message}${location}`]);
    });

    window.addEventListener("unhandledrejection", event => {
        add("error", ["Unhandled promise rejection:", event.reason]);
    });

    window.debugLog = { render, clear, getText };
})();
