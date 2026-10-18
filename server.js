const { loadEnv } = require('./lib/loadEnv');
loadEnv();

const mysql = require('mysql2');
const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const fs = require('node:fs');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const { rankPosts } = require('./lib/searchRank');
const { findMatchingUser } = require('./lib/passwords');
const { placesConfigured, autocomplete, placeDetails } = require('./lib/places');
const {
    publicLabel,
    publicPostView,
    redactPosts,
    filterByRadius,
    ensurePostsLocationColumns,
} = require('./lib/postLocation');
const { resolveGigLocation, INSERT_POST_SQL, insertPostParams } = require('./lib/resolveLocation');
const {
    validateBidAmount,
    leadingBid,
    lowestOtherAmount,
    bidsForPoster,
    profileGigs,
    ensureBidsTable,
} = require('./lib/bids');
const {
    MESSAGES_AFTER_SQL,
    INBOX_SQL,
    UNREAD_COUNT_SQL,
    messageBody,
    rejectOwnPost,
    conversationAccess,
    afterMessageId,
    inboxItem,
    publicMessage,
    publicConversation,
    deleteThreadsForPosts,
    ensureMessageTables,
} = require('./lib/messages');
const { dbConfig } = require('./lib/dbConfig');
const {
    SESSION_TTL_SECONDS,
    newSessionToken,
    hashSessionToken,
    readSessionToken,
    sessionCookie,
    clearSessionCookie,
} = require('./lib/sessions');
const {
    MAX_POST_IMAGES,
    MAX_IMAGE_BYTES,
    PHOTO_LIMIT_MESSAGE,
    PHOTO_SIZE_MESSAGE,
    imageDirectory,
    contentTypeForName,
    imageFilePath,
    attachImages,
    reviewUploads,
    writeImages,
    removeStoredFiles,
    ensurePostImagesTable,
    publicImageList,
} = require('./lib/postImages');
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
const IMAGE_DIR = imageDirectory(__dirname);

try {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
} catch (err) {
    console.error('Could not create photo directory:', err.message);
}

const uploadPostImages = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: MAX_POST_IMAGES,
        fileSize: MAX_IMAGE_BYTES,
        fields: 16,
        fieldSize: 2048,
        parts: MAX_POST_IMAGES + 16,
    },
});

// Connect
var db = mysql.createConnection(dbConfig());

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
                ensureBidsTable(db, (bidsErr) => {
                    if (bidsErr) {
                        console.error('Could not create bids table:', bidsErr.message);
                        return;
                    }
                    ensurePostImagesTable(db, (imagesErr) => {
                        if (imagesErr) {
                            console.error('Could not create post images table:', imagesErr.message);
                            return;
                        }
                        ensureMessageTables(db, (messagesErr) => {
                            if (messagesErr) {
                                console.error('Could not create message tables:', messagesErr.message);
                                return;
                            }
                            dbReady = true;
                            console.log('mysql connected to easy_gig');
                        });
                    });
                });
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
const pollLimiter = limiter(20, 60 * 1000);

function messagingLimiter(req, res, next) {
    const path = req.path;
    const threadMessages = /^\/api\/conversations\/\d+\/messages$/.test(path);
    if ((req.method === 'GET' && threadMessages) || (req.method === 'GET' && path === '/api/messages/unread-count')) {
        return pollLimiter(req, res, next);
    }
    if (
        (req.method === 'POST' && (path === '/api/conversations' || threadMessages))
        || (req.method === 'PUT' && /^\/api\/conversations\/\d+\/read$/.test(path))
    ) {
        return writeLimiter(req, res, next);
    }
    if (req.method === 'GET' && path === '/api/conversations') {
        return readLimiter(req, res, next);
    }
    next();
}

for (const path of ['/api/adduser', '/api/signin', '/api/updatePassword']) {
    app.use(path, authLimiter);
}
for (const path of [
    '/api/addpost',
    '/api/updatecurrentbid',
    '/api/acceptbid',
    '/api/bidders',
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
    '/api/bidders',
]) {
    app.use(path, readLimiter);
}
for (const path of ['/api/places/autocomplete', '/api/places/details']) {
    app.use(path, placesLimiter);
}
app.use(messagingLimiter);
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
    '/api/bidders',
    '/api/updateuser',
    '/api/updatePassword',
    '/api/deletepostbyid',
    '/api/deleteaccountbyid',
    '/api/deletealluserposts',
    '/api/posts',
    '/api/conversations',
    '/api/messages/unread-count',
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

