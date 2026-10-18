const { loadEnv } = require('./lib/loadEnv');
loadEnv();

const mysql = require('mysql2');
const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { rankPosts } = require('./lib/searchRank');
const { findMatchingUser } = require('./lib/passwords');
const { placesConfigured, autocomplete, placeDetails } = require('./lib/places');
const {
    DEFAULT_VISIBILITY,
    publicLabel,
    assertUsableArea,
    publicPostView,
    redactPosts,
    filterByRadius,
    addressFitsArea,
    ensurePostsLocationColumns,
} = require('./lib/postLocation');
const {
    SESSION_TTL_SECONDS,
    newSessionToken,
    hashSessionToken,
    readSessionToken,
    sessionCookie,
    clearSessionCookie,
} = require('./lib/sessions');
const {
    textField,
    emailField,
    passwordField,
    signinPassword,
    idField,
    moneyField,
    payTypeField,
    searchField,
    placeIdField,
    sessionTokenField,
    placesModeField,
    addressVisibilityField,
    radiusField,
    latField,
    lngField,
} = require('./lib/sanitize');

let dbReady = false;
const secureCookies = process.env.NODE_ENV === 'production';

// Connect
var db = mysql.createConnection({
   host: 'localhost',
   user: 'root',
   password: 'Nextgen#23',
   database: 'easy_gig'
});

db.connect((err) => {
    if (err) {
        console.error('MySQL connection failed:', err.message);
        console.error('Static files will still be served; API routes need MySQL.');
        return;
    }

    db.query(
        `CREATE TABLE IF NOT EXISTS sessions (
            token_hash CHAR(64) NOT NULL,
            user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            PRIMARY KEY (token_hash),
            KEY sessions_user (user_id),
            KEY sessions_expiry (expires_at)
        )`,
        (tableErr) => {
            if (tableErr) {
                console.error('Could not create sessions table:', tableErr.message);
                return;
            }
            ensurePostsLocationColumns(db, (columnsErr) => {
                if (columnsErr) {
                    console.error('Could not update posts location columns:', columnsErr.message);
                    return;
                }
                dbReady = true;
                console.log('mysql connected to easy_gig');
            });
        }
    );
});

db.on('error', (err) => {
    dbReady = false;
    console.error('MySQL connection error:', err.message);
});

const app = express();
app.use(cors());

function limiter(limit, windowMs) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        statusCode: 429,
        message: { error: 'Too many requests' },
    });
}

const authLimiter = limiter(10, 15 * 60 * 1000);
const writeLimiter = limiter(30, 15 * 60 * 1000);
const readLimiter = limiter(60, 60 * 1000);
const placesLimiter = limiter(40, 60 * 1000);
const maintenanceLimiter = limiter(5, 15 * 60 * 1000);

for (const path of ['/api/adduser', '/api/signin', '/api/updatePassword']) {
    app.use(path, authLimiter);
}
for (const path of [
    '/api/addpost',
    '/api/updatecurrentbid',
    '/api/acceptbid',
    '/api/updateuser',
    '/api/deletepostbyid',
    '/api/deleteaccountbyid',
    '/api/deletealluserposts',
    '/api/signout',
]) {
    app.use(path, writeLimiter);
}
for (const path of [
    '/api/me',
    '/api/getuser',
    '/api/getpostsbytitle',
    '/api/getpostsbylocation',
    '/api/getpostsbytype',
    '/api/getpostsbypay',
    '/api/getpostsbyuserid',
    '/api/posts',
]) {
    app.use(path, readLimiter);
}
for (const path of ['/api/places/autocomplete', '/api/places/details']) {
    app.use(path, placesLimiter);
}
for (const path of [
    '/createdb',
    '/createpoststable',
    '/createuserstable',
    '/updatepost',
    '/selectusers',
    '/selectposts',
    '/deleteallusers',
    '/deletepost',
    '/deletespecificpostfortesting',
]) {
    app.use(path, maintenanceLimiter);
}

