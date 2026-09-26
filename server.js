const mysql = require('mysql2');
const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { rankPosts } = require('./lib/searchRank');
const { passwordsMatch } = require('./lib/passwords');

let dbReady = false;

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
    dbReady = true;
    console.log('mysql connected to easy_gig');
});

db.on('error', (err) => {
    dbReady = false;
    console.error('MySQL connection error:', err.message);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(express.static('public'));

// Throttle expensive DB-backed routes (CodeQL js/missing-rate-limiting)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(apiLimiter);

app.use('/api', (req, res, next) => {
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
        PRIMARY KEY(id)
        )`;

    runQuery(res, sql, [], (result) => {
        console.log(result);
        res.send('posts table created');
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
    let st;
    let hash;
    try {
        st = crypto.randomBytes(16).toString('hex');
        hash = crypto.scryptSync(body.password, st, 64).toString('hex');
    } catch (err) {
        console.error(err);
        return sendError(res, 400, 'Invalid account details');
    }

    const account = {
        name: body.name,
        email: body.email,
        password: hash,
        salt: st
    };

    runQuery(res, 'INSERT INTO users SET ?', account, (result) => {
        console.log(result);
        res.send('user added');
    });
});

app.post('/api/addpost', (req, res) => {
    const body = req.body || {};
    const post = {
        title: body.title,
        description: body.description,
        location: body.location,
        max_pay: body.pay,
        type_of_pay: body.payType,
        user_id: body.user_id
    };

    runQuery(res, 'INSERT INTO posts SET ?', post, (result) => {
        console.log(result);
        res.json(result);
    });
});

// Select
app.post('/api/signin', (req, res) => {
    const body = req.body || {};
    runQuery(
        res,
        'SELECT id, salt, password, name FROM users WHERE email = ?',
        [body.em],
        (result) => {
            if (!result || result.length === 0) {
                res.json({ error: 'Invalid credentials' });
                return;
            }

            const user = result[0];
            try {
                const derived = crypto.scryptSync(String(body.pw ?? ''), String(user.salt ?? ''), 64);
                if (!passwordsMatch(user.password, derived)) {
                    res.json({ error: 'Invalid credentials' });
                    return;
                }
            } catch (err) {
                console.error(err);
                sendError(res, 500, 'Server error');
                return;
            }

            res.json({
                success: true,
                name: user.name,
                userId: user.id,
                salt: user.salt
            });
        }
    );
});

app.get('/api/getUserData', (req, res) => {
    runQuery(
        res,
        'SELECT name, email, password FROM users WHERE id = ?',
        [req.query.userId],
        (result) => {
            res.json(result);
        }
    );
});

app.get('/api/getuser', (req, res) => {
    runQuery(
        res,
        'SELECT * FROM users WHERE email = ?',
        [req.query.email],
        (result) => {
            res.json(result);
        }
    );
});

function searchPosts(mode, search, res) {
    runQuery(res, 'SELECT * FROM posts', [], (result) => {
        res.json(rankPosts(result, search, mode));
    });
}

app.get('/api/getpostsbytitle', (req, res) => {
    searchPosts('title', req.query.search, res);
});

app.get('/api/getpostsbylocation', (req, res) => {
    searchPosts('location', req.query.search, res);
});

app.get('/api/getpostsbytype', (req, res) => {
    searchPosts('type', req.query.search, res);
});

app.get('/api/getpostsbypay', (req, res) => {
    searchPosts('pay', req.query.search, res);
});

app.get('/api/getpostsbyuserid', (req, res) => {
    runQuery(
        res,
        'SELECT * FROM posts WHERE user_id = ?',
        [req.query.user_id],
        (result) => {
            res.json(result);
        }
    );
});

// Update
app.get('/updatepost/:id', (req, res) => {
    runQuery(
        res,
        'UPDATE posts SET title = ? WHERE id = ?',
        ['Updated Title', req.params.id],
        (result) => {
            console.log(result);
            res.send('post1 updated');
        }
    );
});

app.put('/api/updatecurrentbid/:id', (req, res) => {
    const body = req.body || {};
    runQuery(
        res,
        'UPDATE posts SET current_bid = ? WHERE id = ?',
        [body.current_bid, req.params.id],
        (result) => {
            console.log(result);
            res.json(result);
        }
    );
});

app.put('/api/updateuser', (req, res) => {
    const body = req.body || {};
    runQuery(
        res,
        'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?',
        [body.name, body.email, body.password, body.user_id],
        (result) => {
            res.json(result);
        }
    );
});

app.put('/api/updatePassword', (req, res) => {
    const body = req.body || {};
    let st;
    let hash;
    try {
        st = crypto.randomBytes(16).toString('hex');
        hash = crypto.scryptSync(body.newPassword, st, 64).toString('hex');
    } catch (err) {
        console.error(err);
        return sendError(res, 400, 'Invalid password');
    }

    runQuery(
        res,
        'UPDATE users SET password = ?, salt = ? WHERE id = ?',
        [hash, st, body.userId],
        (result) => {
            console.log(result);
            res.json(result);
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
    runQuery(res, 'DELETE FROM posts WHERE id = ?', [body.postId], (result) => {
        console.log(result);
        res.send(result);
    });
});

app.delete('/api/deleteaccountbyid', (req, res) => {
    const body = req.body || {};
    runQuery(res, 'DELETE FROM users WHERE id = ?', [body.user_id], (result) => {
        console.log(result);
        res.send(result);
    });
});

app.delete('/api/deletealluserposts', (req, res) => {
    const body = req.body || {};
    runQuery(res, 'DELETE FROM posts WHERE user_id = ?', [body.user_id], (result) => {
        console.log(result);
        res.json(result);
    });
});

app.get('/deletepost/:id', (req, res) => {
    runQuery(res, 'DELETE FROM posts WHERE id = ?', [req.params.id], (result) => {
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
