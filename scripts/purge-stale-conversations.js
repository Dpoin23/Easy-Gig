'use strict';

/**
 * Remove conversations that have had no messages for 12 months.
 *
 *   npm run purge-stale-conversations           # dry run
 *   npm run purge-stale-conversations -- --yes  # delete them
 *
 * Messaging works without this. It is only the retention policy.
 */

const mysql = require('mysql2/promise');
const { loadEnv } = require('../lib/loadEnv');

loadEnv();

const { dbConfig } = require('../lib/dbConfig');
const { RETENTION_MONTHS, PURGE_STALE_CONVERSATIONS_SQL } = require('../lib/messages');

const USAGE = 'Usage: node scripts/purge-stale-conversations.js [--yes]';

function parseArgs(argv) {
    const flags = { yes: false };
    for (const arg of argv) {
        if (arg === '--yes') {
            flags.yes = true;
        } else {
            throw new Error(`Unknown option "${arg}". ${USAGE}`);
        }
    }
    return flags;
}

async function main() {
    const flags = parseArgs(process.argv.slice(2));
    const conn = await mysql.createConnection(dbConfig());
    try {
        const [tables] = await conn.query(
            `SELECT TABLE_NAME AS name FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('conversations', 'messages')`
        );
        const names = new Set(tables.map((row) => row.name));
        if (!names.has('conversations')) {
            console.log('No conversations table yet.');
            return;
        }

        const [rows] = await conn.query(PURGE_STALE_CONVERSATIONS_SQL);
        console.log(`Conversations idle for ${RETENTION_MONTHS} months: ${rows.length}`);
        for (const row of rows) {
            console.log(`  #${row.id} post ${row.post_id} last message ${row.last_message_at}`);
        }
        if (rows.length === 0) {
            return;
        }
        if (!flags.yes) {
            console.log('Dry run. Re-run with --yes to delete these conversations.');
            return;
        }

        const ids = rows.map((row) => row.id);
        await conn.beginTransaction();
        try {
            if (names.has('messages')) {
                await conn.query('DELETE FROM messages WHERE conversation_id IN (?)', [ids]);
            }
            await conn.query('DELETE FROM conversations WHERE id IN (?)', [ids]);
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        }
        console.log(`Deleted ${ids.length} conversations.`);
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('Purge failed:', err.message);
    process.exitCode = 1;
});
