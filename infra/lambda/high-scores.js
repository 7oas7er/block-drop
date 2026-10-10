var MAX_SCORES = 10;
var NAME_LENGTH = 3;
var MAX_SCORE = 99999999;
var WRITE_ATTEMPTS = 5;

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
  return source.filter(function (entry) {
    return entry
      && typeof entry.name === 'string'
      && Number.isInteger(entry.score)
      && entry.score >= 1
      && entry.score <= MAX_SCORE;
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

async function handleScores(request, store) {
  var method = request && request.method;
  var body;
  var score;
  var saved;
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
  if (!request.body || request.body.length > 256) {
    return jsonResponse(400, { error: 'Invalid score.' });
  }
  try {
    body = JSON.parse(request.body);
  } catch (error) {
    return jsonResponse(400, { error: 'Invalid score.' });
  }
  score = parseScore(body && body.score);
  if (score === null) {
    return jsonResponse(400, { error: 'Invalid score.' });
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

async function handler(event) {
  var method = event
    && event.requestContext
    && event.requestContext.http
    && event.requestContext.http.method;
  var sdk = require('@aws-sdk/client-s3');
  var client = new sdk.S3Client({});
  var store = createS3Store(client, process.env.SCORES_BUCKET, process.env.SCORES_KEY);
  return handleScores({
    method: method,
    body: decodeBody(event),
  }, store);
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

module.exports = {
  MAX_SCORES: MAX_SCORES,
  handler: handler,
  handleScores: handleScores,
  normalizeName: normalizeName,
  qualifies: qualifies,
  insertScore: insertScore,
};
