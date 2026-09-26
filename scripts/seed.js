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

const posts = [
    {
        email: 'alex.rivera@easygig.demo',
        title: 'Lawn mowing and edging',
        description: 'Weekly cut for a small front and back yard. Bag the clippings.',
        location: 'Seattle, WA',
        max_pay: 40.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'alex.rivera@easygig.demo',
        title: 'Mow the backyard',
        description: 'One visit. The yard is flat and the mower is in the shed.',
        location: 'Bellevue, WA',
        max_pay: 80.00,
        type_of_pay: 'one-time',
    },
    {
        email: 'jordan.lee@easygig.demo',
        title: 'Yard cleanup',
        description: 'Weeding and mowing the edges before a weekend gathering.',
        location: 'Seattle, WA',
        max_pay: 120.00,
        type_of_pay: 'one-time',
    },
    {
        email: 'jordan.lee@easygig.demo',
        title: 'Dog walking on weekdays',
        description: 'Two medium dogs, about 40 minutes, mornings preferred.',
        location: 'Tacoma, WA',
        max_pay: 25.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'sam.patel@easygig.demo',
        title: 'Piano lessons for beginners',
        description: 'Half-hour lessons at home. Beginners and kids welcome.',
        location: 'Kirkland, WA',
        max_pay: 50.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'sam.patel@easygig.demo',
        title: 'Help moving boxes',
        description: 'Carry boxes from a second-floor apartment down to a truck.',
        location: 'Seattle, WA',
        max_pay: 30.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'alex.rivera@easygig.demo',
        title: 'Algebra tutoring',
        description: 'High-school algebra, one evening a week.',
        location: 'Redmond, WA',
        max_pay: 45.00,
        type_of_pay: 'hourly',
    },
    {
        email: 'jordan.lee@easygig.demo',
        title: 'Assemble a bookshelf',
        description: 'Flat-pack bookshelf. Tools are on site and it should take about two hours.',
        location: 'Renton, WA',
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
            PRIMARY KEY (id)
        )`);

        await ensureColumn(conn, 'users', 'salt', 'VARCHAR(255)');
        await ensureColumn(conn, 'posts', 'user_id', 'INT');
        await ensureColumn(conn, 'posts', 'current_bid', 'DECIMAL(8, 2) DEFAULT 0');

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
            const [existing] = await conn.query(
                'SELECT id FROM posts WHERE user_id = ? AND title = ?',
                [userId, post.title]
            );
            if (existing.length > 0) {
                continue;
            }

            await conn.query(
                `INSERT INTO posts (user_id, title, description, location, max_pay, type_of_pay, current_bid)
                 VALUES (?, ?, ?, ?, ?, ?, 0)`,
                [userId, post.title, post.description, post.location, post.max_pay, post.type_of_pay]
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
