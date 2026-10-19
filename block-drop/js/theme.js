(function (global) {
  var THEME_KEY = "block-drop-theme";
  var DARK = "dark";
  var LIGHT = "light";

  function readTheme() {
    try {
      return global.localStorage.getItem(THEME_KEY) === LIGHT ? LIGHT : DARK;
    } catch (error) {
      return DARK;
    }
  }

  function writeTheme(theme) {
    try {
      global.localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // Private mode can block storage; theme still works for the session.
    }
  }

  function applyTheme(theme) {
    var next = theme === LIGHT ? LIGHT : DARK;
    if (next === DARK) {
      global.document.documentElement.removeAttribute("data-theme");
    } else {
      global.document.documentElement.setAttribute("data-theme", LIGHT);
    }
    writeTheme(next);
    return next;
  }

  function getTheme() {
    return global.document.documentElement.getAttribute("data-theme") === LIGHT ? LIGHT : DARK;
  }

  function toggleTheme() {
    return applyTheme(getTheme() === LIGHT ? DARK : LIGHT);
  }

  function cssVar(name, fallback) {
    var value = global.getComputedStyle(global.document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  applyTheme(readTheme());

  global.BlockDropTheme = {
    DARK: DARK,
    LIGHT: LIGHT,
    getTheme: getTheme,
    setTheme: applyTheme,
    toggle: toggleTheme,
    cssVar: cssVar
  };
}(window));
