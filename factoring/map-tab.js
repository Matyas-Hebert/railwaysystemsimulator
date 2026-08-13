const mapTab = (() => {
    const VIEW_WIDTH = 1000;
    const VIEW_HEIGHT = 680;
    const MAP_PADDING = 24;
    const MIN_SCALE = 1;
    const MAX_SCALE = 20;
    const POINT_RADIUS = 6;
    const CAPITAL_RADIUS = 0;
    let initialized = false;
    let mapLayer;
    let stationLayer;
    let project;
    let renderedStationId = null;
    let svg;
    let selectedDistrict = null;
    let transform = { x: 0, y: 0, scale: 1 };
    let dragStart = null;
    const activePointers = new Map();
    let pinchStart = null;

    function projectCoordinate(lon, lat) {
        const latitude = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
        return {
            x: lon * Math.PI / 180,
            y: -Math.log(Math.tan(Math.PI / 4 + latitude / 2))
        };
    }

    function getProjection() {
        const allPoints = districtBorders.flatMap(district => district.borderVertices)
            .map(([lon, lat]) => projectCoordinate(lon, lat));
        const minX = Math.min(...allPoints.map(point => point.x));
        const maxX = Math.max(...allPoints.map(point => point.x));
        const minY = Math.min(...allPoints.map(point => point.y));
        const maxY = Math.max(...allPoints.map(point => point.y));
        const scale = Math.min(
            (VIEW_WIDTH - MAP_PADDING * 2) / (maxX - minX),
            (VIEW_HEIGHT - MAP_PADDING * 2) / (maxY - minY)
        );
        const offsetX = (VIEW_WIDTH - (maxX - minX) * scale) / 2;
        const offsetY = (VIEW_HEIGHT - (maxY - minY) * scale) / 2;

        return (lon, lat) => {
            const point = projectCoordinate(lon, lat);
            return {
                x: offsetX + (point.x - minX) * scale,
                y: offsetY + (point.y - minY) * scale
            };
        };
    }

    function createSvgElement(name) {
        return document.createElementNS("http://www.w3.org/2000/svg", name);
    }

    function getPointerPosition(event) {
        const bounds = svg.getBoundingClientRect();
        return {
            x: (event.clientX - bounds.left) / bounds.width * VIEW_WIDTH,
            y: (event.clientY - bounds.top) / bounds.height * VIEW_HEIGHT
        };
    }

    function getPinchData() {
        const pointers = [...activePointers.values()];
        const deltaX = pointers[1].x - pointers[0].x;
        const deltaY = pointers[1].y - pointers[0].y;
        return {
            center: {
                x: (pointers[0].x + pointers[1].x) / 2,
                y: (pointers[0].y + pointers[1].y) / 2
            },
            distance: Math.hypot(deltaX, deltaY)
        };
    }

    function beginPinch() {
        const pinch = getPinchData();
        pinchStart = {
            distance: Math.max(1, pinch.distance),
            scale: transform.scale,
            mapX: (pinch.center.x - transform.x) / transform.scale,
            mapY: (pinch.center.y - transform.y) / transform.scale
        };
        dragStart = null;
    }

    function applyTransform() {
        mapLayer.setAttribute(
            "transform",
            `translate(${transform.x} ${transform.y}) scale(${transform.scale})`
        );
        mapLayer.querySelectorAll(".map-capital").forEach(capital => {
            capital.setAttribute("r", String(CAPITAL_RADIUS / transform.scale));
        });
        mapLayer.querySelectorAll(".map-station-marker").forEach(marker => {
            marker.setAttribute("r", String(POINT_RADIUS / transform.scale));
        });
    }

    function appendStationMarker(station, className, radius) {
        if (!station || !Number.isFinite(station.lon) || !Number.isFinite(station.lat)) return;
        const point = project(station.lon, station.lat);
        const marker = createSvgElement("circle");
        marker.classList.add("map-station-marker", className);
        marker.dataset.radius = String(radius);
        marker.setAttribute("cx", String(point.x));
        marker.setAttribute("cy", String(point.y));
        marker.setAttribute("r", String(POINT_RADIUS / transform.scale));
        const title = createSvgElement("title");
        title.textContent = station.name;
        marker.appendChild(title);
        stationLayer.appendChild(marker);
    }

    function renderReachableStations() {
        const selectedStationId = Number(section1id);
        if (selectedStationId === renderedStationId) return;
        renderedStationId = selectedStationId;
        stationLayer.replaceChildren();

        const selectedStation = timetable.stations[selectedStationId];
        const summary = document.querySelector("#_mapstationsummary");
        if (!selectedStation) {
            summary.textContent = "V kartě Stanice zatím není vybraná stanice";
            return;
        }

        const reachableStationIds = new Set();
        timetable.lines.forEach(line => {
            if (!line.stops.some(stop => stop.sid === selectedStationId)) return;
            line.stops.forEach(stop => {
                if (stop.sid !== selectedStationId) reachableStationIds.add(stop.sid);
            });
        });

        reachableStationIds.forEach(stationId => {
            appendStationMarker(timetable.stations[stationId], "map-reachable-station", 2.5);
        });
        appendStationMarker(selectedStation, "map-selected-station", 5);
        summary.textContent = selectedStation.name
            + " · " + reachableStationIds.size + " stanic přímým vlakem";
    }

    function resetView() {
        transform = { x: 0, y: 0, scale: 1 };
        applyTransform();
    }

    function showDistrict(district) {
        selectedDistrict = district;
        document.querySelector("#_mapdistrictname").textContent = district.name;
        document.querySelector("#_mapdistrictdetails").textContent
            = `${district.borderVertices.length} vrcholů · hlavní město `
            + `${district.capital.lat.toFixed(4)}, ${district.capital.lon.toFixed(4)}`;
        document.querySelectorAll(".map-district").forEach(element => {
            element.classList.toggle("selected", element.dataset.name === district.name);
        });
        document.querySelectorAll(".map-capital").forEach(element => {
            element.classList.toggle("selected", element.dataset.name === district.name);
        });
    }

    function mapClick() {
        console.log("clicked on a map");
    }

    function initialize() {
        project = getProjection();
        svg = document.querySelector("#_districtmap");
        mapLayer = document.querySelector("#_districtmaplayer");

        mapLayer.onclick = () => mapClick();

        districtBorders.forEach(district => {
            const points = district.borderVertices.map(([lon, lat]) => project(lon, lat));
            const polygon = createSvgElement("polygon");
            polygon.classList.add("map-district");
            polygon.dataset.name = district.name;
            polygon.setAttribute("points", points.map(point => `${point.x},${point.y}`).join(" "));
            polygon.setAttribute("aria-label", district.name);
            polygon.onclick = () => showDistrict(district);
            polygon.onmouseenter = () => showDistrict(district);
            mapLayer.appendChild(polygon);
        });

        districtBorders.forEach(district => {
            const capital = project(district.capital.lon, district.capital.lat);
            const circle = createSvgElement("circle");
            circle.classList.add("map-capital");
            circle.dataset.name = district.name;
            circle.setAttribute("cx", String(capital.x));
            circle.setAttribute("cy", String(capital.y));
            circle.setAttribute("r", CAPITAL_RADIUS);
            mapLayer.appendChild(circle);
        });

        stationLayer = createSvgElement("g");
        stationLayer.classList.add("map-station-layer");
        mapLayer.appendChild(stationLayer);

        svg.addEventListener("wheel", event => {
            event.preventDefault();
            const pointer = getPointerPosition(event);
            const nextScale = Math.min(
                MAX_SCALE,
                Math.max(MIN_SCALE, transform.scale * Math.exp(-event.deltaY * 0.0015))
            );
            const ratio = nextScale / transform.scale;
            transform.x = pointer.x - (pointer.x - transform.x) * ratio;
            transform.y = pointer.y - (pointer.y - transform.y) * ratio;
            transform.scale = nextScale;
            applyTransform();
        }, { passive: false });

        svg.addEventListener("pointerdown", event => {
            console.log(event.x, event.y);
            console.log(mapLayer);
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (activePointers.size >= 2) return;

            const pointer = getPointerPosition(event);
            activePointers.set(event.pointerId, pointer);
            svg.setPointerCapture(event.pointerId);
            svg.classList.add("dragging");

            if (activePointers.size === 2) {
                beginPinch();
                return;
            }

            dragStart = {
                pointer,
                x: transform.x,
                y: transform.y
            };
        });
        svg.addEventListener("pointermove", event => {
            if (!activePointers.has(event.pointerId)) return;

            const pointer = getPointerPosition(event);
            activePointers.set(event.pointerId, pointer);

            if (activePointers.size === 2 && pinchStart !== null) {
                const pinch = getPinchData();
                const nextScale = Math.min(
                    MAX_SCALE,
                    Math.max(MIN_SCALE, pinchStart.scale * pinch.distance / pinchStart.distance)
                );
                transform.x = pinch.center.x - pinchStart.mapX * nextScale;
                transform.y = pinch.center.y - pinchStart.mapY * nextScale;
                transform.scale = nextScale;
                applyTransform();
                return;
            }

            if (dragStart === null) return;
            transform.x = dragStart.x + pointer.x - dragStart.pointer.x;
            transform.y = dragStart.y + pointer.y - dragStart.pointer.y;
            applyTransform();
        });
        const stopDragging = event => {
            const wasPinching = pinchStart !== null;
            activePointers.delete(event.pointerId);
            dragStart = null;
            pinchStart = null;
            if (activePointers.size === 0 || wasPinching) svg.classList.remove("dragging");
            if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        };
        svg.addEventListener("pointerup", stopDragging);
        svg.addEventListener("pointercancel", stopDragging);
        document.querySelector("#_mapreset").onclick = resetView;
        initialized = true;
    }

    function render() {
        if (!initialized) initialize();
        renderReachableStations();
        if (selectedDistrict === null && districtBorders.length > 0) {
            showDistrict(districtBorders[0]);
        }
    }

    return { render };
})();
