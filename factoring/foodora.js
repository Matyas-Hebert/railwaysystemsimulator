const foodora = (() => {
    const INITIAL_SLOT_COUNT = 5;
    const SLOT_PRICE_MULTIPLIER = 100;
    const CANCELLATION_COST = 200;
    const ORDER_STATE = Object.freeze({ WAITING: 0, IN_TRANSIT: 1, DELIVERED: 2 });

    function initialize() {
        const orders = gameState.getDeliveryOrders();
        let changed = false;
        orders.forEach((order, index) => {
            if (!order.id) {
                order.id = "order-" + String(Date.now()) + "-" + String(index) + "-" + Math.random().toString(16).slice(2);
                changed = true;
            }
        });
        if (orders.length < INITIAL_SLOT_COUNT) {
            orders.push(...generateOrders(INITIAL_SLOT_COUNT - orders.length));
            changed = true;
        }
        if (changed) gameState.setDeliveryOrders(orders);
    }

    function coordinates(lonlat) {
        return {
            lon: parseFloat(lonlat.substring(0, 6) / 10000),
            lat: parseFloat(lonlat.substring(6, 12) / 10000)
        };
    }

    function distance(lat1, lon1, lat2, lon2) {
        const radius = 6371;
        const latitudeDifference = (lat2 - lat1) * Math.PI / 180;
        const longitudeDifference = (lon2 - lon1) * Math.PI / 180;
        const value = Math.sin(latitudeDifference / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(longitudeDifference / 2) ** 2;
        return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    }

    function generateOrders(amount) {
        const orders = [];
        for (let i = 0; i < amount; i++) {
            let nearest = null;
            let nearestDistance = Infinity;
            const start = timetable.stations[Math.floor(Math.random() * timetable.stations.length)];
            const startCoordinates = coordinates(start.lonlat);
            for (let candidate = 0; candidate < 5; candidate++) {
                const end = timetable.stations[Math.floor(Math.random() * timetable.stations.length)];
                if (end.id === start.id) continue;
                const endCoordinates = coordinates(end.lonlat);
                const candidateDistance = distance(startCoordinates.lon, startCoordinates.lat, endCoordinates.lon, endCoordinates.lat);
                if (candidateDistance < nearestDistance) {
                    nearestDistance = candidateDistance;
                    nearest = {
                        id: "order-" + String(Date.now()) + "-" + String(i) + "-" + Math.random().toString(16).slice(2),
                        dist: candidateDistance,
                        start,
                        end,
                        reward: (Math.random() + 9.5) * candidateDistance + 100,
                        state: ORDER_STATE.WAITING
                    };
                }
            }
            if (nearest) orders.push(nearest);
        }
        return orders;
    }

    function updateOrder(orderId, changes) {
        gameState.setDeliveryOrders(gameState.getDeliveryOrders().map(order =>
            order.id === orderId ? { ...order, ...changes } : order
        ));
    }

    function removeOrder(orderId) {
        gameState.setDeliveryOrders(gameState.getDeliveryOrders().filter(order => order.id !== orderId));
        gameState.setPinnedDeliveryIds(gameState.getPinnedDeliveryIds().filter(id => id !== orderId));
    }

    function addOrders(amount) {
        gameState.setDeliveryOrders([...gameState.getDeliveryOrders(), ...generateOrders(amount)]);
    }

    function togglePinned(orderId) {
        const pinned = gameState.getPinnedDeliveryIds();
        gameState.setPinnedDeliveryIds(
            pinned.includes(orderId) ? pinned.filter(id => id !== orderId) : [...pinned, orderId]
        );
        render();
    }

    function showRoute(destinationId) {
        const position = gameState.getCurrentPosition();
        if (position === null) return;
        idos.setLocation(0, position.statID);
        idos.setLocation(1, destinationId);
        changeCurrentSection(4);
    }

    function render() {
        const container = document.querySelector("#_section6");
        container.innerHTML = "";
        const orders = gameState.getDeliveryOrders();
        const pinned = gameState.getPinnedDeliveryIds();
        const position = gameState.getCurrentPosition();
        const sorted = [...orders].sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)));

        sorted.forEach(order => {
            const card = document.createElement("div");
            card.className = pinned.includes(order.id) ? "foodora pinned-order" : "foodora";
            card.innerHTML = '<div class="delivery-pin-row"><button class="delivery-pin-button">📌</button></div>'
                + '<div><div>Z</div><div>' + settings.getStationNameMarkup(order.start) + " (" + order.start.district + ")</div><div></div></div>"
                + '<div><div>DO</div><div>' + settings.getStationNameMarkup(order.end) + " (" + order.end.district + ")</div><div></div></div>"
                + '<div><div>ODMĚNA</div><div>' + String(Math.round(order.reward)) + ',-</div><button class="delivery-state"></button></div>'
                + '<div class="options"><button class="cancel">ZRUŠIT<br>200,-</button><button class="route-start">NAJÍT TRASU<br>NA START</button><button class="route-end">NAJÍT TRASU<br>NA KONEC</button></div>';

            card.querySelector(".delivery-pin-button").onclick = () => togglePinned(order.id);
            const action = card.querySelector(".delivery-state");
            const atStation = position?.transporttype === TRANSPORT_TYPE.STATION;

            if (order.state === ORDER_STATE.WAITING) {
                action.innerText = atStation && position.statID === order.start.id ? "VYZVEDNOUT" : "ČEKÁ";
                action.className = atStation && position.statID === order.start.id ? "delivery-state warning" : "delivery-state danger";
                if (atStation && position.statID === order.start.id) action.onclick = () => { updateOrder(order.id, { state: ORDER_STATE.IN_TRANSIT }); render(); };
            }
            if (order.state === ORDER_STATE.IN_TRANSIT) {
                action.innerText = atStation && position.statID === order.end.id ? "DORUČIT" : "NA CESTĚ";
                action.className = atStation && position.statID === order.end.id ? "delivery-state success" : "delivery-state warning";
                if (atStation && position.statID === order.end.id) action.onclick = () => { updateOrder(order.id, { state: ORDER_STATE.DELIVERED }); render(); };
            }
            if (order.state === ORDER_STATE.DELIVERED) {
                action.innerText = "VYBRAT " + String(Math.round(order.reward)) + ",-";
                action.className = "delivery-state success";
                action.onclick = () => {
                    gameState.setMoney(gameState.getMoney() + order.reward);
                    removeOrder(order.id);
                    addOrders(1);
                    settings.render();
                    render();
                };
            }

            card.querySelector(".cancel").onclick = () => {
                if (gameState.getMoney() < CANCELLATION_COST) return;
                gameState.setMoney(gameState.getMoney() - CANCELLATION_COST);
                removeOrder(order.id);
                addOrders(1);
                settings.render();
                render();
            };
            card.querySelector(".route-start").onclick = () => showRoute(order.start.id);
            card.querySelector(".route-end").onclick = () => showRoute(order.end.id);
            container.appendChild(card);
        });

        const cost = orders.length * SLOT_PRICE_MULTIPLIER;
        const slot = document.createElement("div");
        slot.className = "foodora unlock-slot-card";
        slot.innerHTML = '<div class="unlock-slot-header">NOVÝ SLOT</div><div class="unlock-slot-body">Koupí slotu získáš další místo pro doručení.</div><button class="unlock-slot-action"></button>';
        const action = slot.querySelector(".unlock-slot-action");
        action.innerText = gameState.getMoney() >= cost ? "KOUPIT ZA " + String(cost) + ",-" : "NEDOSTATEK (" + String(cost) + ",-)";
        action.className = gameState.getMoney() >= cost ? "unlock-slot-action success" : "unlock-slot-action danger";
        action.onclick = () => {
            if (gameState.getMoney() < cost) return;
            gameState.setMoney(gameState.getMoney() - cost);
            addOrders(1);
            settings.render();
            render();
        };
        container.appendChild(slot);
    }

    function reset() {
        gameState.setDeliveryOrders([]);
        gameState.setPinnedDeliveryIds([]);
        addOrders(INITIAL_SLOT_COUNT);
    }

    return { initialize, render, reset };
})();
