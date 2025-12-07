
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

async function calculateSteps() {
    console.log('Reading index.json...');
    if (!fs.existsSync(INDEX_FILE)) {
        console.error('index.json not found!');
        process.exit(1);
    }

    const indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    let updatedCount = 0;

    for (const entry of indexData) {
        const relativePath = entry.path;
        if (!relativePath) {
            console.warn(`Skipping entry without path: ${entry.id}`);
            continue;
        }

        const absolutePath = path.join(PUBLIC_DIR, relativePath);

        if (fs.existsSync(absolutePath)) {
            try {
                const fileContent = fs.readFileSync(absolutePath, 'utf-8');
                const synthesis = JSON.parse(fileContent);

                let stepCount = 0;
                if (synthesis.sequence && Array.isArray(synthesis.sequence)) {
                    stepCount = synthesis.sequence.length;
                }

                // Update the entry in index
                if (entry.step_count !== stepCount) {
                    entry.step_count = stepCount;
                    updatedCount++;
                }
            } catch (err) {
                console.error(`Error processing ${relativePath}:`, err.message);
            }
        } else {
            console.warn(`File not found: ${absolutePath}`);
        }
    }

    console.log(`Updated ${updatedCount} entries with step counts.`);

    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 4));
    console.log('index.json updated successfully.');
}

calculateSteps();
