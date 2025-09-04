// Bypassing nodemon: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
// res.json(data) to get the data and send it back to the front end as a result 
// use /api/name, response.json() to get the array to work with on the front end
// test1: name: Test One, email: testone@gmail.com, password: testonedavid
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

// Create 
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
        PRIMARY KEY(id
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

// Select
app.get('/api/getuser', (req, res) => {
    let sql = `SELECT id, password FROM users WHERE email = ?`;
    db.query(sql, [req.query.email], (err, result) => {
        if (err) throw err;
        res.json(result);
    })
});

app.get('/getposts', (req, res) => {
    let sql = "SELECT * FROM posts";
    let query = db.query(sql, (err, results) => {
        if (err) throw err;
        console.log(results);
        res.send("posts fetched");
    });

});

// Select individual 
app.get('/getpost1/:id', (req, res) => {
    let sql = `SELECT * FROM posts WHERE id = ${req.params.id}`;
    let query = db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send("post1 fetched");
    });
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

// Testing
app.get('/selecttestone', (req, res) => {
    let sql = "SELECT * FROM users";
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send("testone fetched");
    });
});

// Delete 
app.get('/deletepost/:id', (req, res) => {
    let sql = `DELETE FROM posts WHERE id = ${req.params.id}`;
    let query = db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send("post1 deleted");
    });
});

app.listen('3000', () => {
    console.log("Server started on port 3000");
});
