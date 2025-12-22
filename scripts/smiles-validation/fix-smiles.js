/**
 * SMILES Fix Script
 *
 * Reads broken SMILES from validation output, applies safe regex fixes,
 * validates the results, and updates the database.
 *
 * Usage:
 *   node fix-smiles.js                              # Use latest broken_smiles file
 *   node fix-smiles.js broken_smiles_2025-12-17.json  # Use specific file
 *   node fix-smiles.js --dry-run                    # Preview fixes, no DB update
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../smiles-extractor/.env') });

/**
 * Safe regex replacements - order matters!
 *
 * Rules:
 * 1. Remove ALL explicit H outside brackets (renderer handles implicit H)
 * 2. Remove spaces in SMILES
 * 3. Wrap any non-element abbreviation in brackets (anything not B,C,N,O,P,S,F,I,Cl,Br)
 * 4. [nBu] → CCCC (only nBu, because 'n' is aromatic nitrogen indicator)
 */
const REPLACEMENTS = [
    // === SPACES ===
    {
        name: 'Remove spaces',
        pattern: / +/g,
        replacement: ''
    },

    // === LEADING H REMOVAL ===
    // HO..., HC..., HN... at start of SMILES
    {
        name: 'Leading H → remove',
        pattern: /^H(?=[A-Z])/g,
        replacement: ''
    },

    // === HYPHEN REMOVAL IN ABBREVIATIONS ===
    // [o-Ns] → [oNs], [t-Bu] → [tBu], [i-Pr] → [iPr], etc.
    {
        name: '[x-Y] → [xY] (remove hyphen)',
        pattern: /\[([a-z])-([A-Za-z0-9]+)\]/g,
        replacement: '[$1$2]'
    },

    // === [nBu] EXPANSION (only nBu because 'n' is aromatic) ===
    {
        name: '[nBu] → CCCC',
        pattern: /\[nBu\]/g,
        replacement: 'CCCC'
    },

    // === HYDROGEN REMOVAL ===
    // Terminal alkyne protection first: C#CH → C#C[H]
    {
        name: 'Terminal alkyne C#CH → C#C[H]',
        pattern: /C#CH(?![a-z])/g,
        replacement: 'C#C[H]'
    },

    // Remove )H (H after closing paren, not in brackets)
    {
        name: ')H → )',
        pattern: /\)H(?![a-z])/g,
        replacement: ')'
    },

    // Remove ]H (H after closing bracket)
    {
        name: ']H → ]',
        pattern: /\]H(?![a-z])/g,
        replacement: ']'
    },

    // Remove (H) explicit hydrogen
    {
        name: '(H) → remove',
        pattern: /\(H\)/g,
        replacement: ''
    },

    // Remove H after ring number: N2H → N2, C1H → C1
    {
        name: 'XnH → Xn (H after ring number)',
        pattern: /([A-Z])(\d)H(?![a-z])/g,
        replacement: '$1$2'
    },

    // === ABBREVIATION WRAPPING ===
    // Wrap O + abbreviation as unit: OMe → [OMe], OAc → [OAc], OBz → [OBz], etc.
    // Match O followed by capital + lowercase(s), NOT already in brackets, NOT Cl/Br
    {
        name: 'O+Abbrev → [OAbbrev]',
        pattern: /(?<!\[)O([A-Z][a-z]+)(?!\])/g,
        replacement: (match, abbrev) => {
            // Don't wrap if it's a valid element
            if (['Cl', 'Br'].includes(abbrev)) return match;
            return '[O' + abbrev + ']';
        }
    },

    // Wrap standalone abbreviations: Ts → [Ts], Bn → [Bn], Ph → [Ph], etc.
    // Match capital + lowercase(s), NOT preceded by O or [, NOT already in brackets
    {
        name: 'Abbrev → [Abbrev]',
        pattern: /(?<!\[|O)([A-Z][a-z]+)(?!\])/g,
        replacement: (match, abbrev) => {
            // Don't wrap valid elements
            if (['Cl', 'Br'].includes(abbrev)) return match;
            return '[' + abbrev + ']';
        }
    },

    // === ELEMENT BRACKET FIXES ===
    // K and V need brackets (not in organic subset)
    {
        name: 'K → [K]',
        pattern: /(?<!\[)K(?!\]|[a-z])/g,
        replacement: '[K]'
    },
    {
        name: 'V → [V]',
        pattern: /(?<!\[)V(?!\]|[a-z])/g,
        replacement: '[V]'
    },

    // === TYPO FIXES ===
    {
        name: '} → ]',
        pattern: /\}/g,
        replacement: ']'
    }
];

