import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const { app } = await import('../backend/src/app.js');

test('API endpoints respond with correct JSON structure', async (t) => {
  let server;
  try {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
  } catch (err) {
    if (err.code === 'EACCES') {
      t.skip('Skipping HTTP socket test: loopback port binding restricted in sandbox.');
      return;
    }
    throw err;
  }

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    let healthRes;
    try {
      healthRes = await fetch(`${baseUrl}/api/health`);
    } catch (err) {
      if (err.cause?.code === 'EACCES' || err.code === 'EACCES') {
        t.skip('Skipping HTTP socket test: loopback connection restricted in sandbox.');
        return;
      }
      throw err;
    }

    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'ok');
    assert.ok(healthJson.timestamp);

    const missingGroupRes = await fetch(`${baseUrl}/api/emergency-match`);
    assert.equal(missingGroupRes.status, 400);
    const missingGroupJson = await missingGroupRes.json();
    assert.equal(missingGroupJson.success, false);

    const unauthRes = await fetch(`${baseUrl}/api/user/requests`);
    assert.equal(unauthRes.status, 401);
    const unauthJson = await unauthRes.json();
    assert.equal(unauthJson.success, false);
    assert.match(unauthJson.error, /Authentication/i);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
});
