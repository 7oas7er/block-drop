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

function memoryTicketStore() {
  const burned = new Set();
  return {
    burned,
    async burn(jti) {
      if (burned.has(jti)) {
        const error = new Error('conflict');
        error.name = 'PreconditionFailed';
        throw error;
      }
      burned.add(jti);
    },
  };
}

function ticketsAt(nowSec) {
  return scores.createTicketService(
    'test-secret',
    memoryTicketStore(),
    { minAgeSec: 0, ttlSec: 3600, now: () => nowSec },
  );
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

test('issues a play ticket', async () => {
  const tickets = ticketsAt(1_700_000_000);
  const response = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ op: 'ticket' }),
  }, memoryStore(), tickets);
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.match(payload.ticket, /^v1\.[a-f0-9]{32}\.\d+\.\d+\.[A-Za-z0-9_-]+$/);
  assert.equal(payload.expiresAt, 1_700_000_000 + 3600);
});

test('saves a qualifying score with a valid ticket and reads it back', async () => {
  const store = memoryStore();
  const tickets = ticketsAt(1_700_000_000);
  const issued = tickets.issue();
  const saved = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'ace!', score: 2400, ticket: issued.ticket }),
  }, store, tickets);
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

test('rejects a reuse of the same ticket', async () => {
  const store = memoryStore();
  const tickets = ticketsAt(1_700_000_000);
  const issued = tickets.issue();
  const first = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'ACE', score: 100, ticket: issued.ticket }),
  }, store, tickets);
  assert.equal(first.statusCode, 200);
  const second = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'BOB', score: 200, ticket: issued.ticket }),
  }, store, tickets);
  assert.equal(second.statusCode, 403);
});

test('rejects a score above MAX_SCORE even with a ticket', async () => {
  const tickets = ticketsAt(1_700_000_000);
  const issued = tickets.issue();
  const response = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({
      name: 'ACE',
      score: scores.MAX_SCORE + 1,
      ticket: issued.ticket,
    }),
  }, memoryStore(), tickets);
  assert.equal(response.statusCode, 400);
});

test('rejects a missing ticket', async () => {
  const response = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'ACE', score: 100 }),
  }, memoryStore(), ticketsAt(1_700_000_000));
  assert.equal(response.statusCode, 403);
});

test('rejects a zero score and a score below a full table', async () => {
  const store = memoryStore(fullTable());
  const tickets = ticketsAt(1_700_000_000);
  const zeroTicket = tickets.issue();
  const zero = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'AAA', score: 0, ticket: zeroTicket.ticket }),
  }, store, tickets);
  assert.equal(zero.statusCode, 400);

  const lowTicket = tickets.issue();
  const low = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'LOW', score: 900, ticket: lowTicket.ticket }),
  }, store, tickets);
  assert.equal(low.statusCode, 200);
  const payload = JSON.parse(low.body);
  assert.equal(payload.saved, false);
  assert.equal(payload.scores[9].score, 910);
  assert.equal(store.state.document.scores[0].name, 'OLD');
});

test('retries when two saves write the same table', async () => {
  const store = memoryStore();
  const tickets = ticketsAt(1_700_000_000);
  const issued = tickets.issue();
  store.failNextWrite((state) => {
    state.document = fullTable();
    state.etag = 'other-player';
  });
  const response = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'NEW', score: 40, ticket: issued.ticket }),
  }, store, tickets);
  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.saved, false);
  assert.equal(payload.scores.length, 10);
  assert.equal(store.state.etag, 'other-player');
});

test('rejects unexpected methods and malformed scores', async () => {
  const store = memoryStore();
  const tickets = ticketsAt(1_700_000_000);
  const removed = await scores.handleScores({ method: 'DELETE', body: '' }, store, tickets);
  assert.equal(removed.statusCode, 405);
  const malformed = await scores.handleScores({ method: 'POST', body: '{not json' }, store, tickets);
  assert.equal(malformed.statusCode, 400);
  const textScore = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'AAA', score: '2400', ticket: tickets.issue().ticket }),
  }, store, tickets);
  assert.equal(textScore.statusCode, 400);
});

test('enforces ticket minimum age', async () => {
  let now = 1_700_000_000;
  const ticketStore = memoryTicketStore();
  const tickets = scores.createTicketService('test-secret', ticketStore, {
    minAgeSec: 15,
    ttlSec: 3600,
    now: () => now,
  });
  const issued = tickets.issue();
  now = 1_700_000_010;
  const early = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'ACE', score: 100, ticket: issued.ticket }),
  }, memoryStore(), tickets);
  assert.equal(early.statusCode, 403);
  now = 1_700_000_020;
  const ok = await scores.handleScores({
    method: 'POST',
    body: JSON.stringify({ name: 'ACE', score: 100, ticket: issued.ticket }),
  }, memoryStore(), tickets);
  assert.equal(ok.statusCode, 200);
});
