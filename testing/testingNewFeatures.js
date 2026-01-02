const crypto = require("node:crypto");

function testHashing(password) {
    console.log("Testing password: ", password);

    const scrypt = crypto.scrypt;
    scrypt(password, 'salt', 64, (err, derivedKey) => {
        if (err) throw err;
        console.log(derivedKey.toString('hex'));
    });

};

function testSaltAndHash(password) {
    console.log("Testing password: ", password);

    const salt = crypto.randomBytes(16).toString('hex');
    console.log("Salt: ", salt);

    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    console.log("Hash: ", hash);
}
