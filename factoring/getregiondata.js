const query = `[out:json][timeout:30];
area["name:en"="Czech Republic"];
node(area)["place"~"city|town"];
out body;`;

const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
const response = await fetch(url);

// Tady si přidej tuhle kontrolu, ať vidíš chybu, pokud to zase bouchne
if (!response.ok) {
    const errorText = await response.text();
    console.error("Overpass Error:", errorText);
} else {
    const data = await response.json();
    console.log(`Získáno ${data.elements.length} prvků.`);
    console.log(JSON.stringify(data.elements, null, '\t'));
}