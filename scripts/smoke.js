#!/usr/bin/env node
'use strict';

/**
 * Starts the server briefly and verifies static + API plumbing.
 * MySQL is optional — API may return 503 when the DB is down.
 */
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const PORT = Number(process.env.SMOKE_PORT) || 3456;
const ROOT = path.resolve(__dirname, '..');
const START_MS = 8000;
const REQ_MS = 5000;

function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: pathname,
        method: options.method || 'GET',
        timeout: REQ_MS,
        headers: options.headers,
      },
      (res) => {
        res.resume();
        resolve({ statusCode: res.statusCode, headers: res.headers });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`timeout requesting ${pathname}`));
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function waitForLog(child, needle, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for: ${needle}`));
    }, timeoutMs);

    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString();
      if (buf.includes(needle)) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolve();
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}`));
    });
  });
}

async function main() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let failed = false;
  try {
    await waitForLog(child, `Server started on port ${PORT}`, START_MS);

    const home = await request('/');
    if (home.statusCode !== 200) {
      throw new Error(`GET / expected 200, got ${home.statusCode}`);
    }
    const missingPhoto = await request('/uploads/posts/not-a-real-photo');
    if (missingPhoto.statusCode !== 404) {
      throw new Error(`GET missing gig photo expected 404, got ${missingPhoto.statusCode}`);
    }
    if (home.headers['ratelimit-limit']) {
      throw new Error('static files should not be rate limited');
    }

    const api = await request('/api/getpostsbytitle?search=smoke');
    if (![200, 503].includes(api.statusCode)) {
      throw new Error(`GET /api/getpostsbytitle expected 200 or 503, got ${api.statusCode}`);
    }
    if (api.headers['ratelimit-limit'] !== '60') {
      throw new Error(`search rate limit expected 60, got ${api.headers['ratelimit-limit']}`);
    }

    const badBody = 'not-json';
    const badJson = await request('/api/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(badBody)),
      },
      body: badBody,
    });
    if (badJson.statusCode !== 400) {
      throw new Error(`POST /api/signin with invalid JSON expected 400, got ${badJson.statusCode}`);
    }
    if (badJson.headers['ratelimit-limit'] !== '10') {
      throw new Error(`auth rate limit expected 10, got ${badJson.headers['ratelimit-limit']}`);
    }

    const places = await request('/api/places/autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '2',
      },
      body: '{}',
    });
    if (![200, 503].includes(places.statusCode)) {
      throw new Error(`POST /api/places/autocomplete expected 200 or 503, got ${places.statusCode}`);
    }
    if (places.headers['ratelimit-limit'] !== '40') {
      throw new Error(`places rate limit expected 40, got ${places.headers['ratelimit-limit']}`);
    }

    const noSession = [
      ['GET', '/api/me'],
      ['POST', '/api/addpost'],
      ['PUT', '/api/updatecurrentbid/1'],
      ['PUT', '/api/acceptbid/1'],
      ['GET', '/api/posts/1/bids'],
      ['GET', '/api/bidders/1?post_id=1'],
      ['GET', '/api/me/selected'],
      ['GET', '/api/posts/1/address'],
      ['PUT', '/api/updateuser'],
      ['PUT', '/api/updatePassword'],
      ['DELETE', '/api/deletepostbyid'],
      ['DELETE', '/api/deleteaccountbyid'],
      ['DELETE', '/api/deletealluserposts'],
      ['POST', '/api/conversations'],
      ['GET', '/api/conversations'],
      ['GET', '/api/conversations/1/messages'],
      ['POST', '/api/conversations/1/messages'],
      ['PUT', '/api/conversations/1/read'],
      ['GET', '/api/messages/unread-count'],
    ];
    for (const [method, pathname] of noSession) {
      const anon = await request(pathname, { method });
      if (anon.statusCode !== 401) {
        throw new Error(`${method} ${pathname} without a session expected 401, got ${anon.statusCode}`);
      }
    }

    const poll = await request('/api/conversations/1/messages');
    if (poll.headers['ratelimit-limit'] !== '20') {
      throw new Error(`message poll rate limit expected 20, got ${poll.headers['ratelimit-limit']}`);
    }

    const messagesPage = await request('/messages.html');
    if (messagesPage.statusCode !== 200) {
      throw new Error(`GET /messages.html expected 200, got ${messagesPage.statusCode}`);
    }

    console.log(`smoke ok: /=${home.statusCode} api=${api.statusCode} badJson=${badJson.statusCode} noSession=401`);
  } catch (err) {
    failed = true;
    console.error('smoke failed:', err.message);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const force = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 2000);
      child.on('exit', () => {
        clearTimeout(force);
        resolve();
      });
    });
  }

  process.exit(failed ? 1 : 0);
}

main();
