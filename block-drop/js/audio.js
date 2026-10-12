var BlockDropAudio = window.BlockDropAudio || {};

(function () {
  var MUTE_KEY = "block-drop-mute";
  var context = null;
  var master = null;
  var musicGain = null;
  var sfxGain = null;
  var muted = false;
  var musicPlaying = false;
  var musicTimer = 0;
  var nextNoteTime = 0;
  var step = 0;

  // Original playful chiptune loop. Not the Tetris / Korobeiniki theme.
  var MELODY = [
    262, 330, 392, 523, 392, 330, 262, 0,
    294, 349, 440, 587, 440, 349, 294, 0,
    330, 392, 494, 659, 494, 392, 330, 0,
    392, 330, 294, 262, 294, 330, 392, 523
  ];
  var BASS = [
    131, 0, 131, 0, 98, 0, 98, 0,
    147, 0, 147, 0, 110, 0, 110, 0,
    165, 0, 165, 0, 123, 0, 123, 0,
    131, 0, 98, 0, 110, 0, 131, 0
  ];
  var STEP_SECONDS = 0.18;
  var LOOKAHEAD = 0.12;

  function readMute() {
    try {
      return window.localStorage.getItem(MUTE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function writeMute(value) {
    try {
      window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
    } catch (error) {
      // Private mode can block storage; mute still works for the session.
    }
  }

  function ensureContext() {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return null;
    }
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.7;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
      sfxGain = context.createGain();
      sfxGain.gain.value = 0.28;
      sfxGain.connect(master);
      muted = readMute();
      applyMuteGain();
    }
    return context;
  }

  function applyMuteGain() {
    if (!master) {
      return;
    }
    master.gain.setTargetAtTime(muted ? 0 : 0.7, context.currentTime, 0.02);
  }

  function beep(options) {
    var now;
    var oscillator;
    var gain;
    if (!ensureContext() || muted || context.state !== "running") {
      return;
    }
    now = context.currentTime;
    oscillator = context.createOscillator();
    gain = context.createGain();
    oscillator.type = options.type || "square";
    oscillator.frequency.setValueAtTime(options.frequency, now);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, now + options.duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    oscillator.connect(gain);
    gain.connect(sfxGain);
    oscillator.start(now);
    oscillator.stop(now + options.duration + 0.02);
  }

  function scheduleTone(destination, frequency, when, duration, volume, type) {
    var oscillator;
    var gain;
    if (!frequency) {
      return;
    }
    oscillator = context.createOscillator();
    gain = context.createGain();
    oscillator.type = type || "square";
    oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  function scheduleMusic() {
    var horizon;
    if (!context || !musicPlaying || muted) {
      return;
    }
    horizon = context.currentTime + LOOKAHEAD;
    while (nextNoteTime < horizon) {
      scheduleTone(musicGain, MELODY[step], nextNoteTime, STEP_SECONDS * 0.85, 0.045, "square");
      scheduleTone(musicGain, BASS[step], nextNoteTime, STEP_SECONDS * 0.7, 0.06, "triangle");
      nextNoteTime += STEP_SECONDS;
      step = (step + 1) % MELODY.length;
    }
  }

  function stopMusicClock() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = 0;
    }
  }

  BlockDropAudio.unlock = function () {
    var audio = ensureContext();
    if (!audio) {
      return Promise.resolve();
    }
    if (audio.state === "suspended") {
      return audio.resume();
    }
    return Promise.resolve();
  };

  BlockDropAudio.isMuted = function () {
    return muted;
  };

  BlockDropAudio.setMuted = function (value) {
    muted = !!value;
    writeMute(muted);
    ensureContext();
    applyMuteGain();
    if (muted) {
      stopMusicClock();
      musicPlaying = false;
    } else {
      BlockDropAudio.unlock().then(function () {
        BlockDropAudio.startMusic();
      });
    }
  };

  BlockDropAudio.toggleMute = function () {
    BlockDropAudio.setMuted(!muted);
    return muted;
  };

  BlockDropAudio.startMusic = function () {
    if (!ensureContext() || muted) {
      return;
    }
    BlockDropAudio.unlock().then(function () {
      if (muted || musicPlaying) {
        return;
      }
      musicPlaying = true;
      step = 0;
      nextNoteTime = context.currentTime + 0.05;
      stopMusicClock();
      scheduleMusic();
      musicTimer = window.setInterval(scheduleMusic, 50);
    });
  };

  BlockDropAudio.pauseMusic = function () {
    musicPlaying = false;
    stopMusicClock();
  };

  BlockDropAudio.move = function () {
    beep({ frequency: 380, endFrequency: 300, duration: 0.05, volume: 0.12, type: "square" });
  };

  BlockDropAudio.softDrop = function () {
    beep({ frequency: 220, endFrequency: 180, duration: 0.04, volume: 0.1, type: "triangle" });
  };

  BlockDropAudio.rotate = function () {
    beep({ frequency: 520, endFrequency: 740, duration: 0.07, volume: 0.14, type: "square" });
  };

  BlockDropAudio.hardDrop = function () {
    beep({ frequency: 180, endFrequency: 90, duration: 0.12, volume: 0.22, type: "sawtooth" });
  };

  BlockDropAudio.lock = function () {
    beep({ frequency: 160, endFrequency: 120, duration: 0.08, volume: 0.14, type: "triangle" });
  };

  BlockDropAudio.lineClear = function (count) {
    var bump = Math.min(Math.max(count || 1, 1), 4);
    beep({
      frequency: 480 + bump * 60,
      endFrequency: 820 + bump * 40,
      duration: 0.14 + bump * 0.03,
      volume: 0.18,
      type: "square"
    });
  };

  BlockDropAudio.gameOver = function () {
    beep({ frequency: 300, endFrequency: 80, duration: 0.45, volume: 0.2, type: "sawtooth" });
  };

  muted = readMute();
})();
