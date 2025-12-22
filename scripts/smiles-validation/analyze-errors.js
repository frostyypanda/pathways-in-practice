const data = require('./output/broken_smiles_2025-12-17T16-10-34.json');

// Categorize all errors
const categories = {
    'Unexpected H': [],
    'Truncated': [],
    'Unmatched paren': [],
    'OMe/OEt/Me patterns': [],
    'Bu patterns': [],
    'Charge issues': [],
    'Other': []
};

data.broken_smiles.forEach(item => {
    const e = item.error_message;
    const v = item.broken_value;

    if (e.includes('end of input found')) {
        categories['Truncated'].push(item);
    } else if (e.includes('"H" found')) {
        categories['Unexpected H'].push(item);
    } else if (e.includes('")" found')) {
        categories['Unmatched paren'].push(item);
    } else if (e.includes('"M" found') || e.includes('"E" found')) {
        categories['OMe/OEt/Me patterns'].push(item);
    } else if (e.includes('"B" found')) {
        categories['Bu patterns'].push(item);
    } else if (e.includes('"+" found') || e.includes('"-" found')) {
        categories['Charge issues'].push(item);
    } else {
        categories['Other'].push(item);
    }
});

console.log('=== ERROR CATEGORIES ===\n');
Object.entries(categories).forEach(([cat, items]) => {
    console.log(`${cat}: ${items.length}`);
});

// Analyze H errors in detail
console.log('\n=== UNEXPECTED H PATTERNS ===\n');
const hPatterns = {};
categories['Unexpected H'].forEach(item => {
    const v = item.broken_value;

    if (v.includes('(H)')) hPatterns['(H) - explicit H atom'] = (hPatterns['(H) - explicit H atom'] || 0) + 1;
    if (v.match(/\[C@@?H\]\d*H/)) hPatterns['[C@H]H - H after stereo'] = (hPatterns['[C@H]H - H after stereo'] || 0) + 1;
    if (v.match(/C\(=O\)H/)) hPatterns['C(=O)H - formyl'] = (hPatterns['C(=O)H - formyl'] || 0) + 1;
    if (v.match(/N\d?\)H/)) hPatterns['N)H - H after nitrogen ring'] = (hPatterns['N)H - H after nitrogen ring'] || 0) + 1;
    if (v.match(/\[Si\].*H$/)) hPatterns['[Si]...H - silane'] = (hPatterns['[Si]...H - silane'] || 0) + 1;
    if (v.match(/Si\(.*\)H/)) hPatterns['Si(...)H - silane with H'] = (hPatterns['Si(...)H - silane with H'] || 0) + 1;
    if (v.match(/^HO/)) hPatterns['HO... at start'] = (hPatterns['HO... at start'] || 0) + 1;
    if (v.match(/\)H[^0-9\]]/)) hPatterns[')H - H after paren'] = (hPatterns[')H - H after paren'] || 0) + 1;
    if (v.match(/OCH\(/)) hPatterns['OCH( - methylene'] = (hPatterns['OCH( - methylene'] || 0) + 1;
    if (v.match(/(?<!\[)CH\(/)) hPatterns['CH( - methine'] = (hPatterns['CH( - methine'] || 0) + 1;
    if (v.match(/N\(.*\)H$/)) hPatterns['N(...)H at end'] = (hPatterns['N(...)H at end'] || 0) + 1;
});

Object.entries(hPatterns).sort((a,b) => b[1] - a[1]).forEach(([p, c]) => {
    console.log(`  ${p}: ${c}`);
});

// Show some fixable H examples
console.log('\n=== FIXABLE H EXAMPLES ===\n');
const fixableH = categories['Unexpected H'].filter(x =>
    x.broken_value.match(/C\(=O\)H/) ||
    x.broken_value.match(/^HO/) ||
    x.broken_value.match(/\(H\)/) ||
    x.broken_value.match(/\)H$/) ||
    x.broken_value.match(/Si\([^)]+\)H/)
).slice(0, 10);

fixableH.forEach((item, i) => {
    console.log(`${i+1}. ${item.broken_value.substring(0, 80)}`);
});

// Analyze OMe/OEt patterns
console.log('\n=== OMe/OEt PATTERNS ===\n');
categories['OMe/OEt/Me patterns'].slice(0, 10).forEach((item, i) => {
    console.log(`${i+1}. ${item.broken_value.substring(0, 80)}`);
});

// Analyze Bu patterns
console.log('\n=== Bu PATTERNS ===\n');
categories['Bu patterns'].slice(0, 10).forEach((item, i) => {
    console.log(`${i+1}. ${item.broken_value.substring(0, 80)}`);
});

// Analyze Other
console.log('\n=== OTHER ERRORS ===\n');
const otherChars = {};
categories['Other'].forEach(item => {
    const match = item.error_message.match(/but "(.)" found/);
    if (match) {
        otherChars[match[1]] = (otherChars[match[1]] || 0) + 1;
    }
});
console.log('Characters causing errors:');
Object.entries(otherChars).sort((a,b) => b[1] - a[1]).forEach(([c, n]) => {
    console.log(`  "${c}": ${n}`);
});
