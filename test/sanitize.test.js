const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    textField,
    emailField,
    passwordField,
    idField,
    moneyField,
    payTypeField,
    searchField,
} = require('../lib/sanitize');

describe('sanitize', () => {
    it('trims text and rejects values past the column size', () => {
        assert.deepEqual(textField('  Lawn mowing  ', 'Title'), { value: 'Lawn mowing' });
        assert.equal(textField('x'.repeat(256), 'Title').error, 'Title is too long');
        assert.equal(textField(12, 'Title').error, 'Title is required');
    });

    it('accepts a normal email and rejects one with spaces', () => {
        assert.deepEqual(emailField(' Alex@Example.com '), { value: 'Alex@Example.com' });
        assert.equal(emailField('not-an-email').error, 'Email is invalid');
    });

    it('requires an 8 to 64 character password', () => {
        assert.equal(passwordField('short').error, 'Password must be 8 to 64 characters');
        assert.deepEqual(passwordField('password123'), { value: 'password123' });
    });

    it('accepts only positive integer ids', () => {
        assert.deepEqual(idField('4', 'User'), { value: 4 });
        assert.equal(idField('4abc', 'User').error, 'User is invalid');
        assert.equal(idField('-1', 'User').error, 'User is invalid');
        assert.equal(idField('1 OR 1=1', 'User').error, 'User is invalid');
    });

    it('keeps pay inside the decimal column and allow-lists pay type', () => {
        assert.deepEqual(moneyField('40.129', 'Pay'), { value: 40.13 });
        assert.equal(moneyField('-5', 'Pay').error, 'Pay is invalid');
        assert.equal(moneyField('1000000', 'Pay').error, 'Pay is invalid');
        assert.deepEqual(payTypeField('Hourly'), { value: 'hourly' });
        assert.equal(payTypeField('weekly').error, 'Pay type is invalid');
    });

    it('caps search text and treats a missing search as empty', () => {
        assert.deepEqual(searchField(undefined), { value: '' });
        assert.equal(searchField('mow '.repeat(80)).error, 'Search is too long');
        assert.equal(searchField(['mow']).error, 'Search must be text');
    });
});
