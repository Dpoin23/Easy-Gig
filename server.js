const mysql = require('mysql2');
const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { rankPosts } = require('./lib/searchRank');
const { passwordsMatch } = require('./lib/passwords');
const {
    textField,
    emailField,
    passwordField,
    signinPassword,
    idField,
    moneyField,
    payTypeField,
    searchField,
} = require('./lib/sanitize');

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
    const name = readField(res, textField(body.name, 'Name'));
    const email = readField(res, emailField(body.email));
    const password = readField(res, passwordField(body.password));
    if (name == null || email == null || password == null) {
        return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');

    runQuery(
        res,
        'INSERT INTO users (name, email, password, salt) VALUES (?, ?, ?, ?)',
        [name, email, hash, salt],
        (result) => {
            console.log(result);
            res.send('user added');
        }
    );
});

app.post('/api/addpost', (req, res) => {
    const body = req.body || {};
    const title = readField(res, textField(body.title, 'Title'));
    const description = readField(res, textField(body.description, 'Description'));
    const location = readField(res, textField(body.location, 'Location'));
    const pay = readField(res, moneyField(body.pay, 'Pay'));
    const payType = readField(res, payTypeField(body.payType));
    const userId = readField(res, idField(body.user_id, 'User'));
    if ([title, description, location, pay, payType, userId].some((value) => value == null)) {
        return;
    }

    runQuery(
        res,
        `INSERT INTO posts (title, description, location, max_pay, type_of_pay, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [title, description, location, pay, payType, userId],
        (result) => {
            console.log(result);
            res.json(result);
        }
    );
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

            const user = result[0];
            try {
                const derived = crypto.scryptSync(password, String(user.salt ?? ''), 64);
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
    const userId = readField(res, idField(req.query.userId, 'User'));
    if (userId == null) {
        return;
    }

    runQuery(
        res,
        'SELECT name, email FROM users WHERE id = ?',
        [userId],
        (result) => {
            res.json(result);
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

function searchPosts(mode, search, res) {
    runQuery(res, 'SELECT * FROM posts', [], (result) => {
        res.json(rankPosts(result, search, mode));
    });
}

function searchBy(mode, req, res) {
    const search = readField(res, searchField(req.query.search));
    if (search == null) {
        return;
    }
    searchPosts(mode, search, res);
}

app.get('/api/getpostsbytitle', (req, res) => {
    searchBy('title', req, res);
});

app.get('/api/getpostsbylocation', (req, res) => {
    searchBy('location', req, res);
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
            res.json(result);
        }
    );
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

    runQuery(
        res,
        'UPDATE posts SET current_bid = ? WHERE id = ?',
        [bid, postId],
        (result) => {
            console.log(result);
            res.json(result);
        }
    );
});

app.put('/api/updateuser', (req, res) => {
    const body = req.body || {};
    const name = readField(res, textField(body.name, 'Name'));
    const email = readField(res, emailField(body.email));
    const userId = readField(res, idField(body.user_id, 'User'));
    if (name == null || email == null || userId == null) {
        return;
    }

    runQuery(
        res,
        'UPDATE users SET name = ?, email = ? WHERE id = ?',
        [name, email, userId],
        (result) => {
            res.json(result);
        }
    );
});

app.put('/api/updatePassword', (req, res) => {
    const body = req.body || {};
    const password = readField(res, passwordField(body.newPassword));
    const userId = readField(res, idField(body.userId, 'User'));
    if (password == null || userId == null) {
        return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');

    runQuery(
        res,
        'UPDATE users SET password = ?, salt = ? WHERE id = ?',
        [hash, salt, userId],
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
    const postId = readField(res, idField(body.postId, 'Post'));
    if (postId == null) {
        return;
    }

    runQuery(res, 'DELETE FROM posts WHERE id = ?', [postId], (result) => {
        console.log(result);
        res.send(result);
    });
});

app.delete('/api/deleteaccountbyid', (req, res) => {
    const body = req.body || {};
    const userId = readField(res, idField(body.user_id, 'User'));
    if (userId == null) {
        return;
    }

    runQuery(res, 'DELETE FROM users WHERE id = ?', [userId], (result) => {
        console.log(result);
        res.send(result);
    });
});

app.delete('/api/deletealluserposts', (req, res) => {
    const body = req.body || {};
    const userId = readField(res, idField(body.user_id, 'User'));
    if (userId == null) {
        return;
    }

    runQuery(res, 'DELETE FROM posts WHERE user_id = ?', [userId], (result) => {
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
