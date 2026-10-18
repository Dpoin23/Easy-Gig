'use strict';

/**
 * Insert demo users and gigs into easy_gig.
 * Safe to run more than once: existing demo emails and titles are left in place.
 *
 *   npm run seed
 *
 * Demo sign-in password for every seeded account: password123
 */

const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

const DEMO_PASSWORD = 'password123';

const connection = {
    host: 'localhost',
    user: 'root',
    password: 'Nextgen#23',
};

const users = [
    { name: 'Alex Rivera', email: 'alex.rivera@easygig.demo' },
    { name: 'Jordan Lee', email: 'jordan.lee@easygig.demo' },
    { name: 'Sam Patel', email: 'sam.patel@easygig.demo' },
];

const cities = {
    seattle: {
        location: 'Seattle, WA',
        locality: 'Seattle',
        admin_area: 'WA',
        lat: 47.6062,
        lng: -122.3321,
        place_id: 'seed:seattle-wa',
    },
    capitolHill: {
        location: 'Capitol Hill, Seattle, WA',
        locality: 'Seattle',
        neighborhood: 'Capitol Hill',
        admin_area: 'WA',
        lat: 47.6253,
        lng: -122.3222,
        place_id: 'seed:capitol-hill-seattle',
    },
    bellevue: {
        location: 'Bellevue, WA',
        locality: 'Bellevue',
        admin_area: 'WA',
        lat: 47.6101,
        lng: -122.2015,
        place_id: 'seed:bellevue-wa',
    },
    tacoma: {
        location: 'Tacoma, WA',
        locality: 'Tacoma',
        admin_area: 'WA',
        lat: 47.2529,
        lng: -122.4443,
        place_id: 'seed:tacoma-wa',
    },
    kirkland: {
        location: 'Kirkland, WA',
        locality: 'Kirkland',
        admin_area: 'WA',
        lat: 47.6769,
        lng: -122.2060,
        place_id: 'seed:kirkland-wa',
    },
    redmond: {
        location: 'Redmond, WA',
        locality: 'Redmond',
        admin_area: 'WA',
        lat: 47.6740,
        lng: -122.1215,
        place_id: 'seed:redmond-wa',
    },
    renton: {
        location: 'Renton, WA',
        locality: 'Renton',
        admin_area: 'WA',
        lat: 47.4829,
        lng: -122.2171,
        place_id: 'seed:renton-wa',
    },
};

const posts = [
    {
        email: 'alex.rivera@easygig.demo',
        title: 'Lawn mowing and edging',
        description: 'Weekly cut for a small front and back yard. Bag the clippings.',
        ...cities.capitolHill,
        address_formatted: '1200 E Pine St, Seattle, WA 98122',
        address_lat: 47.6152,
        address_lng: -122.3163,
        address_visibility: 'after_hire',
        max_pay: 40.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'alex.rivera@easygig.demo',
        title: 'Mow the backyard',
        description: 'One visit. The yard is flat and the mower is in the shed.',
        ...cities.bellevue,
        max_pay: 80.00,
        type_of_pay: 'one-time',
    },
    {
        email: 'jordan.lee@easygig.demo',
        title: 'Yard cleanup',
        description: 'Weeding and mowing the edges before a weekend gathering.',
        ...cities.seattle,
        max_pay: 120.00,
        type_of_pay: 'one-time',
    },
    {
        email: 'jordan.lee@easygig.demo',
        title: 'Dog walking on weekdays',
        description: 'Two medium dogs, about 40 minutes, mornings preferred.',
        ...cities.tacoma,
        max_pay: 25.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'sam.patel@easygig.demo',
        title: 'Piano lessons for beginners',
        description: 'Half-hour lessons at home. Beginners and kids welcome.',
        ...cities.kirkland,
        address_formatted: 'Parkplace, Kirkland, WA 98033',
        address_lat: 47.6765,
        address_lng: -122.2050,
        address_visibility: 'public',
        max_pay: 50.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'sam.patel@easygig.demo',
        title: 'Help moving boxes',
        description: 'Carry boxes from a second-floor apartment down to a truck.',
        ...cities.seattle,
        address_formatted: '88 Yesler Way, Seattle, WA 98104',
        address_lat: 47.6015,
        address_lng: -122.3340,
        address_visibility: 'after_hire',
        max_pay: 30.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'alex.rivera@easygig.demo',
        title: 'Algebra tutoring',
        description: 'High-school algebra, one evening a week.',
        ...cities.redmond,
        max_pay: 45.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'jordan.lee@easygig.demo',
        title: 'Assemble a bookshelf',
        description: 'Flat-pack bookshelf. Tools are on site and it should take about two hours.',
        ...cities.renton,
        max_pay: 70.00,
        type_of_pay: 'one-time',
    },
];

