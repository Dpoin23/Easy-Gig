'use strict';

/**
 * Remove demo and manual-testing data from easy_gig.
 *
 *   npm run clear-test-data                  # dry run: list what would be deleted
 *   npm run clear-test-data -- --yes         # delete it
 *   npm run clear-test-data -- --legacy      # also include every pre-Places post
 *
 * Removed by default:
 *   - seeded demo accounts (*@easygig.demo), their posts and sessions
 *   - the manual test accounts in test/testingInformation.md, their posts and sessions
 *   - "Post Test" posts with the old placeholder locations (testing, testing two, different)
 *   - posts from the old seed that used fake "seed:" place ids
 *   - posts whose owner no longer exists
 *
 * --legacy also removes any post without a Google place id or coordinates, from any user.
 * Those posts predate real locations and never show up in distance search.
 */

const mysql = require('mysql2/promise');
const { loadEnv } = require('../lib/loadEnv');

loadEnv();

const { dbConfig } = require('../lib/dbConfig');

const DEMO_EMAIL_PATTERN = '%@easygig.demo';
const TEST_EMAILS = ['testone@gmail.com', 'testtwo@gmail.com'];
const TEST_TITLE_PATTERN = 'Post Test%';
const TEST_LOCATIONS = ['testing', 'testing two', 'different'];

const USAGE = 'Usage: node scripts/clear-test-data.js [--yes] [--legacy]';

function parseArgs(argv) {
    const flags = { yes: false, legacy: false };
    for (const arg of argv) {
        if (arg === '--yes') {
            flags.yes = true;
        } else if (arg === '--legacy') {
            flags.legacy = true;
        } else {
            throw new Error(`Unknown option "${arg}". ${USAGE}`);
        }
    }
    return flags;
}

async function schemaInfo(conn) {
    const [tables] = await conn.query(
        'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    const [columns] = await conn.query(
        `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts'`
    );
    return {
        tables: new Set(tables.map((row) => row.name)),
        postColumns: new Set(columns.map((row) => row.name)),
    };
}

async function findUsers(conn, tables) {
    if (!tables.has('users')) {
        return [];
    }
    const [rows] = await conn.query(
        'SELECT id, email FROM users WHERE email LIKE ? OR email IN (?) ORDER BY id',
        [DEMO_EMAIL_PATTERN, TEST_EMAILS]
    );
    return rows;
}

async function findPosts(conn, { tables, postColumns }, userIds, flags) {
    if (!tables.has('posts')) {
        return [];
    }

    const found = new Map();
    const add = (rows, reason) => {
        for (const row of rows) {
            const entry = found.get(row.id) || { ...row, reasons: [] };
            entry.reasons.push(reason);
            found.set(row.id, entry);
        }
    };
    const select = 'SELECT id, user_id, title, location FROM posts';

    if (userIds.length > 0) {
        const [rows] = await conn.query(`${select} WHERE user_id IN (?)`, [userIds]);
        add(rows, 'test account');
    }

    const [placeholders] = await conn.query(
        `${select} WHERE title LIKE ? AND location IN (?)`,
        [TEST_TITLE_PATTERN, TEST_LOCATIONS]
    );
    add(placeholders, 'placeholder test post');

    if (postColumns.has('place_id')) {
        const [fakePlaces] = await conn.query(`${select} WHERE place_id LIKE 'seed:%'`);
        add(fakePlaces, 'fake seed place');
    }

    if (tables.has('users')) {
        const [orphans] = await conn.query(
            `${select} WHERE user_id IS NULL OR user_id NOT IN (SELECT id FROM users)`
        );
        add(orphans, 'owner missing');
    }

    if (flags.legacy) {
        const where = postColumns.has('place_id') && postColumns.has('lat')
            ? 'WHERE place_id IS NULL OR lat IS NULL OR lng IS NULL'
            : '';
        const [legacy] = await conn.query(`${select} ${where}`);
        add(legacy, 'no real location');
    }

    return [...found.values()].sort((a, b) => a.id - b.id);
}

function printPlan(users, posts) {
    console.log(`Users to delete: ${users.length}`);
    for (const user of users) {
        console.log(`  #${user.id} ${user.email}`);
    }
    console.log(`Posts to delete: ${posts.length}`);
    for (const post of posts) {
        console.log(`  #${post.id} "${post.title}" @ ${post.location ?? '(none)'} [${post.reasons.join(', ')}]`);
    }
}

async function deleteAll(conn, { tables, postColumns }, users, posts) {
    const userIds = users.map((user) => user.id);
    const postIds = posts.map((post) => post.id);

    await conn.beginTransaction();
    try {
        if (postIds.length > 0) {
            await conn.query('DELETE FROM posts WHERE id IN (?)', [postIds]);
        }
        if (userIds.length > 0) {
            if (tables.has('sessions')) {
                await conn.query('DELETE FROM sessions WHERE user_id IN (?)', [userIds]);
            }
            for (const column of ['current_bidder_id', 'accepted_user_id']) {
                if (postColumns.has(column)) {
                    await conn.query(
                        `UPDATE posts SET \`${column}\` = NULL WHERE \`${column}\` IN (?)`,
                        [userIds]
                    );
                }
            }
            await conn.query('DELETE FROM users WHERE id IN (?)', [userIds]);
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    }
}

async function main() {
    const flags = parseArgs(process.argv.slice(2));
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Refusing to clear data when NODE_ENV=production');
    }

    const conn = await mysql.createConnection(dbConfig());
    try {
        const schema = await schemaInfo(conn);
        const users = await findUsers(conn, schema.tables);
        const posts = await findPosts(conn, schema, users.map((user) => user.id), flags);

        printPlan(users, posts);
        if (users.length === 0 && posts.length === 0) {
            console.log('Nothing to clear.');
            return;
        }
        if (!flags.yes) {
            console.log('Dry run. Re-run with --yes to delete these rows.');
            return;
        }

        await deleteAll(conn, schema, users, posts);
        console.log(`Deleted ${users.length} users and ${posts.length} posts.`);
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('Clear failed:', err.message);
    process.exitCode = 1;
});
