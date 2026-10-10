var BlockDropScores = window.BlockDropScores || {};

(function () {
  var STORAGE_KEY = "block-drop-high-scores";
  var MAX_SCORES = 10;
  var NAME_LENGTH = 3;

  function emptyList() {
    return [];
  }

  function load() {
    var raw;
    var parsed;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return emptyList();
    }
    if (!raw) {
      return emptyList();
    }
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return emptyList();
    }
    if (!Array.isArray(parsed)) {
      return emptyList();
    }
    return parsed.filter(function (entry) {
      return entry && typeof entry.name === "string" && typeof entry.score === "number";
    }).slice(0, MAX_SCORES);
  }

  function persist(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
      return;
    }
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

  function normalizeName(name) {
    var cleaned = String(name || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleaned) {
      return "AAA";
    }
    return cleaned.slice(0, NAME_LENGTH);
  }

  function insert(list, name, score) {
    var next = list.slice();
    var entry = {
      name: normalizeName(name),
      score: score
    };
    var index = 0;
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
    for (index = 0; index < next.length; index += 1) {
      if (next[index] === entry) {
        break;
      }
    }
    persist(next);
    return {
      list: next,
      index: index
    };
  }

  BlockDropScores.MAX_SCORES = MAX_SCORES;
  BlockDropScores.NAME_LENGTH = NAME_LENGTH;
  BlockDropScores.load = load;
  BlockDropScores.qualifies = qualifies;
  BlockDropScores.normalizeName = normalizeName;
  BlockDropScores.insert = insert;
})();
