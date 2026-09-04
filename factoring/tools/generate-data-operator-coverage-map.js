import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const DISTRICTS_PATH = path.join(ROOT, "generated", "district-borders.json");
const CONFIG_PATH = path.join(ROOT, "config", "data-operators.js");
const OUTPUT_PATH = path.join(ROOT, "reports", "data-operator-coverage.html");
function readOperatorConfig() {
    const context = {};
    const source = fs.readFileSync(CONFIG_PATH, "utf8")
        + "\nthis.dataOperatorConfig = dataOperatorConfig;";
    vm.runInNewContext(source, context, { filename: CONFIG_PATH });
    return context.dataOperatorConfig;
}

function validateCoverage(districts, operators) {
    const districtNames = new Set(districts.map(district => district.name));
    const unknown = [];
    const coverageCounts = new Map(
        districts.map(district => [district.name, 0])
    );

    for (const operator of operators) {
        for (const districtName of operator.districts) {
            if (!districtNames.has(districtName)) {
                unknown.push(operator.name + ": " + districtName);
                continue;
            }
            coverageCounts.set(
                districtName,
                coverageCounts.get(districtName) + 1
            );
        }
    }

    const uncovered = [...coverageCounts]
        .filter(([, count]) => count === 0)
        .map(([name]) => name);
    if (unknown.length > 0 || uncovered.length > 0) {
        throw new Error([
            unknown.length > 0 ? "Unknown districts: " + unknown.join(", ") : "",
            uncovered.length > 0 ? "Uncovered districts: " + uncovered.join(", ") : ""
        ].filter(Boolean).join("\n"));
    }


    return coverageCounts;
}

function getBounds(districts) {
    const points = districts.flatMap(district => district.borderVertices);
    return {
        minLon: Math.min(...points.map(point => point[0])),
        maxLon: Math.max(...points.map(point => point[0])),
        minLat: Math.min(...points.map(point => point[1])),
        maxLat: Math.max(...points.map(point => point[1]))
    };
}

function createMap(districts, operator, bounds) {
    const width = 760;
    const height = 470;
    const padding = 16;
    const lonSpan = bounds.maxLon - bounds.minLon;
    const latSpan = bounds.maxLat - bounds.minLat;
    const scale = Math.min(
        (width - 2 * padding) / lonSpan,
        (height - 2 * padding) / latSpan
    );
    const mapWidth = lonSpan * scale;
    const mapHeight = latSpan * scale;
    const offsetX = (width - mapWidth) / 2;
    const offsetY = (height - mapHeight) / 2;
    const covered = new Set(operator.districts);

    function project(point) {
        return [
            offsetX + (point[0] - bounds.minLon) * scale,
            offsetY + (bounds.maxLat - point[1]) * scale
        ];
    }

    const polygons = districts.map(district => {
        const points = district.borderVertices
            .map(point => project(point).map(value => value.toFixed(2)).join(","))
            .join(" ");
        const fill = covered.has(district.name)
            ? operator.color
            : "#d8d8d8";
        return '<polygon points="' + points + '" fill="' + fill
            + '" stroke="#ffffff" stroke-width="0.65">'
            + '<title>' + district.name + '</title></polygon>';
    }).join("\n");

    return '<svg viewBox="0 0 ' + width + ' ' + height
        + '" role="img" aria-label="Pokrytí operátora ' + operator.name + '">'
        + polygons + '</svg>';
}

function main() {
    const districts = JSON.parse(fs.readFileSync(DISTRICTS_PATH, "utf8"));
    const operators = readOperatorConfig();
    const coverageCounts = validateCoverage(districts, operators);
    const bounds = getBounds(districts);
    const cards = operators.map(operator => {
        const coveredCountries = { CZ: 0, SK: 0 };
        for (const district of districts) {
            if (operator.districts.includes(district.name)) {
                coveredCountries[district.country]++;
            }
        }
        return '<section><h2><span style="background:' + operator.color
            + '"></span>' + operator.name + '</h2>'
            + '<p>' + operator.districts.length + ' okresů — CZ '
            + coveredCountries.CZ + ', SK ' + coveredCountries.SK
            + ' — cenový násobek ' + operator.priceMultiplier + '</p>'
            + createMap(districts, operator, bounds) + '</section>';
    }).join("\n");

    const maximumCoverage = Math.max(...coverageCounts.values());
    const coverageSummary = Array.from(
        { length: maximumCoverage },
        (_, index) => {
            const count = [...coverageCounts.values()]
                .filter(value => value === index + 1).length;
            return (index + 1) + " operátorů: " + count + " okresů";
        }
    ).join(" · ");

    const html = '<!doctype html><html lang="cs"><head><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>Pokrytí datových operátorů</title><style>'
        + 'body{margin:0;padding:24px;background:#171b3f;color:#fff;'
        + 'font:16px Arial,sans-serif}h1{text-align:center;margin:0 0 8px}'
        + '.summary{text-align:center;margin:0 0 24px;color:#d7daf7}'
        + '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:20px}'
        + 'section{background:#252b68;border:1px solid #6269ad;padding:16px}'
        + 'h2{display:flex;align-items:center;gap:10px;margin:0 0 6px}'
        + 'h2 span{width:20px;height:20px;border:2px solid #fff}'
        + 'section p{margin:0 0 12px;color:#d7daf7}svg{display:block;width:100%;'
        + 'height:auto;background:#eef1e8}</style></head><body>'
        + '<h1>Pokrytí datových operátorů</h1><p class="summary">'
        + coverageSummary + '</p><main class="grid">' + cards
        + '</main></body></html>';

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, html);
    console.log("Coverage valid: all " + districts.length + " districts covered.");
    for (const operator of operators) {
        console.log(operator.name + ": " + operator.districts.length + " districts");
    }
    console.log("Map written to " + OUTPUT_PATH);
}

main();