app.use(express.json({ limit: '32kb' }));
app.use(express.static('public'));

function requireUser(req, res, next) {
    const token = readSessionToken(req.headers.cookie);
    if (!token) {
        return sendError(res, 401, 'Sign in required');
    }
    if (!dbReady) {
        return sendError(res, 503, 'Database unavailable');
    }

    const tokenHash = hashSessionToken(token);
    runQuery(
        res,
        'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > NOW()',
        [tokenHash],
        (rows) => {
            if (rows.length === 0) {
                res.setHeader('Set-Cookie', clearSessionCookie(secureCookies));
                sendError(res, 401, 'Sign in required');
                return;
            }
            req.userId = rows[0].user_id;
            req.sessionTokenHash = tokenHash;
            next();
        }
    );
}

function optionalUser(req, res, next) {
    const token = readSessionToken(req.headers.cookie);
    if (!token || !dbReady) {
        next();
        return;
    }

    const tokenHash = hashSessionToken(token);
    db.query(
        'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > NOW()',
        [tokenHash],
        (err, rows) => {
            if (!err && rows && rows.length > 0) {
                req.userId = rows[0].user_id;
            }
            next();
        }
    );
}

for (const path of [
    '/api/me',
    '/api/addpost',
    '/api/updatecurrentbid',
    '/api/acceptbid',
    '/api/updateuser',
    '/api/updatePassword',
    '/api/deletepostbyid',
    '/api/deleteaccountbyid',
    '/api/deletealluserposts',
    '/api/posts',
]) {
    app.use(path, requireUser);
}

for (const path of [
    '/api/getpostsbytitle',
    '/api/getpostsbylocation',
    '/api/getpostsbytype',
    '/api/getpostsbypay',
    '/api/getpostsbyuserid',
]) {
    app.use(path, optionalUser);
}

app.post('/api/places/autocomplete', async (req, res) => {
    const body = req.body || {};
    const input = readField(res, searchField(body.input));
    const mode = readField(res, placesModeField(body.mode));
    const sessionToken = readField(res, sessionTokenField(body.sessionToken));
    const lat = readField(res, latField(body.lat));
    const lng = readField(res, lngField(body.lng));
    if (res.headersSent) {
        return;
    }
    if (!input || input.length < 2) {
        res.json({ suggestions: [] });
        return;
    }
    if (!placesConfigured()) {
        sendError(res, 503, 'Location lookup is not configured');
        return;
    }

    try {
        const suggestions = await autocomplete({
            input,
            sessionToken,
            mode,
            locationBias: lat != null && lng != null ? { lat, lng } : null,
        });
        res.json({ suggestions });
    } catch (err) {
        sendError(res, err.status || 502, err.message || 'Location lookup failed');
    }
});

app.get('/api/places/details', async (req, res) => {
    const placeId = readField(res, placeIdField(req.query.placeId, 'Place', true));
    const sessionToken = readField(res, sessionTokenField(req.query.sessionToken));
    if (res.headersSent || placeId == null) {
        return;
    }
    if (!placesConfigured()) {
        sendError(res, 503, 'Location lookup is not configured');
        return;
    }

    try {
        const place = await placeDetails(placeId, sessionToken);
        res.json({
            placeId: place.placeId,
            label: publicLabel(place),
            formattedAddress: place.formattedAddress,
            locality: place.locality,
            neighborhood: place.neighborhood,
            adminArea: place.admin_area,
            types: place.types,
        });
    } catch (err) {
        sendError(res, err.status || 502, err.message || 'Location lookup failed');
    }
});

app.use('/api', (req, res, next) => {
    if (req.originalUrl.startsWith('/api/places')) {
        return next();
    }
    if (!dbReady) {
        return res.status(503).json({ error: 'Database unavailable' });
    }
    next();
});

