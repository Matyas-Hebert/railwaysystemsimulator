import * as runtime from "./runtime.js";
import * as constants from "./constants.js"
import * as config from "../generated/config.js";

function addShopItem(shopList, shopTitle, shopSubtitle, shopBuySubtitle, shopBuyFunction){
    const card = document.createElement("div");
    card.className = "shop-item";

    const title = document.createElement("div");
    title.className = "shop-title";
    title.innerHTML = shopTitle;

    const subtitle = document.createElement("div");
    subtitle.innerHTML = shopSubtitle;
    subtitle.className = "shop-subtitle";

    const buyBtn = document.createElement("div");
    buyBtn.innerHTML = shopBuySubtitle;
    buyBtn.onclick = shopBuyFunction
    buyBtn.className = "shop-buy-btn";

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(buyBtn);
    shopList.appendChild(card);
}

function getDataUsePrice(seed, currentUses){
    return currentUses >= 5 ? Math.round(seed*Math.pow(1.2, currentUses-4)) : Math.round(seed);
}

export function render(){
    let gameState = runtime.getGameState();
    let position = gameState.getCurrentPosition();
    const container = document.querySelector("#_shopList");
    container.innerHTML = "";

    if (position.transporttype == constants.TRANSPORT_TYPE.STATION){
        let statID = position.statID;
        console.log(gameState.getStationShops(statID));
        gameState.getStationShops(statID).forEach(shop => {
            console.log(shop);
            let shopType = shop[0];
            let company = shop[1];
            let seed = Math.round(shop[2]);

            if (shopType == constants.SHOP_TYPE.DATA_SHOP){
                gameState = runtime.getGameState();
                let currentAmountOfUses = gameState.getUsesRemaining()[company];
                console.log("caou:", currentAmountOfUses);
                let singlePrice = Math.round(getDataUsePrice(seed, currentAmountOfUses));
                let triplePrice = Math.round((getDataUsePrice(seed, currentAmountOfUses)+getDataUsePrice(seed, currentAmountOfUses+1)+getDataUsePrice(seed, currentAmountOfUses+2))*0.8);

                let buyFunction1 = function(){
                    if (gameState.getMoney() >= singlePrice){
                        let uses = gameState.getUsesRemaining();
                        uses[company] += 1;
                        gameState.buyWithMoney(singlePrice);
                        gameState.setUsesRemaining(uses);
                        gameState.setSelectedOperator(company+1);
                    }
                    render();
                }
                let buyFunction3 = function(){
                    if (gameState.getMoney() >= triplePrice){
                        let uses = gameState.getUsesRemaining();
                        uses[company] += 3;
                        gameState.buyWithMoney(triplePrice);
                        gameState.setUsesRemaining(uses);
                        gameState.setSelectedOperator(company+1);
                    }
                    render();
                }
                addShopItem(container, config.dataOperators[company].name, "DATA x1", "Koupit "+singlePrice+",-", buyFunction1);
                addShopItem(container, config.dataOperators[company].name, "DATA x3", "Koupit "+triplePrice+",-", buyFunction3);
            }
        });
    }
}