function acceptPostImages(req, res, next) {
    const type = String(req.headers['content-type'] || '');
    if (!type.includes('multipart/form-data')) {
        next();
        return;
    }

    uploadPostImages.array('images', MAX_POST_IMAGES)(req, res, (err) => {
        if (!err) {
            next();
            return;
        }
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                sendError(res, 400, PHOTO_SIZE_MESSAGE);
                return;
            }
            if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
                sendError(res, 400, PHOTO_LIMIT_MESSAGE);
                return;
            }
        }
        sendError(res, 400, 'Could not read the photos');
    });
}

function withPostImages(posts, done) {
    const list = posts || [];
    const ids = [...new Set(list.map((post) => Number(post.id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (ids.length === 0) {
        done(null, attachImages(list, []));
        return;
    }
    const marks = ids.map(() => '?').join(', ');
    db.query(
        `SELECT id, post_id, stored_name, sort_order
         FROM post_images
         WHERE post_id IN (${marks})
         ORDER BY sort_order ASC, id ASC`,
        ids,
        (err, rows) => {
            if (err) {
                done(err);
                return;
            }
            done(null, attachImages(list, rows));
        }
    );
}

function purgePostImages(postIds, done) {
    const ids = [...new Set((postIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (ids.length === 0) {
        done(null);
        return;
    }
    const marks = ids.map(() => '?').join(', ');
    db.query(
        `SELECT stored_name FROM post_images WHERE post_id IN (${marks})`,
        ids,
        (selectErr, rows) => {
            if (selectErr) {
                done(selectErr);
                return;
            }
            db.query(
                `DELETE FROM post_images WHERE post_id IN (${marks})`,
                ids,
                (deleteErr) => {
                    if (!deleteErr) {
                        removeStoredFiles(IMAGE_DIR, (rows || []).map((row) => row.stored_name));
                    }
                    done(deleteErr || null);
                }
            );
        }
    );
}

function discardNewPost(postId, storedNames, done) {
    removeStoredFiles(IMAGE_DIR, storedNames);
    db.query('DELETE FROM post_images WHERE post_id = ?', [postId], () => {
        db.query('DELETE FROM posts WHERE id = ?', [postId], () => done());
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

app.get('/uploads/posts/:name', (req, res) => {
    const storedName = req.params.name;
    const filePath = imageFilePath(IMAGE_DIR, storedName);
    const contentType = contentTypeForName(storedName);
    if (!filePath || !contentType) {
        res.status(404).end();
        return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath, { dotfiles: 'deny' }, (err) => {
        if (err && !res.headersSent) {
            res.status(404).end();
        }
    });
});

app.post('/api/addpost', acceptPostImages, async (req, res) => {
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

    const uploads = (req.files || []).filter((file) => file && file.buffer && file.buffer.length > 0);
    const reviewed = reviewUploads(uploads, 0);
    if (reviewed.error) {
        sendError(res, reviewed.status || 400, reviewed.error);
        return;
    }

    if (!placesConfigured()) {
        sendError(res, 503, 'Location lookup is not configured');
        return;
    }

    try {
        const resolved = await resolveGigLocation({
            areaPlaceId,
            areaSessionToken,
            addressPlaceId,
            addressSessionToken,
            addressVisibility,
        });
        if (resolved.error) {
            sendError(res, 400, resolved.error);
            return;
        }

        const { location, address, visibility } = resolved.value;
        runQuery(
            res,
            INSERT_POST_SQL,
            insertPostParams({ title, description, pay, payType, userId: req.userId }, resolved.value),
            (result) => {
                const postId = result.insertId;
                const created = {
                    ok: true,
                    insertId: postId,
                    location,
                    address_visibility: visibility,
                    has_precise_address: Boolean(address),
                    images: [],
                };
                if (reviewed.value.length === 0) {
                    res.json(created);
                    return;
                }

                writeImages(IMAGE_DIR, reviewed.value, 0).then((written) => {
                    if (written.error) {
                        discardNewPost(postId, [], () => {
                            sendError(res, 500, written.error);
                        });
                        return;
                    }

                    const marks = written.value.map(() => '(?, ?, ?)').join(', ');
                    const params = [];
                    for (const image of written.value) {
                        params.push(postId, image.stored_name, image.sort_order);
                    }
                    db.query(
                        `INSERT INTO post_images (post_id, stored_name, sort_order) VALUES ${marks}`,
                        params,
                        (insertErr) => {
                            if (insertErr) {
                                console.error(insertErr.code || 'query', insertErr.message);
                                discardNewPost(postId, written.value.map((image) => image.stored_name), () => {
                                    sendError(res, 500, 'Could not save photos');
                                });
                                return;
                            }
                            created.images = publicImageList(written.value);
                            res.json(created);
                        }
                    );
                }).catch((err) => {
                    console.error(err);
                    discardNewPost(postId, [], () => {
                        sendError(res, 500, 'Could not save photos');
                    });
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

function withConversation(res, conversationId, userId, onOk) {
    runQuery(
        res,
        'SELECT id, post_id, poster_id, worker_id FROM conversations WHERE id = ?',
        [conversationId],
        (rows) => {
            const access = conversationAccess(rows[0], userId);
            if (access.error) {
                sendError(res, access.status, access.error);
                return;
            }
            onOk(access.conversation);
        }
    );
}

function removeThreads(res, postIds, onOk) {
    deleteThreadsForPosts(db, postIds, (err) => {
        if (err) {
            console.error(err.code || 'query', err.message);
            sendError(res, 500, 'Database error');
            return;
        }
        onOk();
    });
}

app.post('/api/conversations', (req, res) => {
    const postId = readField(res, idField((req.body || {}).postId, 'Post'));
    if (postId == null) {
        return;
    }

    runQuery(res, 'SELECT id, user_id FROM posts WHERE id = ?', [postId], (posts) => {
        if (posts.length === 0) {
            sendError(res, 404, 'Post not found');
            return;
        }
        const rejected = rejectOwnPost(posts[0].user_id, req.userId);
        if (rejected) {
            sendError(res, rejected.status, rejected.error);
            return;
        }

        const posterId = posts[0].user_id;
        const existingSql = 'SELECT id, post_id, poster_id, worker_id FROM conversations WHERE post_id = ? AND worker_id = ?';
        runQuery(res, existingSql, [postId, req.userId], (existing) => {
            if (existing.length > 0) {
                res.json(publicConversation(existing[0]));
                return;
            }

            db.query(
                'INSERT INTO conversations (post_id, poster_id, worker_id) VALUES (?, ?, ?)',
                [postId, posterId, req.userId],
                (err, result) => {
                    if (err && err.code === 'ER_DUP_ENTRY') {
                        runQuery(res, existingSql, [postId, req.userId], (rows) => {
                            if (rows.length === 0) {
                                sendError(res, 500, 'Database error');
                                return;
                            }
                            res.json(publicConversation(rows[0]));
                        });
                        return;
                    }
                    if (err) {
                        console.error(err.code || 'query', err.message);
                        sendError(res, 500, 'Database error');
                        return;
                    }
                    res.status(201).json(publicConversation({
                        id: result.insertId,
                        post_id: postId,
                        poster_id: posterId,
                        worker_id: req.userId,
                    }));
                }
            );
        });
    });
});

app.get('/api/conversations', (req, res) => {
    runQuery(
        res,
        INBOX_SQL,
        [req.userId, req.userId, req.userId, req.userId],
        (rows) => {
            res.json({ conversations: rows.map((row) => inboxItem(row, req.userId)) });
        }
    );
});

app.get('/api/conversations/:id/messages', (req, res) => {
    const conversationId = readField(res, idField(req.params.id, 'Conversation'));
    if (conversationId == null) {
        return;
    }
    const after = readField(res, afterMessageId(req.query.after));
    if (after == null) {
        return;
    }

    withConversation(res, conversationId, req.userId, () => {
        runQuery(res, MESSAGES_AFTER_SQL, [conversationId, after], (rows) => {
            res.json({ messages: rows.map((row) => publicMessage(row, req.userId)) });
        });
    });
});

app.post('/api/conversations/:id/messages', (req, res) => {
    const conversationId = readField(res, idField(req.params.id, 'Conversation'));
    if (conversationId == null) {
        return;
    }
    const body = readField(res, messageBody((req.body || {}).body));
    if (body == null) {
        return;
    }

    withConversation(res, conversationId, req.userId, () => {
        db.query(
            'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
            [conversationId, req.userId, body],
            (err, result) => {
                if (err) {
                    console.error(err.code || 'query', err.message);
                    sendError(res, 500, 'Database error');
                    return;
                }
                runQuery(
                    res,
                    'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [conversationId],
                    () => {
                        runQuery(
                            res,
                            'SELECT id, sender_id, body, created_at, read_at FROM messages WHERE id = ?',
                            [result.insertId],
                            (rows) => {
                                res.status(201).json(publicMessage(rows[0], req.userId));
                            }
                        );
                    }
                );
            }
        );
    });
});

app.put('/api/conversations/:id/read', (req, res) => {
    const conversationId = readField(res, idField(req.params.id, 'Conversation'));
    if (conversationId == null) {
        return;
    }

    withConversation(res, conversationId, req.userId, () => {
        runQuery(
            res,
            `UPDATE messages
             SET read_at = CURRENT_TIMESTAMP
             WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL`,
            [conversationId, req.userId],
            () => {
                res.json({ ok: true });
            }
        );
    });
});

app.get('/api/messages/unread-count', (req, res) => {
    runQuery(res, UNREAD_COUNT_SQL, [req.userId, req.userId, req.userId], (rows) => {
        res.json({ unread: Number(rows[0] && rows[0].unread) || 0 });
    });
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
    withPostImages(posts, (err, ready) => {
        if (err) {
            console.error(err.code || 'query', err.message);
            sendError(res, 500, 'Database error');
            return;
        }
        const ranked = rankPosts(ready, search, mode);
        res.json({
            relevant: redactPosts(ranked.relevant, viewerId, origin),
            related: redactPosts(ranked.related, viewerId, origin),
        });
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
            withPostImages(nearby, (err, ready) => {
                if (err) {
                    console.error(err.code || 'query', err.message);
                    sendError(res, 500, 'Database error');
                    return;
                }
                res.json({
                    relevant: redactPosts(ready, req.userId, origin),
                    related: [],
                });
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
        `SELECT posts.*,
            (SELECT COUNT(*) FROM bids WHERE bids.post_id = posts.id) AS bid_count
         FROM posts
         WHERE user_id = ?`,
        [userId],
        (result) => {
            withPostImages(result, (err, ready) => {
                if (err) {
                    console.error(err.code || 'query', err.message);
                    sendError(res, 500, 'Database error');
                    return;
                }
                res.json(redactPosts(ready, req.userId));
            });
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

function refreshLeadingBid(res, postId, onDone) {
    runQuery(
        res,
        'SELECT id, user_id, amount FROM bids WHERE post_id = ?',
        [postId],
        (rows) => {
            const lead = leadingBid(rows);
            runQuery(
                res,
                'UPDATE posts SET current_bid = ?, current_bidder_id = ? WHERE id = ? AND accepted_user_id IS NULL',
                [lead ? lead.amount : 0, lead ? lead.user_id : null, postId],
                () => onDone()
            );
        }
    );
}

function refreshLeadingBids(res, postIds, onDone) {
    const next = (index) => {
        if (index >= postIds.length) {
            onDone();
            return;
        }
        refreshLeadingBid(res, postIds[index], () => next(index + 1));
    };
    next(0);
}

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
            'SELECT id, user_id, amount FROM bids WHERE post_id = ?',
            [postId],
            (existing) => {
                const own = existing.find((row) => Number(row.user_id) === Number(req.userId));
                const decision = validateBidAmount({
                    maxPay: post.max_pay,
                    amount: bid,
                    lowestOtherBid: lowestOtherAmount(existing, req.userId),
                    ownBid: own ? own.amount : null,
                });
                if (decision.error) {
                    sendError(res, 400, decision.error);
                    return;
                }

                runQuery(
                    res,
                    `INSERT INTO bids (post_id, user_id, amount) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
                    [postId, req.userId, decision.value],
                    () => {
                        refreshLeadingBid(res, postId, () => {
                            res.json({
                                ok: true,
                                amount: decision.value,
                                location: post.location,
                                address_shared_when: post.address_formatted
                                    ? post.address_visibility === 'public'
                                        ? 'now'
                                        : 'after_hire'
                                    : null,
                            });
                        });
                    }
                );
            }
        );
    });
});

app.get('/api/posts/:id/bids', (req, res) => {
    const postId = readField(res, idField(req.params.id, 'Post'));
    if (postId == null) {
        return;
    }

    runQuery(
        res,
        'SELECT id, user_id, accepted_user_id, title FROM posts WHERE id = ? AND user_id = ?',
        [postId, req.userId],
        (posts) => {
            if (posts.length === 0) {
                sendError(res, 404, 'Post not found');
                return;
            }

            const post = posts[0];
            runQuery(
                res,
                `SELECT bids.id, bids.user_id, bids.amount, bids.created_at, users.name
                 FROM bids
                 INNER JOIN users ON users.id = bids.user_id
                 WHERE bids.post_id = ?`,
                [postId],
                (bids) => {
                    res.json({
                        post_id: postId,
                        title: post.title,
                        accepted_user_id: post.accepted_user_id || null,
                        bids: bidsForPoster(bids, post.accepted_user_id),
                    });
                }
            );
        }
    );
});

app.get('/api/bidders/:userId', (req, res) => {
    const bidderId = readField(res, idField(req.params.userId, 'Bidder'));
    const postId = readField(res, idField(req.query.post_id, 'Post'));
    if (bidderId == null || postId == null) {
        return;
    }

    runQuery(
        res,
        'SELECT id, user_id, title, accepted_user_id FROM posts WHERE id = ? AND user_id = ?',
        [postId, req.userId],
        (posts) => {
            if (posts.length === 0) {
                sendError(res, 404, 'Post not found');
                return;
            }

            const post = posts[0];
            runQuery(
                res,
                `SELECT bids.id, bids.amount, bids.created_at, users.name
                 FROM bids
                 INNER JOIN users ON users.id = bids.user_id
                 WHERE bids.post_id = ? AND bids.user_id = ?`,
                [postId, bidderId],
                (bids) => {
                    if (bids.length === 0) {
                        sendError(res, 404, 'That person has not bid on this gig');
                        return;
                    }

                    const bid = bids[0];
                    runQuery(
                        res,
                        'SELECT * FROM posts WHERE user_id = ? ORDER BY id DESC',
                        [bidderId],
                        (posted) => {
                            runQuery(
                                res,
                                'SELECT * FROM posts WHERE accepted_user_id = ? ORDER BY id DESC',
                                [bidderId],
                                (selected) => {
                                    withPostImages(posted, (postedErr, postedReady) => {
                                        if (postedErr) {
                                            console.error(postedErr.code || 'query', postedErr.message);
                                            sendError(res, 500, 'Database error');
                                            return;
                                        }
                                        withPostImages(selected, (selectedErr, selectedReady) => {
                                            if (selectedErr) {
                                                console.error(selectedErr.code || 'query', selectedErr.message);
                                                sendError(res, 500, 'Database error');
                                                return;
                                            }
                                            res.json({
                                                id: bidderId,
                                                name: bid.name,
                                                post_id: postId,
                                                post_title: post.title,
                                                can_hire: !post.accepted_user_id,
                                                hired: Number(post.accepted_user_id) === Number(bidderId),
                                                bid: {
                                                    id: bid.id,
                                                    amount: Number(bid.amount),
                                                    created_at: bid.created_at,
                                                },
                                                posted_gigs: profileGigs(postedReady, req.userId),
                                                selected_gigs: profileGigs(selectedReady, req.userId),
                                            });
                                        });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

app.get('/api/me/selected', (req, res) => {
    runQuery(
        res,
        'SELECT * FROM posts WHERE accepted_user_id = ? ORDER BY id DESC',
        [req.userId],
        (rows) => {
            withPostImages(rows, (err, ready) => {
                if (err) {
                    console.error(err.code || 'query', err.message);
                    sendError(res, 500, 'Database error');
                    return;
                }
                res.json(profileGigs(ready, req.userId));
            });
        }
    );
});

app.put('/api/acceptbid/:id', (req, res) => {
    const body = req.body || {};
    const postId = readField(res, idField(req.params.id, 'Post'));
    if (postId == null) {
        return;
    }

    let chosenUserId = null;
    if (body.user_id != null && body.user_id !== '') {
        chosenUserId = readField(res, idField(body.user_id, 'Bidder'));
        if (chosenUserId == null) {
            return;
        }
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
            if (post.accepted_user_id) {
                sendError(res, 409, 'This gig already has a hired worker');
                return;
            }

            const targetUserId = chosenUserId || post.current_bidder_id;
            if (!targetUserId) {
                sendError(res, 400, 'This gig does not have a bidder to hire');
                return;
            }

            runQuery(
                res,
                'SELECT id, user_id, amount FROM bids WHERE post_id = ? AND user_id = ?',
                [postId, targetUserId],
                (bids) => {
                    if (bids.length === 0) {
                        sendError(res, 404, 'That person has not bid on this gig');
                        return;
                    }

                    const bid = bids[0];
                    runQuery(
                        res,
                        `UPDATE posts
                         SET accepted_user_id = ?, current_bidder_id = ?, current_bid = ?
                         WHERE id = ? AND user_id = ? AND accepted_user_id IS NULL`,
                        [bid.user_id, bid.user_id, bid.amount, postId, req.userId],
                        (result) => {
                            if (result.affectedRows === 0) {
                                sendError(res, 409, 'This gig already has a hired worker');
                                return;
                            }
                            res.json({
                                ok: true,
                                accepted_user_id: bid.user_id,
                                amount: Number(bid.amount),
                            });
                        }
                    );
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
        'SELECT id FROM posts WHERE id = ? AND user_id = ?',
        [postId, req.userId],
        (posts) => {
            if (posts.length === 0) {
                sendError(res, 404, 'Post not found');
                return;
            }
            removeThreads(res, [postId], () => {
            runQuery(res, 'DELETE FROM bids WHERE post_id = ?', [postId], () => {
                purgePostImages([postId], (purgeErr) => {
                    if (purgeErr) {
                        console.error(purgeErr.code || 'query', purgeErr.message);
                        sendError(res, 500, 'Database error');
                        return;
                    }
                    runQuery(
                        res,
                        'DELETE FROM posts WHERE id = ? AND user_id = ?',
                        [postId, req.userId],
                        (result) => {
                            res.json(result);
                        }
                    );
                });
            });
            });
        }
    );
});

app.delete('/api/deleteaccountbyid', (req, res) => {
    const userId = req.userId;
    runQuery(
        res,
        'SELECT DISTINCT post_id FROM bids WHERE user_id = ?',
        [userId],
        (bidPosts) => {
            const postIds = bidPosts.map((row) => row.post_id);
            runQuery(res, 'DELETE FROM bids WHERE user_id = ?', [userId], () => {
                runQuery(
                    res,
                    `DELETE bids FROM bids
                     INNER JOIN posts ON posts.id = bids.post_id
                     WHERE posts.user_id = ?`,
                    [userId],
                    () => {
                        runQuery(res, 'SELECT id FROM posts WHERE user_id = ?', [userId], (owned) => {
                            // Threads on this person's gigs go away with the posts.
                            // Threads where they were the worker stay, so the poster still has the record.
                            removeThreads(res, owned.map((row) => row.id), () => {
                            purgePostImages(owned.map((row) => row.id), (purgeErr) => {
                                if (purgeErr) {
                                    console.error(purgeErr.code || 'query', purgeErr.message);
                                    sendError(res, 500, 'Database error');
                                    return;
                                }
                                runQuery(res, 'DELETE FROM posts WHERE user_id = ?', [userId], () => {
                                    refreshLeadingBids(res, postIds, () => {
                                        runQuery(res, 'DELETE FROM sessions WHERE user_id = ?', [userId], () => {
                                            runQuery(res, 'DELETE FROM users WHERE id = ?', [userId], (result) => {
                                                res.setHeader('Set-Cookie', clearSessionCookie(secureCookies));
                                                res.json(result);
                                            });
                                        });
                                    });
                                });
                            });
                            });
                        });
                    }
                );
            });
        }
    );
});

app.delete('/api/deletealluserposts', (req, res) => {
    runQuery(res, 'SELECT id FROM posts WHERE user_id = ?', [req.userId], (owned) => {
        const ids = owned.map((row) => row.id);
        removeThreads(res, ids, () => {
        runQuery(
            res,
            `DELETE bids FROM bids
             INNER JOIN posts ON posts.id = bids.post_id
             WHERE posts.user_id = ?`,
            [req.userId],
            () => {
                purgePostImages(ids, (purgeErr) => {
                    if (purgeErr) {
                        console.error(purgeErr.code || 'query', purgeErr.message);
                        sendError(res, 500, 'Database error');
                        return;
                    }
                    runQuery(res, 'DELETE FROM posts WHERE user_id = ?', [req.userId], (result) => {
                        res.json(result);
                    });
                });
            }
        );
        });
    });
});

app.get('/deletepost/:id', (req, res) => {
    const postId = readField(res, idField(req.params.id, 'Post'));
    if (postId == null) {
        return;
    }

    removeThreads(res, [postId], () => {
    runQuery(res, 'DELETE FROM bids WHERE post_id = ?', [postId], () => {
        purgePostImages([postId], () => {
            runQuery(res, 'DELETE FROM posts WHERE id = ?', [postId], (result) => {
                console.log(result);
                res.send('post1 deleted');
            });
        });
    });
    });
});

app.get('/deletespecificpostfortesting', (req, res) => {
    removeThreads(res, [3], () => {
    purgePostImages([3], () => {
        runQuery(res, 'DELETE FROM posts WHERE id = 3', [], (result) => {
            console.log(result);
            res.send('post deleted');
        });
    });
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