function sendError(res, status, message) {
    if (!res.headersSent) {
        res.status(status).json({ error: message });
    }
}

function readField(res, parsed) {
    if (parsed.error) {
        sendError(res, 400, parsed.error);
        return null;
    }
    return parsed.value;
}

function runQuery(res, sql, params, onSuccess) {
    db.query(sql, params, (err, result) => {
        if (err) {
            console.error(err.code || 'query', err.message);
            sendError(res, 500, 'Database error');
            return;
        }

        try {
            onSuccess(result);
        } catch (handlerErr) {
            console.error(handlerErr);
            sendError(res, 500, 'Server error');
        }
    });
}

// Create database
app.get('/createdb', (req, res) => {
    runQuery(res, 'CREATE DATABASE easy_gig', [], (result) => {
        console.log(result);
        res.send('database created');
    });
});

// Create posts table
app.get('/createpoststable', (req, res) => {
    const sql = `CREATE TABLE IF NOT EXISTS posts(
        id int AUTO_INCREMENT,
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
        PRIMARY KEY(id)
        )`;

    runQuery(res, sql, [], (result) => {
        ensurePostsLocationColumns(db, (columnsErr) => {
            if (columnsErr) {
                console.error(columnsErr);
                sendError(res, 500, 'Database error');
                return;
            }
            console.log(result);
            res.send('posts table created');
        });
    });
});

// Create users table
app.get('/createuserstable', (req, res) => {
    const sql = `CREATE TABLE IF NOT EXISTS users(
        id int AUTO_INCREMENT,
        name VARCHAR(255),
        email VARCHAR(255),
        password VARCHAR(255),
        PRIMARY KEY(id)
        )`;

    runQuery(res, sql, [], (result) => {
        console.log(result);
        res.send('users table created');
    });
});

/* Table Modifications
app.get('/addSaltToUsers', (req, res) => {
    let sql = 'ALTER TABLE users ADD COLUMN salt VARCHAR(255)';
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send("salt column added to user table");
    });
});

app.get('/adduseridtoposts', (req, res) => {
    let sql = 'ALTER TABLE posts ADD COLUMN user_id INT';
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('user_id column added in the posts table');
    });
});

app.get('/addbidtoposts', (req, res) => {
    let sql = 'ALTER TABLE posts ADD COLUMN current_bid INT DEFAULT 0';
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('bid column added to posts table, with default value 0');
    });
});

app.get('/adddecimaltobid', (req, res) => {
    let sql = 'ALTER TABLE posts MODIFY current_bid DECIMAL(8, 2)';
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('bid type updated, now includes decimals, max 8 digits with two decimal places.');
    });
});
*/

