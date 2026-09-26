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
        resolve(res.statusCode);
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
    if (home !== 200) {
      throw new Error(`GET / expected 200, got ${home}`);
    }

    const api = await request('/api/getpostsbytitle?search=smoke');
    if (![200, 503].includes(api)) {
      throw new Error(`GET /api/getpostsbytitle expected 200 or 503, got ${api}`);
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
    if (badJson !== 400) {
      throw new Error(`POST /api/signin with invalid JSON expected 400, got ${badJson}`);
    }

    console.log(`smoke ok: /=${home} api=${api} badJson=${badJson}`);
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