/**
 * Load the custom smiles-drawer fork in a browser-like context
 */
function loadSmilesDrawer() {
    const smilesDrawerPath = path.join(__dirname, '../../public/smiles-drawer.min.js');
    const code = fs.readFileSync(smilesDrawerPath, 'utf8');

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
 */
function validateSmiles(SmilesDrawer, smiles) {
    return new Promise((resolve) => {
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
 * Apply all regex replacements to a SMILES string
 * Returns { fixed: string, appliedFixes: string[] }
 */
function applyFixes(smiles) {
    let result = smiles;
    const appliedFixes = [];

    for (const rule of REPLACEMENTS) {
        const before = result;
        result = result.replace(rule.pattern, rule.replacement);
        if (result !== before) {
            appliedFixes.push(rule.name);
        }
    }

    return { fixed: result, appliedFixes };
}

/**
 * Get latest broken_smiles file from output directory
 */
function getLatestBrokenSmilesFile() {
    const outputDir = path.join(__dirname, 'output');
    const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('broken_smiles_') && f.endsWith('.json'))
        .sort()
        .reverse();

    if (files.length === 0) {
        throw new Error('No broken_smiles files found in output directory');
    }

    return path.join(outputDir, files[0]);
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
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const inputFile = args.find(a => !a.startsWith('--'));

    console.log('='.repeat(60));
    console.log('SMILES Fix Script');
    console.log('='.repeat(60));

    if (isDryRun) {
        console.log('\n⚠️  DRY RUN MODE - No database updates will be made\n');
    }

    // Load broken SMILES file
    let brokenSmilesPath;
    if (inputFile) {
        brokenSmilesPath = path.join(__dirname, 'output', inputFile);
        if (!fs.existsSync(brokenSmilesPath)) {
            brokenSmilesPath = inputFile; // Try as absolute path
        }
    } else {
        brokenSmilesPath = getLatestBrokenSmilesFile();
    }

    console.log(`\nLoading: ${brokenSmilesPath}`);
    const brokenData = JSON.parse(fs.readFileSync(brokenSmilesPath, 'utf8'));
    console.log(`  Found ${brokenData.broken_smiles.length} broken SMILES entries`);

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

    // Process each broken SMILES
    const results = {
        fixed: [],
        stillBroken: [],
        noChange: [],
        fixCounts: {}
    };

    console.log('\nProcessing broken SMILES...');
    console.log('-'.repeat(60));

    for (let i = 0; i < brokenData.broken_smiles.length; i++) {
        const entry = brokenData.broken_smiles[i];
        const original = entry.broken_value;

        // Apply fixes
        const { fixed, appliedFixes } = applyFixes(original);

        // Validate the fixed version
        const validation = await validateSmiles(SmilesDrawer, fixed);

        if (appliedFixes.length === 0) {
            // No patterns matched
            results.noChange.push({
                ...entry,
                reason: 'No fixable patterns found'
            });
        } else if (validation.valid) {
            // Fixed successfully!
            results.fixed.push({
                ...entry,
                original_value: original,
                fixed_value: fixed,
                applied_fixes: appliedFixes
            });

            // Count which fixes were applied
            for (const fix of appliedFixes) {
                results.fixCounts[fix] = (results.fixCounts[fix] || 0) + 1;
            }
        } else {
            // Fixes applied but still broken
            results.stillBroken.push({
                ...entry,
                original_value: original,
                attempted_fix: fixed,
                applied_fixes: appliedFixes,
                remaining_error: validation.error
            });
        }

        // Progress
        if ((i + 1) % 100 === 0 || i === brokenData.broken_smiles.length - 1) {
            process.stdout.write(`\rProgress: ${i + 1}/${brokenData.broken_smiles.length} | Fixed: ${results.fixed.length} | Still broken: ${results.stillBroken.length + results.noChange.length}`);
        }
    }

    console.log('\n' + '-'.repeat(60));

    // Summary
    console.log('\nResults Summary:');
    console.log(`  Total processed:  ${brokenData.broken_smiles.length}`);
    console.log(`  Successfully fixed: ${results.fixed.length}`);
    console.log(`  Still broken:       ${results.stillBroken.length}`);
    console.log(`  No patterns found:  ${results.noChange.length}`);

    if (Object.keys(results.fixCounts).length > 0) {
        console.log('\nFixes applied:');
        for (const [fix, count] of Object.entries(results.fixCounts).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${fix}: ${count}`);
        }
    }

    // Update database (if not dry run)
    if (!isDryRun && results.fixed.length > 0) {
        console.log('\nConnecting to database...');
        const pool = getPool();
        let client;

        try {
            client = await pool.connect();
            console.log('  OK: Connected to', process.env.DB_HOST);

            console.log(`\nUpdating ${results.fixed.length} records...`);

            let updated = 0;
            for (const item of results.fixed) {
                await client.query(
                    `UPDATE synthesis_steps SET ${item.field} = $1 WHERE id = $2`,
                    [item.fixed_value, item.step_id]
                );
                updated++;

                if (updated % 50 === 0) {
                    process.stdout.write(`\rUpdated: ${updated}/${results.fixed.length}`);
                }
            }

            console.log(`\n  OK: Updated ${updated} records`);
        } catch (err) {
            console.error('  Database error:', err.message);
        } finally {
            if (client) client.release();
            await pool.end();
        }
    }

    // Save reports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const fixReportPath = path.join(__dirname, 'output', `fix_report_${timestamp}.json`);
    fs.writeFileSync(fixReportPath, JSON.stringify({
        run_info: {
            timestamp: new Date().toISOString(),
            dry_run: isDryRun,
            input_file: brokenSmilesPath,
            total_processed: brokenData.broken_smiles.length,
            fixed_count: results.fixed.length,
            still_broken_count: results.stillBroken.length,
            no_change_count: results.noChange.length,
            fix_counts: results.fixCounts
        },
        fixed: results.fixed
    }, null, 2));
    console.log(`\nFix report saved to:\n  ${fixReportPath}`);

    if (results.stillBroken.length > 0 || results.noChange.length > 0) {
        const needsReviewPath = path.join(__dirname, 'output', `needs_review_${timestamp}.json`);
        fs.writeFileSync(needsReviewPath, JSON.stringify({
            still_broken: results.stillBroken,
            no_fixable_patterns: results.noChange
        }, null, 2));
        console.log(`Needs review saved to:\n  ${needsReviewPath}`);
    }

    // Show some examples
    if (results.fixed.length > 0) {
        console.log('\nFirst 5 fixed SMILES:');
        results.fixed.slice(0, 5).forEach((item, i) => {
            console.log(`\n  ${i + 1}. [step_id: ${item.step_id}] ${item.field}`);
            console.log(`     Synthesis: ${item.synthesis_name}`);
            console.log(`     Before: ${item.original_value?.substring(0, 50)}${item.original_value?.length > 50 ? '...' : ''}`);
            console.log(`     After:  ${item.fixed_value?.substring(0, 50)}${item.fixed_value?.length > 50 ? '...' : ''}`);
            console.log(`     Fixes:  ${item.applied_fixes.join(', ')}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('Done');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