// Insert
app.post('/api/adduser', (req, res) => {
    const body = req.body || {};
    const name = readField(res, textField(body.name, 'Name'));
    const email = readField(res, emailField(body.email));
    const password = readField(res, passwordField(body.password));
    if (name == null || email == null || password == null) {
        return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');

    rejectIfEmailTaken(res, email, null, () => {
        runQuery(
            res,
            'INSERT INTO users (name, email, password, salt) VALUES (?, ?, ?, ?)',
            [name, email, hash, salt],
            (result) => {
                console.log(result);
                res.json({ ok: true });
            }
        );
    });
});

app.post('/api/addpost', async (req, res) => {
    const body = req.body || {};
    const title = readField(res, textField(body.title, 'Title'));
    const description = readField(res, textField(body.description, 'Description'));
    const pay = readField(res, moneyField(body.pay, 'Pay'));
    const payType = readField(res, payTypeField(body.payType));
    const areaPlaceId = readField(res, placeIdField(body.areaPlaceId, 'City or service area', true));
    const areaSessionToken = readField(res, sessionTokenField(body.areaSessionToken));
    const addressPlaceId = readField(res, placeIdField(body.addressPlaceId, 'Address'));
    const addressSessionToken = readField(res, sessionTokenField(body.addressSessionToken));
    const addressVisibility = readField(res, addressVisibilityField(body.addressVisibility));
    if (res.headersSent || [title, description, pay, payType, areaPlaceId, addressVisibility].some((value) => value == null)) {
        return;
    }
    if (!placesConfigured()) {
        sendError(res, 503, 'Location lookup is not configured');
        return;
    }

    try {
        const areaPlace = await placeDetails(areaPlaceId, areaSessionToken);
        const areaKind = assertUsableArea(areaPlace);
        if (areaKind.error) {
            sendError(res, 400, areaKind.error);
            return;
        }

        if (areaKind.value === 'street') {
            sendError(
                res,
                400,
                'Choose a city or neighborhood for the service area. You can add the street address separately.'
            );
            return;
        }

        let addressPlace = null;
        if (addressPlaceId) {
            addressPlace = await placeDetails(addressPlaceId, addressSessionToken);
            if (!addressPlace.formattedAddress) {
                sendError(res, 400, 'Choose a specific address from the suggestions');
                return;
            }
        }

        if (addressPlace && !addressFitsArea(areaPlace, addressPlace)) {
            sendError(res, 400, 'That address is too far from the selected city or service area');
            return;
        }

        const location = publicLabel(areaPlace);
        if (!location) {
            sendError(res, 400, 'Choose a city or service area from the suggestions');
            return;
        }

        const visibility = addressPlace ? addressVisibility : DEFAULT_VISIBILITY;

        runQuery(
            res,
            `INSERT INTO posts (
                title, description, location, max_pay, type_of_pay, user_id,
                place_id, locality, neighborhood, admin_area, country, postal_code, lat, lng,
                address_place_id, address_formatted, address_lat, address_lng, address_visibility
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                description,
                location,
                pay,
                payType,
                req.userId,
                areaPlace.placeId,
                areaPlace.locality || null,
                areaPlace.neighborhood || null,
                areaPlace.admin_area || null,
                areaPlace.country || null,
                areaPlace.postal_code || null,
                areaPlace.lat,
                areaPlace.lng,
                addressPlace ? addressPlace.placeId : null,
                addressPlace ? addressPlace.formattedAddress : null,
                addressPlace ? addressPlace.lat : null,
                addressPlace ? addressPlace.lng : null,
                visibility,
            ],
            (result) => {
                res.json({
                    ok: true,
                    insertId: result.insertId,
                    location,
                    address_visibility: visibility,
                    has_precise_address: Boolean(addressPlace),
                });
            }
        );
    } catch (err) {
        sendError(res, err.status || 502, err.message || 'Location lookup failed');
    }
});

// Select
app.post('/api/signin', (req, res) => {
    const body = req.body || {};
    const email = readField(res, emailField(body.em));
    const password = readField(res, signinPassword(body.pw));
    if (email == null || password == null) {
        return;
    }

    runQuery(
        res,
        'SELECT id, salt, password, name FROM users WHERE email = ?',
        [email],
        (result) => {
            if (!result || result.length === 0) {
                res.json({ error: 'Invalid credentials' });
                return;
            }

            const user = findMatchingUser(result, password);
            if (!user) {
                res.json({ error: 'Invalid credentials' });
                return;
            }

            const previous = readSessionToken(req.headers.cookie);
            db.query(
                'DELETE FROM sessions WHERE expires_at <= NOW() OR token_hash = ?',
                [previous ? hashSessionToken(previous) : ''],
                (cleanupErr) => {
                    if (cleanupErr) {
                        console.error('session cleanup', cleanupErr.message);
                    }
                }
            );

            const token = newSessionToken();
            runQuery(
                res,
                `INSERT INTO sessions (token_hash, user_id, expires_at)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
                [hashSessionToken(token), user.id, SESSION_TTL_SECONDS],
                () => {
                    res.setHeader('Set-Cookie', sessionCookie(token, secureCookies));
                    res.json({
                        success: true,
                        name: user.name,
                        userId: user.id
                    });
                }
            );
        }
    );
});

