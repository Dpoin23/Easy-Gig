'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadEnv(filePath) {
    const envPath = filePath || path.join(process.cwd(), '.env');
    let raw;
    try {
        raw = fs.readFileSync(envPath, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') {
            return;
        }
        throw err;
    }

    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const cut = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
        const eq = cut.indexOf('=');
        if (eq <= 0) {
            continue;
        }
        const key = cut.slice(0, eq).trim();
        let value = cut.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (process.env[key] == null) {
            process.env[key] = value;
        }
    }
}

module.exports = { loadEnv };
