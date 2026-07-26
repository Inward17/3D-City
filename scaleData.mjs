import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
    path.join(__dirname, 'src', 'data', 'cityPlanningData.ts'),
    path.join(__dirname, 'src', 'data', 'corporateCampusData.ts')
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    // replace position: [x, y, z] by multiplying by 10
    content = content.replace(/position:\s*\[([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)\]/g, (match, p1, p2, p3) => {
        return `position: [${parseFloat(p1) * 10}, ${parseFloat(p2) * 10}, ${parseFloat(p3) * 10}]`;
    });
    // replace distance: value
    content = content.replace(/distance:\s*([\d.-]+)/g, (match, p1) => {
        return `distance: ${parseFloat(p1) * 10}`;
    });
    fs.writeFileSync(file, content);
    console.log('Scaled ' + file);
}
