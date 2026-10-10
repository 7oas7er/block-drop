var BlockDropScores = window.BlockDropScores || {};

(function () {
  var MAX_SCORES = 10;
  var NAME_LENGTH = 3;
  var SCORES_URL = "/api/scores";

  function qualifies(list, score) {
    if (score <= 0) {
      return false;
    }
    if (list.length < MAX_SCORES) {
      return true;
    }
    return score >= list[list.length - 1].score;
  }

  function normalizeName(name) {
    var cleaned = String(name || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleaned) {
      return "AAA";
    }
    return cleaned.slice(0, NAME_LENGTH);
  }

  function readScores(payload) {
    if (!payload || !Array.isArray(payload.scores)) {
      return [];
    }
    return payload.scores;
  }

  function load() {
    return fetch(SCORES_URL, { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Could not load high scores.");
      }
      return response.json();
    }).then(readScores);
  }

  function sha256Hex(text) {
    var bytes = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buffer) {
      var view = new Uint8Array(buffer);
      var hex = "";
      var index;
      var piece;
      for (index = 0; index < view.length; index += 1) {
        piece = view[index].toString(16);
        hex += piece.length === 1 ? "0" + piece : piece;
      }
      return hex;
    });
  }

  function save(name, score) {
    var body = JSON.stringify({
      name: name,
      score: score
    });
    // CloudFront signs a POST only when the viewer sends the body hash.
    return sha256Hex(body).then(function (hash) {
      return fetch(SCORES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-amz-content-sha256": hash
        },
        cache: "no-store",
        body: body
      });
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Could not save high scores.");
      }
      return response.json();
    }).then(function (payload) {
      return {
        list: readScores(payload),
        index: typeof payload.index === "number" ? payload.index : -1,
        saved: payload.saved === true
      };
    });
  }

  BlockDropScores.MAX_SCORES = MAX_SCORES;
  BlockDropScores.NAME_LENGTH = NAME_LENGTH;
  BlockDropScores.qualifies = qualifies;
  BlockDropScores.normalizeName = normalizeName;
  BlockDropScores.load = load;
  BlockDropScores.save = save;
})();
