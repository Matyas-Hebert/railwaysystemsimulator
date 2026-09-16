# TODO

| Feature ID | Feature Name | Feature description | Prerequisities |
| -------- | ------- | ------- | ------- |
| 1 | Taxis | Option to call, ride and pay for a taxi from anywhere to anywhere | 1a, 1b |
| 1a | Taxi spots | assign taxi spots to some stations, closest taxi spot data for every station and create a function returning closest taxi spot to given o r current position | |
| 1b | Taxi pricing and wait times | given start and end of the taxi journey, return price of the taxi ride, wait time for the taxi along with the journey times | |
| 2 | Foodora system upgrade | each order would have assigned specific item with specific amount that needs to be delivered to destination, player would be able to pick up the amount of such item for free from factories producing such item | 3, 2a-c |
| 2a | Item types | create a new config file with different items, each would be given a specific id, name, weight, price and type (eg. food, electronics, ...). For each item a list of "lonlats" would be assigned. These would be stations where a factory producing such item will be located. Such stations will save this as a shop of type factory producing such item as well | |
| 2b | Change order generation | select random item based on its weight, then select random factory where its produced, then call the current logic for selecting the destination | 2a |
| 2c | Pricing, cancelling, delivering | Pricing should be adjusted not based on the distance but on a different metric that make sense (currently not clear), cancelling should have a different price based on whether the item was already picked up or not, if yes the price of cancel should be higher than the items price, delivery will be possible if a player is at correct location and have atleast amount of given items | 2b |
| 2d | Selling items at factory | Player should be able to sell items at their own factory for  part of their full price | 2a |
| 3 | Inventory | Simple inventory feature, a list of items, each item resembles one different item. It will be saved like this: [itemID, amount], along with this new module inventory would be required | 2a |
| 4 | Inventory display | A grid displaying all items along with their quantities in a new tab | 3, 4a |
| 4a | Item textures | Create a simple small texture for all existing items, wire the paths into the item config | 2a |
| 5 | Saved waypoint | In generation instead of ignoring save also the waypoints, it is currently unclear how but it is required that we will know in between which station does such waypoint belong to | |
| 6 | Current position fix | fix the current position function. When on a form transport the movement is not linear it starts slow and then picks up, return correct coordinates based on delay.placeProgress and saved waypoints | 6a |
| 6a | placeProgress | as mentioned in 6. Update getdelay function so it returns placeProgress along with current progress, this would resemble how far in between the two places the player currently is | 5 |
| 7 | item shop | based on the item type eg. (food, electronics...) create couple different shops for each along with their own price and item availability information | 2a |
| 8 | eating | in your inventory you can eat any item of your choice giving you specific energy back | 4, 8a |
| 8a | food energy | each food/edible item should be provided with its own energy, that is given back to the player when eaten | 2a |
| 8b | auto eat | put certain edible items in an auto eat container, when away player will automatically consume these items therefore can walk further without player attention, player want get 100% of the food energy when auto eating | 8 |
| 9 | player weight | each item will be given a weight, based on the total weight movement will cause more energy along with less energy restored when idle | 2a |
| 10 | cemeteries | places where a player respawns after possible death, for each the game would remember coordinates | |
| 10a | closest cemetery | return closest cemetery id to current player position | 10 |
| 11 | death screen | display a black screen along with the death reason and a countdown to respawn, player should be respawned at closest cemetery with clear inventory and no money with minimal energy | 10a |
| 12 | casino | self explanatory, generator will assign casinos to specific stations, casinos will be displayed in the Trh tab and would be able to lose all their money while waiting for their train | |
| 13 | currencies | support for crowns, zloty and euro, game should remember the amount in all three currencies and player should be able to switch between them similar to data switch menu | |
| 13a | payment in currencies | payment for anything should be based on a countries, crowns in CZ, euro in SK, AT and DE and zloty in PL, the prices should be automatically calculated based on conversion rate, player should not be able to pay with wrong currency | 13 |
| 13b | exchange shops | again generator will assign these to specific stations, along with this there will be multiple different companies offering different exchange rates, exchange shops are more common near borders or at stations with international services, exchange shops will also have minimal exchange amount | 13 |
| 14 | get out of train while travelling | option to leave the train while in between stations, depending on the speed and your current energy you will have different chances of surviving the disembarkment | 11 |
| 14a | get out of a plane while in air | will require parachute to survive, otherwise certain death, falling wont be instant and will take longer depending on the height | 14b, 14d |
| 14b | parachute item | purchasable parachute one use item | 2a |
| 14d | current height | function returning current height above ground when travelling by plane | |
