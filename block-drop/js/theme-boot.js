try {
  if (localStorage.getItem("block-drop-theme") === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  }
} catch (error) {}