app.post('/api/signout', (req, res) => {
    res.setHeader('Set-Cookie', clearSessionCookie(secureCookies));
    const token = readSessionToken(req.headers.cookie);
    if (!token) {
        res.json({ ok: true });
        return;
    }

    runQuery(res, 'DELETE FROM sessions WHERE token_hash = ?', [hashSessionToken(token)], () => {
        res.json({ ok: true });
    });
});

app.get('/api/me', (req, res) => {
    runQuery(
        res,
        'SELECT id, name, email FROM users WHERE id = ?',
        [req.userId],
        (result) => {
            if (result.length === 0) {
                res.setHeader('Set-Cookie', clearSessionCookie(secureCookies));
                sendError(res, 401, 'Sign in required');
                return;
            }
            res.json(result[0]);
        }
    );
});

app.get('/api/getuser', (req, res) => {
    const email = readField(res, emailField(req.query.email));
    if (email == null) {
        return;
    }

    runQuery(
        res,
        'SELECT name, email FROM users WHERE email = ?',
        [email],
        (result) => {
            res.json(result);
        }
    );
});

function sendRankedPosts(res, posts, search, mode, viewerId, origin) {
    const ranked = rankPosts(posts, search, mode);
    res.json({
        relevant: redactPosts(ranked.relevant, viewerId, origin),
        related: redactPosts(ranked.related, viewerId, origin),
    });
}

function searchPosts(mode, search, res, req) {
    runQuery(res, 'SELECT * FROM posts', [], (result) => {
        sendRankedPosts(res, result, search, mode, req.userId);
    });
}

function searchBy(mode, req, res) {
    const search = readField(res, searchField(req.query.search));
    if (search == null) {
        return;
    }
    searchPosts(mode, search, res, req);
}

async function searchByLocation(req, res) {
    const search = readField(res, searchField(req.query.search));
    const radius = readField(res, radiusField(req.query.radius));
    const placeId = readField(res, placeIdField(req.query.placeId, 'Place'));
    const sessionToken = readField(res, sessionTokenField(req.query.sessionToken));
    const lat = readField(res, latField(req.query.lat));
    const lng = readField(res, lngField(req.query.lng));
    if (res.headersSent) {
        return;
    }

    let origin = null;
    if (lat != null && lng != null) {
        origin = { lat, lng };
    } else if (placeId) {
        if (!placesConfigured()) {
            sendError(res, 503, 'Location lookup is not configured');
            return;
        }
        try {
            const place = await placeDetails(placeId, sessionToken);
            if (place.lat == null || place.lng == null) {
                sendError(res, 400, 'Could not locate that place');
                return;
            }
            origin = { lat: place.lat, lng: place.lng };
        } catch (err) {
            sendError(res, err.status || 502, err.message || 'Location lookup failed');
            return;
        }
    }

    runQuery(res, 'SELECT * FROM posts', [], (result) => {
        if (origin) {
            const nearby = filterByRadius(result, origin, radius);
            res.json({
                relevant: redactPosts(nearby, req.userId, origin),
                related: [],
            });
            return;
        }
        sendRankedPosts(res, result, search, 'location', req.userId);
    });
}

app.get('/api/getpostsbytitle', (req, res) => {
    searchBy('title', req, res);
});

app.get('/api/getpostsbylocation', (req, res) => {
    searchByLocation(req, res);
});

app.get('/api/getpostsbytype', (req, res) => {
    searchBy('type', req, res);
});

app.get('/api/getpostsbypay', (req, res) => {
    searchBy('pay', req, res);
});

