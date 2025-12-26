const crypto = require("node:crypto");

function testHashing(password) {
    console.log("Testing password: ", password);

    const scrypt = crypto.scrypt;
    scrypt(password, 'salt', 64, (err, derivedKey) => {
        if (err) throw err;
        console.log(derivedKey.toString('hex'));
    });

};

testHashing("passington");
testHashing("Antoehr4195u34959");
