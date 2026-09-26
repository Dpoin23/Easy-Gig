'use strict';

const crypto = require('node:crypto');

function passwordsMatch(storedHex, derived) {
    if (typeof storedHex !== 'string' || !Buffer.isBuffer(derived)) {
        return false;
    }

    const stored = Buffer.from(storedHex, 'hex');
    if (stored.length === 0 || stored.length !== derived.length) {
        return false;
    }

    return crypto.timingSafeEqual(stored, derived);
}

module.exports = {
    passwordsMatch,
};
