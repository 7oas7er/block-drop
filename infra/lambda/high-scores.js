var crypto = require('node:crypto');

var MAX_SCORES = 10;
var NAME_LENGTH = 3;
// Cap at a long skilled human run (line clears × level + drops). Not a speedrun WR.
var MAX_SCORE = 500000;
var WRITE_ATTEMPTS = 5;
var MAX_BODY_BYTES = 512;
var TICKET_TTL_SEC = 7200;
var TICKET_MIN_AGE_SEC = 15;
var TICKET_SECRET_KEY = 'ticket-secret';
var TICKETS_PREFIX = 'tickets/';

function normalizeName(name) {
  var cleaned = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) {
    return 'AAA';
  }
  return cleaned.slice(0, NAME_LENGTH);
}

function qualifies(list, score) {
  if (score <= 0) {
    return false;
  }
  if (list.length < MAX_SCORES) {
    return true;
  }
  return score >= list[list.length - 1].score;
}

function parseScores(document) {
  var source = [];
  if (Array.isArray(document)) {
    source = document;
  } else if (document && Array.isArray(document.scores)) {
    source = document.scores;
  }
  // No upper bound on read so lowering MAX_SCORE does not hide historical rows.
  return source.filter(function (entry) {
    return entry
      && typeof entry.name === 'string'
      && Number.isInteger(entry.score)
      && entry.score >= 1;
  }).slice(0, MAX_SCORES).map(function (entry) {
    return {
      name: normalizeName(entry.name),
      score: entry.score,
    };
  });
}

function insertScore(list, name, score) {
  var entry = {
    name: normalizeName(name),
    score: score,
  };
  var next = list.slice();
  var index;
  next.push(entry);
  next.sort(function (a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a === entry) {
      return -1;
    }
    if (b === entry) {
      return 1;
    }
    return 0;
  });
  next = next.slice(0, MAX_SCORES);
  index = next.indexOf(entry);
  return {
    list: next,
    index: index,
  };
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

function isConflict(error) {
  return Boolean(error && (
    error.name === 'PreconditionFailed'
    || (error.$metadata && error.$metadata.httpStatusCode === 412)
  ));
}

function parseScore(score) {
  if (typeof score !== 'number' || !Number.isInteger(score)) {
    return null;
  }
  if (score < 1 || score > MAX_SCORE) {
    return null;
  }
  return score;
}

function signTicket(secret, jti, iat, exp) {
  return crypto
    .createHmac('sha256', secret)
    .update(jti + '.' + iat + '.' + exp)
    .digest('base64url');
}

function formatTicket(secret, jti, iat, exp) {
  return 'v1.' + jti + '.' + iat + '.' + exp + '.' + signTicket(secret, jti, iat, exp);
}

function parseTicket(ticket) {
  var parts;
  var iat;
  var exp;
  if (typeof ticket !== 'string') {
    return null;
  }
  parts = ticket.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') {
    return null;
  }
  if (!/^[a-f0-9]{32}$/.test(parts[1])) {
    return null;
  }
  iat = Number(parts[2]);
  exp = Number(parts[3]);
  if (!Number.isInteger(iat) || !Number.isInteger(exp) || !parts[4]) {
    return null;
  }
  return {
    jti: parts[1],
    iat: iat,
    exp: exp,
    sig: parts[4],
  };
}

function createTicketService(secret, ticketStore, options) {
  var minAgeSec = options && typeof options.minAgeSec === 'number'
    ? options.minAgeSec
    : TICKET_MIN_AGE_SEC;
  var ttlSec = options && typeof options.ttlSec === 'number'
    ? options.ttlSec
    : TICKET_TTL_SEC;
  var nowFn = options && typeof options.now === 'function'
    ? options.now
    : function () { return Math.floor(Date.now() / 1000); };

  return {
    issue: function () {
      var now = nowFn();
      var jti = crypto.randomBytes(16).toString('hex');
      var iat = now;
      var exp = now + ttlSec;
      return {
        ticket: formatTicket(secret, jti, iat, exp),
        expiresAt: exp,
      };
    },
    consume: async function (ticket) {
      var parsed = parseTicket(ticket);
      var now;
      var expected;
      if (!parsed) {
        return { ok: false, reason: 'invalid' };
      }
      expected = signTicket(secret, parsed.jti, parsed.iat, parsed.exp);
      try {
        if (
          parsed.sig.length !== expected.length
          || !crypto.timingSafeEqual(Buffer.from(parsed.sig), Buffer.from(expected))
        ) {
          return { ok: false, reason: 'invalid' };
        }
      } catch (error) {
        return { ok: false, reason: 'invalid' };
      }
      now = nowFn();
      if (now < parsed.iat + minAgeSec) {
        return { ok: false, reason: 'too-new' };
      }
      if (now > parsed.exp) {
        return { ok: false, reason: 'expired' };
      }
      try {
        await ticketStore.burn(parsed.jti);
      } catch (error) {
        if (isConflict(error)) {
          return { ok: false, reason: 'used' };
        }
        throw error;
      }
      return { ok: true, jti: parsed.jti };
    },
  };
}

async function readScores(store) {
  var loaded = await store.read();
  return {
    scores: parseScores(loaded && loaded.list),
    etag: loaded && loaded.etag ? loaded.etag : null,
  };
}