app.get('/api/getpostsbyuserid', (req, res) => {
    const userId = readField(res, idField(req.query.user_id, 'User'));
    if (userId == null) {
        return;
    }

    runQuery(
        res,
        'SELECT * FROM posts WHERE user_id = ?',
        [userId],
        (result) => {
            res.json(redactPosts(result, req.userId));
        }
    );
});

app.get('/api/posts/:id/address', (req, res) => {
    const postId = readField(res, idField(req.params.id, 'Post'));
    if (postId == null) {
        return;
    }

    runQuery(res, 'SELECT * FROM posts WHERE id = ?', [postId], (rows) => {
        if (rows.length === 0) {
            sendError(res, 404, 'Post not found');
            return;
        }

        const post = rows[0];
        if (!post.address_formatted) {
            sendError(res, 404, 'No precise address for this gig');
            return;
        }

        const view = publicPostView(post, req.userId);
        if (!view.precise_address) {
            sendError(res, 403, 'Exact address is shared after you are hired');
            return;
        }

        res.json({
            address: view.precise_address,
            address_shared_when: view.address_shared_when,
            location: view.location,
        });
    });
});

// Update
app.get('/updatepost/:id', (req, res) => {
    const postId = readField(res, idField(req.params.id, 'Post'));
    if (postId == null) {
        return;
    }

    runQuery(
        res,
        'UPDATE posts SET title = ? WHERE id = ?',
        ['Updated Title', postId],
        (result) => {
            console.log(result);
            res.send('post1 updated');
        }
    );
});

app.put('/api/updatecurrentbid/:id', (req, res) => {
    const body = req.body || {};
    const postId = readField(res, idField(req.params.id, 'Post'));
    const bid = readField(res, moneyField(body.current_bid, 'Bid'));
    if (postId == null || bid == null) {
        return;
    }

    runQuery(res, 'SELECT * FROM posts WHERE id = ?', [postId], (rows) => {
        if (rows.length === 0) {
            sendError(res, 404, 'Post not found');
            return;
        }

        const post = rows[0];
        if (Number(post.user_id) === Number(req.userId)) {
            sendError(res, 400, 'You cannot bid on your own gig');
            return;
        }
        if (post.accepted_user_id) {
            sendError(res, 409, 'This gig already has a hired worker');
            return;
        }

        runQuery(
            res,
            'UPDATE posts SET current_bid = ?, current_bidder_id = ? WHERE id = ?',
            [bid, req.userId, postId],
            (result) => {
                res.json({
                    ok: true,
                    affectedRows: result.affectedRows,
                    location: post.location,
                    address_shared_when: post.address_formatted
                        ? post.address_visibility === 'public'
                            ? 'now'
                            : 'after_hire'
                        : null,
                });
            }
        );
    });
});

app.put('/api/acceptbid/:id', (req, res) => {
    const postId = readField(res, idField(req.params.id, 'Post'));
    if (postId == null) {
        return;
    }

    runQuery(
        res,
        'SELECT * FROM posts WHERE id = ? AND user_id = ?',
        [postId, req.userId],
        (rows) => {
            if (rows.length === 0) {
                sendError(res, 404, 'Post not found');
                return;
            }

            const post = rows[0];
            if (!post.current_bidder_id) {
                sendError(res, 400, 'This gig does not have a bidder to hire');
                return;
            }
            if (post.accepted_user_id) {
                sendError(res, 409, 'This gig already has a hired worker');
                return;
            }

            runQuery(
                res,
                'UPDATE posts SET accepted_user_id = ? WHERE id = ? AND user_id = ?',
                [post.current_bidder_id, postId, req.userId],
                () => {
                    res.json({
                        ok: true,
                        accepted_user_id: post.current_bidder_id,
                    });
                }
            );
        }
    );
});

app.put('/api/updateuser', (req, res) => {
    const body = req.body || {};
    const name = readField(res, textField(body.name, 'Name'));
    const email = readField(res, emailField(body.email));
    if (name == null || email == null) {
        return;
    }

    rejectIfEmailTaken(res, email, req.userId, () => {
        runQuery(
            res,
            'UPDATE users SET name = ?, email = ? WHERE id = ?',
            [name, email, req.userId],
            (result) => {
                res.json(result);
            }
        );
    });
});

