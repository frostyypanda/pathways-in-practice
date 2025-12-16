/**
 * SMILES Validation Script
 *
 * Validates SMILES strings from the synthesis_steps table using the custom
 * smiles-drawer fork (with abbreviation support).
 *
 * Usage:
 *   cd scripts/smiles-validation
 *   npm install
 *   node validate-smiles.js
 *   node validate-smiles.js --dry-run    # Just count rows, don't validate
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../smiles-extractor/.env') });

// Configuration
const BATCH_SIZE = 500;
const SMILES_FIELDS = [
    'corrected_reactant_smiles',
    'corrected_reagent_smiles',
    'corrected_product_smiles'
];

/**
 * Load the custom smiles-drawer fork in a browser-like context
 */
function loadSmilesDrawer() {
    const smilesDrawerPath = path.join(__dirname, '../../public/smiles-drawer.min.js');
    const code = fs.readFileSync(smilesDrawerPath, 'utf8');

    // Create a browser-like global context
    const context = {
        window: {},
        document: {
            createElement: () => ({
                getContext: () => null
            })
        },
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
    };

    // Make window reference itself
    context.window = context;
    context.self = context;
    context.global = context;

    vm.createContext(context);
    vm.runInContext(code, context);

    if (!context.SmilesDrawer) {
        throw new Error('Failed to load SmilesDrawer from custom fork');
    }

    return context.SmilesDrawer;
}

/**
 * Validate a single SMILES string
 * @param {object} SmilesDrawer - The SmilesDrawer module
 * @param {string} smiles - SMILES string to validate
 * @returns {Promise<{valid: boolean, error?: string, empty?: boolean}>}
 */
function validateSmiles(SmilesDrawer, smiles) {
    return new Promise((resolve) => {
        // Empty or null SMILES are not errors
        if (!smiles || smiles.trim() === '') {
            resolve({ valid: true, empty: true });
            return;
        }

        try {
            SmilesDrawer.parse(smiles,
                (tree) => resolve({ valid: true }),
                (err) => resolve({
                    valid: false,
                    error: err.message || err.toString() || 'Unknown parse error'
                })
            );
        } catch (err) {
            resolve({
                valid: false,
                error: err.message || err.toString() || 'Unknown error'
            });
        }
    });
}

/**
 * Get database connection pool
 */
function getPool() {
    return new Pool({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: {
            rejectUnauthorized: false
        }
    });
}

/**
 * Main validation function
 */
async function main() {
    const isDryRun = process.argv.includes('--dry-run');

    console.log('='.repeat(60));
    console.log('SMILES Validation Script');
    console.log('='.repeat(60));

    // Load smiles-drawer
    console.log('\nLoading custom smiles-drawer fork...');
    let SmilesDrawer;
    try {
        SmilesDrawer = loadSmilesDrawer();
        console.log('  OK: SmilesDrawer loaded successfully');
    } catch (err) {
        console.error('  FAILED:', err.message);
        process.exit(1);
    }

    // Connect to database
    console.log('\nConnecting to database...');
    const pool = getPool();
    let client;

    try {
        client = await pool.connect();
        console.log('  OK: Connected to', process.env.DB_HOST);
    } catch (err) {
        console.error('  FAILED:', err.message);
        process.exit(1);
    }

    try {
        // Count total rows
        const countResult = await client.query('SELECT COUNT(*) FROM synthesis_steps');
        const totalRows = parseInt(countResult.rows[0].count);
        console.log(`\nTotal rows in synthesis_steps: ${totalRows}`);

        if (isDryRun) {
            console.log('\n--dry-run mode: Exiting without validation');
            return;
        }

        // Validate in batches
        const brokenSmiles = [];
        let processed = 0;
        let validCount = 0;
        let emptyCount = 0;

        console.log(`\nValidating SMILES in batches of ${BATCH_SIZE}...`);
        console.log('Fields:', SMILES_FIELDS.join(', '));
        console.log('-'.repeat(60));

        while (processed < totalRows) {
            const result = await client.query(`
                SELECT ss.id, ss.synthesis_id, ss.image_filename,
                       ss.corrected_reactant_smiles,
                       ss.corrected_reagent_smiles,
                       ss.corrected_product_smiles,
                       s.name as synthesis_name
                FROM synthesis_steps ss
                JOIN synthesis s ON s.id = ss.synthesis_id
                ORDER BY ss.id
                LIMIT $1 OFFSET $2
            `, [BATCH_SIZE, processed]);

            for (const row of result.rows) {
                for (const field of SMILES_FIELDS) {
                    const smiles = row[field];
                    const validation = await validateSmiles(SmilesDrawer, smiles);

                    if (validation.empty) {
                        emptyCount++;
                    } else if (validation.valid) {
                        validCount++;
                    } else {
                        brokenSmiles.push({
                            step_id: row.id,
                            synthesis_id: row.synthesis_id,
                            synthesis_name: row.synthesis_name,
                            image_filename: row.image_filename,
                            field: field,
                            broken_value: smiles,
                            error_message: validation.error
                        });
                    }
                }
            }

            processed += result.rows.length;
            const pct = ((processed / totalRows) * 100).toFixed(1);
            process.stdout.write(`\rProgress: ${processed}/${totalRows} (${pct}%) | Broken: ${brokenSmiles.length}`);
        }

        console.log('\n' + '-'.repeat(60));

        // Summary
        const totalChecked = validCount + emptyCount + brokenSmiles.length;
        console.log('\nValidation Summary:');
        console.log(`  Total rows:     ${totalRows}`);
        console.log(`  Fields checked: ${totalChecked} (${SMILES_FIELDS.length} per row)`);
        console.log(`  Valid SMILES:   ${validCount}`);
        console.log(`  Empty/null:     ${emptyCount}`);
        console.log(`  Broken SMILES:  ${brokenSmiles.length}`);

        if (brokenSmiles.length > 0) {
            // Save to JSON file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const outputPath = path.join(__dirname, 'output', `broken_smiles_${timestamp}.json`);

            const output = {
                validation_run: {
                    timestamp: new Date().toISOString(),
                    total_rows: totalRows,
                    total_fields_checked: totalChecked,
                    valid_count: validCount,
                    empty_count: emptyCount,
                    broken_count: brokenSmiles.length
                },
                broken_smiles: brokenSmiles
            };

            fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
            console.log(`\nBroken SMILES saved to:\n  ${outputPath}`);

            // Show first few examples
            console.log('\nFirst 5 broken SMILES:');
            brokenSmiles.slice(0, 5).forEach((item, i) => {
                console.log(`\n  ${i + 1}. [step_id: ${item.step_id}] ${item.field}`);
                console.log(`     Synthesis: ${item.synthesis_name}`);
                console.log(`     Value: ${item.broken_value?.substring(0, 60)}${item.broken_value?.length > 60 ? '...' : ''}`);
                console.log(`     Error: ${item.error_message}`);
            });
        } else {
            console.log('\nAll SMILES validated successfully!');
        }

    } finally {
        client.release();
        await pool.end();
    }

    console.log('\n' + '='.repeat(60));
    console.log('Done');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
