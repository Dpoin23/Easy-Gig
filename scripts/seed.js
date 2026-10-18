'use strict';

/**
 * Insert a small set of demo users and gigs into easy_gig.
 * Gig locations are resolved through Google Places the same way /api/addpost does,
 * so each new post costs one autocomplete session per place. Posts that already
 * exist are skipped and make no Places calls.
 *
 *   npm run seed
 *
 * Requires GOOGLE_PLACES_API_KEY (see docs/GOOGLE_PLACES.md).
 * Demo sign-in password for every seeded account: password123
 */

const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const { loadEnv } = require('../lib/loadEnv');

loadEnv();

const { dbConfig, databaseName } = require('../lib/dbConfig');
const { placesConfigured, autocomplete } = require('../lib/places');
const { POST_LOCATION_COLUMNS } = require('../lib/postLocation');
const { resolveGigLocation, INSERT_POST_SQL, insertPostParams } = require('../lib/resolveLocation');
const { CREATE_CONVERSATIONS_SQL, CREATE_MESSAGES_SQL } = require('../lib/messages');

const DEMO_PASSWORD = 'password123';

const users = [
    { name: 'Alex Rivera', email: 'alex.rivera@easygig.demo' },
    { name: 'Jordan Lee', email: 'jordan.lee@easygig.demo' },
    { name: 'Sam Patel', email: 'sam.patel@easygig.demo' },
];

// Kept small on purpose: every new post spends Places lookups.
const posts = [
    {
        email: 'alex.rivera@easygig.demo',
        title: 'Lawn mowing and edging',
        description: 'Weekly cut for a small front and back yard. Bag the clippings.',
        area: 'Seattle, WA',
        address: '400 Broad St, Seattle, WA 98109',
        addressVisibility: 'after_hire',
        pay: 40.00,
        payType: 'hourly',
    },
    {
        email: 'jordan.lee@easygig.demo',
        title: 'Dog walking on weekdays',
        description: 'Two medium dogs, about 40 minutes, mornings preferred.',
        area: 'Bellevue, WA',
        pay: 25.00,
        payType: 'hourly',
    },
    {
        email: 'sam.patel@easygig.demo',
        title: 'Assemble a bookshelf',
        description: 'Flat-pack bookshelf. Tools are on site and it should take about two hours.',
        area: 'Tacoma, WA',
        pay: 70.00,
        payType: 'one-time',
    },
];

let placesLookups = 0;

async function findPlace(input, mode) {
    const sessionToken = crypto.randomUUID();
    placesLookups += 1;
    const suggestions = await autocomplete({ input, mode, sessionToken });
    if (suggestions.length === 0) {
        throw new Error(`Google Places found nothing for "${input}"`);
    }
    return { placeId: suggestions[0].placeId, sessionToken };
}

async function ensureColumn(conn, table, column, definition) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS n
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    if (Number(rows[0].n) === 0) {
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
}

async function ensureSchema(conn) {
    const database = databaseName();
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await conn.query(`USE \`${database}\``);

    await conn.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT,
        name VARCHAR(255),
        email VARCHAR(255),
        password VARCHAR(255),
        salt VARCHAR(255),
        PRIMARY KEY (id)
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT,
        user_id INT,
        title VARCHAR(255),
        description VARCHAR(255),
        location VARCHAR(255),
        max_pay DECIMAL(8, 2),
        type_of_pay VARCHAR(255),
        current_bid DECIMAL(8, 2) DEFAULT 0,
        PRIMARY KEY (id)
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS sessions (
        token_hash CHAR(64) NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        PRIMARY KEY (token_hash),
        KEY sessions_user (user_id),
        KEY sessions_expiry (expires_at)
    )`);
    await conn.query(CREATE_CONVERSATIONS_SQL);
    await conn.query(CREATE_MESSAGES_SQL);

    await ensureColumn(conn, 'users', 'salt', 'VARCHAR(255)');
    await ensureColumn(conn, 'posts', 'user_id', 'INT');
    await ensureColumn(conn, 'posts', 'current_bid', 'DECIMAL(8, 2) DEFAULT 0');
    for (const [column, definition] of POST_LOCATION_COLUMNS) {
        await ensureColumn(conn, 'posts', column, definition);
    }
}

async function ensureUsers(conn) {
    const idsByEmail = new Map();
    let added = 0;
    for (const user of users) {
        const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [user.email]);
        if (existing.length > 0) {
            idsByEmail.set(user.email, existing[0].id);
            continue;
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync(DEMO_PASSWORD, salt, 64).toString('hex');
        const [result] = await conn.query(
            'INSERT INTO users (name, email, password, salt) VALUES (?, ?, ?, ?)',
            [user.name, user.email, hash, salt]
        );
        idsByEmail.set(user.email, result.insertId);
        added += 1;
    }
    return { idsByEmail, added };
}

async function insertPost(conn, post, userId) {
    const area = await findPlace(post.area, 'area');
    const address = post.address ? await findPlace(post.address, 'address') : null;

    const resolved = await resolveGigLocation({
        areaPlaceId: area.placeId,
        areaSessionToken: area.sessionToken,
        addressPlaceId: address ? address.placeId : null,
        addressSessionToken: address ? address.sessionToken : null,
        addressVisibility: post.addressVisibility,
    });
    if (resolved.error) {
        throw new Error(`"${post.title}": ${resolved.error}`);
    }

    await conn.query(
        INSERT_POST_SQL,
        insertPostParams(
            {
                title: post.title,
                description: post.description,
                pay: post.pay,
                payType: post.payType,
                userId,
            },
            resolved.value
        )
    );
    return resolved.value.location;
}

async function main() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Refusing to seed demo accounts with a shared password when NODE_ENV=production');
    }

    const conn = await mysql.createConnection(dbConfig({ withDatabase: false }));
    let usersAdded;
    let postsAdded = 0;
    let stale = 0;

    try {
        await ensureSchema(conn);
        const ensured = await ensureUsers(conn);
        usersAdded = ensured.added;

        for (const post of posts) {
            const userId = ensured.idsByEmail.get(post.email);
            const [existing] = await conn.query(
                'SELECT id, place_id FROM posts WHERE user_id = ? AND title = ?',
                [userId, post.title]
            );
            if (existing.length > 0) {
                const placeId = existing[0].place_id || '';
                if (!placeId || placeId.startsWith('seed:')) {
                    stale += 1;
                }
                continue;
            }

            if (!placesConfigured()) {
                throw new Error(
                    'GOOGLE_PLACES_API_KEY is not set. Seeded gigs need real places; see docs/GOOGLE_PLACES.md'
                );
            }

            const location = await insertPost(conn, post, userId);
            console.log(`  + ${post.title} (${location})`);
            postsAdded += 1;
        }
    } finally {
        await conn.end();
    }

    console.log(`Seed complete. Added ${usersAdded} users and ${postsAdded} posts.`);
    console.log(`Google Places lookups this run: ${placesLookups}`);
    if (stale > 0) {
        console.log(
            `${stale} demo post(s) still use the old free-text location. Run "npm run clear-test-data -- --yes" and seed again.`
        );
    }
    console.log('Demo sign-in password: password123');
    for (const user of users) {
        console.log(`  ${user.email}`);
    }
}

main().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
});
