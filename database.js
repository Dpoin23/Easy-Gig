const mysql = require('mysql2');
const express = require('express');
const cors = require('cors');

// Connect
var db = mysql.createConnection({
   host: 'localhost',
   user: 'root',
   password: 'Nextgen#23',
   database: 'easy_gig'
});

db.connect((err) => {
    if(err) throw err;
    console.log("mysql connected to easy_gig");
});

const app = express(); 
app.use(cors());
app.use(express.json());

// Create and alter
app.get('/createdb', (req, res) => {
    let sql = "CREATE DATABASE easy_gig";
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('database created');
    })
});

app.get('/createpoststable', (req, res) => {
    let sql = `CREATE TABLE IF NOT EXISTS posts(
        id int AUTO_INCREMENT,
        title VARCHAR(255),
        description VARCHAR(255),
        location VARCHAR(255),
        max_pay DECIMAL(8, 2),
        type_of_pay VARCHAR(255),
        PRIMARY KEY(id)
        )`;

    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('posts table created')
    });
});

app.get('/createuserstable', (req, res) => {
    let sql = `CREATE TABLE IF NOT EXISTS users(
        id int AUTO_INCREMENT,
        name VARCHAR(255),
        email VARCHAR(255),
        password VARCHAR(255),
        PRIMARY KEY(id)
        )`;

    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('users table created');
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

// Insert
app.post('/api/adduser', (req, res) => {
    let account = {
        name: req.body.name,
        email: req.body.email,
        password: req.body.password
    };

    let sql = "INSERT INTO users SET ?";
    db.query(sql, account, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send("user added");
    });
});

app.post('/api/addpost', (req, res) => {
    let post = {
        title: req.body.title,
        description: req.body.description,
        location: req.body.location,
        max_pay: req.body.pay,
        type_of_pay: req.body.payType,
        user_id: req.body.user_id
    };

    let sql = 'INSERT INTO posts SET ?';
    db.query(sql, post, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.json(result);
    })
})

// Select
app.get('/api/getuser', (req, res) => {
    let sql = `SELECT * FROM users WHERE email = ?`;
    db.query(sql, [req.query.email], (err, result) => {
        if (err) throw err;
        res.json(result);
    })
});

app.get('/api/getpostsbytitle', (req, res) => {
    let sql = `SELECT * FROM posts WHERE title = ?`;
    db.query(sql, req.query.search, (err, result) => {
        if (err) throw err;
        res.json(result);
    })
});

app.get('/api/getpostsbylocation', (req, res) => {
    let sql = `SELECT * FROM posts WHERE location = ?`;
    db.query(sql, req.query.search, (err, result) => {
        if (err) throw err;
        res.json(result);
    });
});

app.get('/api/getpostsbytype', (req, res) => {
    let sql = `SELECT * FROM posts WHERE type_of_pay = ?`;
    db.query(sql, req.query.search, (err, result) => {
        if (err) throw err;
        res.json(result);
    });
});

app.get('/api/getpostsbypay', (req, res) => {
    let sql = `SELECT * FROM posts WHERE max_pay = ?`;
    db.query(sql, req.query.search, (err, result) => {
        if (err) throw err;
        res.json(result);
    });
});

app.get('/api/getpostsbyuserid', (req, res) => {
    let sql = `SELECT * FROM posts WHERE user_id = ?`;
    db.query(sql, req.query.user_id, (err, result) => {
        if (err) throw err;
        res.json(result);
    })
});

// Update 
app.get('/updatepost/:id', (req, res) => {
    let newTitle = "Updated Title";
    let sql = `UPDATE posts SET title = '${newTitle}' WHERE id = ${req.params.id}`;
    let query = db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send("post1 updated");
    });
});

app.put('/api/updatecurrentbid/:id', (req, res) => {
    let sql = `UPDATE posts SET current_bid = ${req.body.current_bid} WHERE id = ${req.params.id}`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.json(result);
    });
})

app.put('/api/updateuser', (req, res) => {
    let sql = `UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?`;
    db.query(sql, [req.body.name, req.body.email, req.body.password, req.body.user_id], (err, result) => {
        if (err) throw err;
        console.log(result);
        res.json(result);
    });
});

// Testing
app.get('/selectusers', (req, res) => {
    let sql = "SELECT * FROM users";
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send("testone fetched");
    });
});

app.get('/selectposts', (req, res) => {
    let sql = "SELECT * FROM posts";
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('test post fetched');
    })
});

// Delete 
app.delete('/api/deletepostbyid', (req, res) => {
    let sql = 'DELETE FROM posts WHERE id = ?';
    db.query(sql, req.body.postId, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send(result);
    });
});

app.delete('/api/deleteaccountbyid', (req, res) => {
    let sql = 'DELETE FROM users WHERE id = ?';
    db.query(sql, req.body.user_id, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send(result);
    })
});

app.delete('/api/deletealluserposts', (req, res) => {
    let sql = `DELETE FROM posts WHERE user_id = ?`;
    db.query(sql, req.body.user_id, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.json(result);
    })
});

app.get('/deletepost/:id', (req, res) => {
    let sql = `DELETE FROM posts WHERE id = ${req.params.id}`;
    let query = db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send("post1 deleted");
    });
});

app.get('/deletespecificpostfortesting', (req, res) => {
    let sql = 'DELETE FROM posts WHERE id = 3';
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send('post deleted');
    });
});

// Listen
app.listen('3000', () => {
    console.log("Server started on port 3000");
});
