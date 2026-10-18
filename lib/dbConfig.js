'use strict';

function dbConfig({ withDatabase = true } = {}) {
    const config = {
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD ?? 'Nextgen#23',
    };
    if (withDatabase) {
        config.database = databaseName();
    }
    return config;
}

function databaseName() {
    return process.env.MYSQL_DATABASE || 'easy_gig';
}

module.exports = { dbConfig, databaseName };
