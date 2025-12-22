const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../smiles-extractor/.env') });

// Load smiles-drawer
const smilesDrawerPath = path.join(__dirname, '../../public/smiles-drawer.min.js');
const code = fs.readFileSync(smilesDrawerPath, 'utf8');
const context = {
    window: {}, document: { createElement: () => ({ getContext: () => null }) },
    console, setTimeout, clearTimeout, setInterval, clearInterval
};
context.window = context; context.self = context; context.global = context;
vm.createContext(context);
vm.runInContext(code, context);
const SmilesDrawer = context.SmilesDrawer;

function validateSmiles(smiles) {
    return new Promise((resolve) => {
        if (!smiles || smiles.trim() === '') { resolve({ valid: true, empty: true }); return; }
        const timeout = setTimeout(() => resolve({ valid: false, error: 'timeout' }), 100);
        try {
            SmilesDrawer.parse(smiles,
                () => { clearTimeout(timeout); resolve({ valid: true }); },
                (err) => { clearTimeout(timeout); resolve({ valid: false, error: err?.message || 'parse error' }); }
            );
        } catch (err) {
            clearTimeout(timeout);
            resolve({ valid: false, error: err?.message || 'exception' });
        }
    });
}

async function main() {
    const pool = new Pool({
        host: process.env.DB_HOST, database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    console.log('Connected to DB, fetching all synthesis_steps...');
    const { rows } = await client.query('SELECT id, corrected_reactant_smiles, corrected_reagent_smiles, corrected_product_smiles FROM synthesis_steps');
    console.log(`Fetched ${rows.length} rows, validating...`);

    let broken = 0, total = 0, checked = 0;
    const fields = ['corrected_reactant_smiles', 'corrected_reagent_smiles', 'corrected_product_smiles'];

    for (const row of rows) {
        for (const field of fields) {
            const smiles = row[field];
            if (smiles && smiles.trim()) {
                total++;
                const result = await validateSmiles(smiles);
                if (!result.valid) broken++;
            }
        }
        checked++;
        if (checked % 5000 === 0) process.stdout.write(`${checked}/${rows.length} `);
    }

    console.log();
    console.log('='.repeat(50));
    console.log('Total SMILES checked:', total);
    console.log('Broken SMILES:', broken);
    console.log('Valid SMILES:', total - broken);
    console.log('Error rate:', (broken / total * 100).toFixed(2) + '%');
    console.log('='.repeat(50));

    client.release();
    await pool.end();
}

main().catch(console.error);
