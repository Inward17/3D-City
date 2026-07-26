const fs = require('fs');
const files = ['src/data/cityPlanningData.ts', 'src/data/corporateCampusData.ts'];
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    // replace position: [x, y, z]
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
