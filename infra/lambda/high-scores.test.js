const assert = require('node:assert/strict');
const test = require('node:test');
const scores = require('./high-scores');

function memoryStore(seed) {
  const state = {
    document: seed || null,
    etag: seed ? 'etag-1' : null,
    conflictsLeft: 0,
    onConflict: null,
  };
  return {
    state,
    failNextWrite(onConflict) {
      state.conflictsLeft = 1;
      state.onConflict = onConflict;
    },
    async read() {
      return {
        list: state.document,
        etag: state.etag,
      };
    },
    async write(document, etag) {
      if (state.conflictsLeft > 0) {
        state.conflictsLeft -= 1;
        if (state.onConflict) {
          state.onConflict(state);
        }
        const error = new Error('conflict');
        error.name = 'PreconditionFailed';
        throw error;
      }
      if (etag !== state.etag) {
        const error = new Error('conflict');
        error.name = 'PreconditionFailed';
        throw error;
      }
      state.document = document;
      state.etag = `etag-${JSON.stringify(document).length}`;
    },
  };
}

function fullTable() {
  const table = [];
  for (let rank = 0; rank < 10; rank += 1) {
    table.push({ name: 'OLD', score: 1000 - rank * 10 });
  }
  return { scores: table };
}

test('normalizes a name to three letters or digits', () => {
  assert.equal(scores.normalizeName(' ace! '), 'ACE');
  assert.equal(scores.normalizeName(''), 'AAA');
  assert.equal(scores.normalizeName('abcd'), 'ABC');
});

test('keeps a new tie ahead of the older score', () => {
  const inserted = scores.insertScore(
    [{ name: 'ACE', score: 50 }],
    'bob',
    50,
  );
  assert.deepEqual(inserted.list, [
    { name: 'BOB', score: 50 },
    { name: 'ACE', score: 50 },
  ]);
  assert.equal(inserted.index, 0);
});

test('loads an empty table when the object is missing', async () => {
  const store = memoryStore();
  const response = await scores.handleScores({ method: 'GET', body: '' }, store);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { scores: [] });
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('saves a qualifying score and reads it back', async () => {
  const store = memoryStore();
  const saved = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'ace!', score: 2400 }),
  }, store);
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(JSON.parse(saved.body), {
    scores: [{ name: 'ACE', score: 2400 }],
    index: 0,
    saved: true,
  });
  const loaded = await scores.handleScores({ method: 'GET', body: '' }, store);
  assert.deepEqual(JSON.parse(loaded.body), {
    scores: [{ name: 'ACE', score: 2400 }],
  });
});

test('rejects a zero score and a score below a full table', async () => {
  const store = memoryStore(fullTable());
  const zero = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'AAA', score: 0 }),
  }, store);
  assert.equal(zero.statusCode, 400);

  const low = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'LOW', score: 900 }),
  }, store);
  assert.equal(low.statusCode, 200);
  const payload = JSON.parse(low.body);
  assert.equal(payload.saved, false);
  assert.equal(payload.scores[9].score, 910);
  assert.equal(store.state.document.scores[0].name, 'OLD');
});

test('retries when two saves write the same table', async () => {
  const store = memoryStore();
  store.failNextWrite((state) => {
    state.document = fullTable();
    state.etag = 'other-player';
  });
  const response = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'NEW', score: 40 }),
  }, store);
  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.saved, false);
  assert.equal(payload.scores.length, 10);
  assert.equal(store.state.etag, 'other-player');
});

test('rejects unexpected methods and malformed scores', async () => {
  const store = memoryStore();
  const removed = await scores.handleScores({ method: 'DELETE', body: '' }, store);
  assert.equal(removed.statusCode, 405);
  const malformed = await scores.handleScores({ method: 'POST', body: '{not json' }, store);
  assert.equal(malformed.statusCode, 400);
  const textScore = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'AAA', score: '2400' }),
  }, store);
  assert.equal(textScore.statusCode, 400);
});