async function saveScore(store, name, score) {
  var attempt;
  var current;
  var inserted;
  for (attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    current = await readScores(store);
    if (!qualifies(current.scores, score)) {
      return {
        scores: current.scores,
        index: -1,
        saved: false,
      };
    }
    inserted = insertScore(current.scores, name, score);
    try {
      await store.write({ scores: inserted.list }, current.etag);
      return {
        scores: inserted.list,
        index: inserted.index,
        saved: inserted.index >= 0,
      };
    } catch (error) {
      if (!isConflict(error) || attempt === WRITE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }
  throw new Error('Could not save high scores.');
}

async function handleScores(request, store, tickets) {
  var method = request && request.method;
  var body;
  var score;
  var saved;
  var issued;
  var consumed;
  if (method === 'GET') {
    try {
      saved = await readScores(store);
    } catch (error) {
      return jsonResponse(500, { error: 'Could not load high scores.' });
    }
    return jsonResponse(200, { scores: saved.scores });
  }
  if (method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }
  if (!request.body || request.body.length > MAX_BODY_BYTES) {
    return jsonResponse(400, { error: 'Invalid score.' });
  }
  try {
    body = JSON.parse(request.body);
  } catch (error) {
    return jsonResponse(400, { error: 'Invalid score.' });
  }
  if (body && body.op === 'ticket') {
    if (!tickets) {
      return jsonResponse(500, { error: 'Could not issue ticket.' });
    }
    issued = tickets.issue();
    return jsonResponse(200, issued);
  }
  score = parseScore(body && body.score);
  if (score === null) {
    return jsonResponse(400, { error: 'Invalid score.' });
  }
  if (!tickets) {
    return jsonResponse(500, { error: 'Could not save high scores.' });
  }
  try {
    consumed = await tickets.consume(body && body.ticket);
  } catch (error) {
    return jsonResponse(500, { error: 'Could not save high scores.' });
  }
  if (!consumed.ok) {
    return jsonResponse(403, { error: 'Invalid ticket.' });
  }
  try {
    saved = await saveScore(store, body.name, score);
  } catch (error) {
    return jsonResponse(500, { error: 'Could not save high scores.' });
  }
  return jsonResponse(200, saved);
}

function decodeBody(event) {
  var body = event && event.body ? event.body : '';
  if (event && event.isBase64Encoded && body) {
    return Buffer.from(body, 'base64').toString('utf8');
  }
  return body;
}

async function loadOrCreateSecret(client, bucket, key) {
  var sdk = require('@aws-sdk/client-s3');
  var output;
  var generated;
  try {
    output = await client.send(new sdk.GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return await output.Body.transformToString();
  } catch (error) {
    if (!(error && (error.name === 'NoSuchKey' || error.name === 'NotFound'
      || (error.$metadata && error.$metadata.httpStatusCode === 404)))) {
      throw error;
    }
  }
  generated = crypto.randomBytes(32).toString('base64url');
  try {
    await client.send(new sdk.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: generated,
      ContentType: 'text/plain',
      CacheControl: 'no-store',
      IfNoneMatch: '*',
    }));
    return generated;
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }
    output = await client.send(new sdk.GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return await output.Body.transformToString();
  }
}

function createS3Store(client, bucket, key) {
  var sdk = require('@aws-sdk/client-s3');
  return {
    read: async function () {
      try {
        var output = await client.send(new sdk.GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }));
        var text = await output.Body.transformToString();
        return {
          list: JSON.parse(text),
          etag: output.ETag || null,
        };
      } catch (error) {
        if (error && (error.name === 'NoSuchKey' || error.name === 'NotFound'
          || (error.$metadata && error.$metadata.httpStatusCode === 404))) {
          return { list: null, etag: null };
        }
        throw error;
      }
    },
    write: async function (document, etag) {
      var input = {
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(document),
        ContentType: 'application/json',
        CacheControl: 'no-store',
      };
      if (etag) {
        input.IfMatch = etag;
      } else {
        input.IfNoneMatch = '*';
      }
      await client.send(new sdk.PutObjectCommand(input));
    },
  };
}

function createS3TicketStore(client, bucket, prefix) {
  var sdk = require('@aws-sdk/client-s3');
  return {
    burn: async function (jti) {
      await client.send(new sdk.PutObjectCommand({
        Bucket: bucket,
        Key: prefix + jti,
        Body: '1',
        ContentType: 'text/plain',
        CacheControl: 'no-store',
        IfNoneMatch: '*',
      }));
    },
  };
}

async function handler(event) {
  var method = event
    && event.requestContext
    && event.requestContext.http
    && event.requestContext.http.method;
  var sdk = require('@aws-sdk/client-s3');
  var client = new sdk.S3Client({});
  var bucket = process.env.SCORES_BUCKET;
  var secret = await loadOrCreateSecret(
    client,
    bucket,
    process.env.TICKET_SECRET_KEY || TICKET_SECRET_KEY,
  );
  var store = createS3Store(client, bucket, process.env.SCORES_KEY);
  var ticketStore = createS3TicketStore(
    client,
    bucket,
    process.env.TICKETS_PREFIX || TICKETS_PREFIX,
  );
  var tickets = createTicketService(secret, ticketStore);
  return handleScores({
    method: method,
    body: decodeBody(event),
  }, store, tickets);
}

module.exports = {
  MAX_SCORES: MAX_SCORES,
  MAX_SCORE: MAX_SCORE,
  TICKET_MIN_AGE_SEC: TICKET_MIN_AGE_SEC,
  handler: handler,
  handleScores: handleScores,
  normalizeName: normalizeName,
  qualifies: qualifies,
  insertScore: insertScore,
  createTicketService: createTicketService,
  formatTicket: formatTicket,
};
