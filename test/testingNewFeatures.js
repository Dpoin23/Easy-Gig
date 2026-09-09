const crypto = require('node:crypto');

function testHashing(password) {
  const scrypt = crypto.scrypt;
  scrypt(password, 'salt', 64, (err, derivedKey) => {
    if (err) throw err;
    return derivedKey.toString('hex');
  });
}

function testSaltAndHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

module.exports = { testHashing, testSaltAndHash };