function rejectIfEmailTaken(res, email, exceptUserId, onFree) {
    const sql = exceptUserId == null
        ? 'SELECT id FROM users WHERE email = ? LIMIT 1'
        : 'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1';
    const params = exceptUserId == null ? [email] : [email, exceptUserId];

    runQuery(res, sql, params, (existing) => {
        if (existing.length > 0) {
            sendError(res, 409, 'Email is already registered');
            return;
        }
        onFree();
    });
}

app.put('/api/updatePassword', (req, res) => {
    const body = req.body || {};
    const password = readField(res, passwordField(body.newPassword));
    if (password == null) {
        return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');

    runQuery(
        res,
        'UPDATE users SET password = ?, salt = ? WHERE id = ?',
        [hash, salt, req.userId],
        (result) => {
            runQuery(
                res,
                'DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?',
                [req.userId, req.sessionTokenHash],
                () => {
                    res.json(result);
                }
            );
        }
    );
});

// Testing
app.get('/selectusers', (req, res) => {
    runQuery(res, 'SELECT * FROM users', [], (result) => {
        console.log(result);
        res.send('users fetched');
    });
});

app.get('/selectposts', (req, res) => {
    runQuery(res, 'SELECT * FROM posts', [], (result) => {
        console.log(result);
        res.send('test post fetched');
    });
});

// Delete
app.delete('/deleteallusers', (req, res) => {
    runQuery(res, 'DELETE FROM users', [], (result) => {
        console.log(result);
        res.send('users deleted');
    });
});

app.delete('/api/deletepostbyid', (req, res) => {
    const body = req.body || {};
    const postId = readField(res, idField(body.postId, 'Post'));
    if (postId == null) {
        return;
    }

    runQuery(
        res,
        'DELETE FROM posts WHERE id = ? AND user_id = ?',
        [postId, req.userId],
        (result) => {
            if (result.affectedRows === 0) {
                sendError(res, 404, 'Post not found');
                return;
            }
            res.json(result);
        }
    );
});

app.delete('/api/deleteaccountbyid', (req, res) => {
    const userId = req.userId;
    runQuery(res, 'DELETE FROM posts WHERE user_id = ?', [userId], () => {
        runQuery(res, 'DELETE FROM sessions WHERE user_id = ?', [userId], () => {
            runQuery(res, 'DELETE FROM users WHERE id = ?', [userId], (result) => {
                res.setHeader('Set-Cookie', clearSessionCookie(secureCookies));
                res.json(result);
            });
        });
    });
});

app.delete('/api/deletealluserposts', (req, res) => {
    runQuery(res, 'DELETE FROM posts WHERE user_id = ?', [req.userId], (result) => {
        console.log(result);
        res.json(result);
    });
});

app.get('/deletepost/:id', (req, res) => {
    const postId = readField(res, idField(req.params.id, 'Post'));
    if (postId == null) {
        return;
    }

    runQuery(res, 'DELETE FROM posts WHERE id = ?', [postId], (result) => {
        console.log(result);
        res.send('post1 deleted');
    });
});

app.get('/deletespecificpostfortesting', (req, res) => {
    runQuery(res, 'DELETE FROM posts WHERE id = 3', [], (result) => {
        console.log(result);
        res.send('post deleted');
    });
});

app.use((err, req, res, next) => {
    if (res.headersSent) {
        next(err);
        return;
    }

    const status = Number(err.status || err.statusCode) || 500;
    let message = 'Server error';
    if (status === 400) {
        message = 'Invalid request';
    } else if (status === 413) {
        message = 'Request is too large';
    }

    console.error(err.message || err);
    res.status(status).json({ error: message });
});

// Listen
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
