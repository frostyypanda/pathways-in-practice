const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load smiles-drawer
const code = fs.readFileSync(path.join(__dirname, '../../public/smiles-drawer.min.js'), 'utf8');
const ctx = { window: {}, document: { createElement: () => ({ getContext: () => null }) }, console, setTimeout, clearTimeout, setInterval, clearInterval };
ctx.window = ctx; ctx.self = ctx; ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);
const SD = ctx.SmilesDrawer;

// Simple sync validation
function isValid(smiles) {
    if (!smiles || !smiles.trim()) return true;
    let valid = false;
    try {
        SD.parse(smiles, () => { valid = true; }, () => {});
    } catch(e) {}
    return valid;
}

// Get all JSON files
const dir = path.join(__dirname, '../../public/data/imported');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let total = 0, broken = 0, synthCount = 0;
const fields = ['reactant_smiles', 'product_smiles', 'reagent_smiles'];

for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!data.sequence) continue;
    synthCount++;
    for (const step of data.sequence) {
        for (const f of fields) {
            const s = step[f];
            if (s && s.trim()) {
                total++;
                if (!isValid(s)) broken++;
            }
        }
    }
}

console.log('Syntheses:', synthCount);
console.log('Total SMILES:', total);
console.log('Broken:', broken);
console.log('Valid:', total - broken);
console.log('Error rate:', (broken/total*100).toFixed(2) + '%');
