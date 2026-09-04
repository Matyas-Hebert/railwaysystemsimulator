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
                let buyFunction1 = function(){
                    let uses = gameState.getUsesRemaining();
                    uses[company] += 1;
                    gameState.buyWithMoney(seed);
                    gameState.setUsesRemaining(uses);
                    gameState.setSelectedOperator(company+1);
                }
                let buyFunction3 = function(){
                    let uses = gameState.getUsesRemaining();
                    uses[company] += 3;
                    gameState.buyWithMoney(Math.round(seed*2.5));
                    gameState.setUsesRemaining(uses);
                    gameState.setSelectedOperator(company+1);
                }
                addShopItem(container, config.dataOperators[company].name, "DATA x1", "Koupit "+seed+",-", buyFunction1);
                addShopItem(container, config.dataOperators[company].name, "DATA x3", "Koupit "+Math.round(seed*2.5)+",-", buyFunction3);
            }
        });
    }
}