async function ensureColumn(conn, table, column, definition) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS n
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = 'easy_gig' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    if (Number(rows[0].n) === 0) {
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
}

async function main() {
    const conn = await mysql.createConnection(connection);
    let usersAdded = 0;
    let postsAdded = 0;

    try {
        await conn.query('CREATE DATABASE IF NOT EXISTS easy_gig');
        await conn.query('USE easy_gig');

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
            place_id VARCHAR(255),
            locality VARCHAR(255),
            neighborhood VARCHAR(255),
            admin_area VARCHAR(64),
            country VARCHAR(64),
            postal_code VARCHAR(32),
            lat DECIMAL(10, 7),
            lng DECIMAL(10, 7),
            address_place_id VARCHAR(255),
            address_formatted VARCHAR(512),
            address_lat DECIMAL(10, 7),
            address_lng DECIMAL(10, 7),
            address_visibility VARCHAR(32) NOT NULL DEFAULT 'after_hire',
            current_bidder_id INT,
            accepted_user_id INT,
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

        await ensureColumn(conn, 'users', 'salt', 'VARCHAR(255)');
        await ensureColumn(conn, 'posts', 'user_id', 'INT');
        await ensureColumn(conn, 'posts', 'current_bid', 'DECIMAL(8, 2) DEFAULT 0');
        await ensureColumn(conn, 'posts', 'place_id', 'VARCHAR(255) NULL');
        await ensureColumn(conn, 'posts', 'locality', 'VARCHAR(255) NULL');
        await ensureColumn(conn, 'posts', 'neighborhood', 'VARCHAR(255) NULL');
        await ensureColumn(conn, 'posts', 'admin_area', 'VARCHAR(64) NULL');
        await ensureColumn(conn, 'posts', 'country', 'VARCHAR(64) NULL');
        await ensureColumn(conn, 'posts', 'postal_code', 'VARCHAR(32) NULL');
        await ensureColumn(conn, 'posts', 'lat', 'DECIMAL(10, 7) NULL');
        await ensureColumn(conn, 'posts', 'lng', 'DECIMAL(10, 7) NULL');
        await ensureColumn(conn, 'posts', 'address_place_id', 'VARCHAR(255) NULL');
        await ensureColumn(conn, 'posts', 'address_formatted', 'VARCHAR(512) NULL');
        await ensureColumn(conn, 'posts', 'address_lat', 'DECIMAL(10, 7) NULL');
        await ensureColumn(conn, 'posts', 'address_lng', 'DECIMAL(10, 7) NULL');
        await ensureColumn(conn, 'posts', 'address_visibility', "VARCHAR(32) NOT NULL DEFAULT 'after_hire'");
        await ensureColumn(conn, 'posts', 'current_bidder_id', 'INT NULL');
        await ensureColumn(conn, 'posts', 'accepted_user_id', 'INT NULL');

        const idsByEmail = new Map();
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
            usersAdded += 1;
        }

        for (const post of posts) {
            const userId = idsByEmail.get(post.email);
            const locationValues = [
                post.location,
                post.place_id,
                post.locality || null,
                post.neighborhood || null,
                post.admin_area || null,
                post.lat,
                post.lng,
                post.address_formatted || null,
                post.address_lat || null,
                post.address_lng || null,
                post.address_visibility || 'after_hire',
            ];
            const [existing] = await conn.query(
                'SELECT id FROM posts WHERE user_id = ? AND title = ?',
                [userId, post.title]
            );
            if (existing.length > 0) {
                await conn.query(
                    `UPDATE posts
                     SET location = ?, place_id = ?, locality = ?, neighborhood = ?, admin_area = ?,
                         lat = ?, lng = ?, address_formatted = ?, address_lat = ?, address_lng = ?,
                         address_visibility = ?
                     WHERE id = ?`,
                    [...locationValues, existing[0].id]
                );
                continue;
            }

            await conn.query(
                `INSERT INTO posts (
                    user_id, title, description, location, max_pay, type_of_pay, current_bid,
                    place_id, locality, neighborhood, admin_area, lat, lng,
                    address_formatted, address_lat, address_lng, address_visibility
                ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    post.title,
                    post.description,
                    post.location,
                    post.max_pay,
                    post.type_of_pay,
                    post.place_id,
                    post.locality || null,
                    post.neighborhood || null,
                    post.admin_area || null,
                    post.lat,
                    post.lng,
                    post.address_formatted || null,
                    post.address_lat || null,
                    post.address_lng || null,
                    post.address_visibility || 'after_hire',
                ]
            );
            postsAdded += 1;
        }
    } finally {
        await conn.end();
    }

    console.log(`Seed complete. Added ${usersAdded} users and ${postsAdded} posts.`);
    console.log('Demo sign-in password: password123');
    for (const user of users) {
        console.log(`  ${user.email}`);
    }
}

main().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
});
