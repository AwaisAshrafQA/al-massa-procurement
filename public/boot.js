// Apply saved theme and language before first paint (no flash). A separate file, not inline,
// so the Content-Security-Policy can allow scripts from this site only.
try {
  var th = localStorage.getItem("am.theme");
  var dark = th === "dark" || (th !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
  if (localStorage.getItem("am.lang") === "ar") { document.documentElement.lang = "ar"; document.documentElement.dir = "rtl"; }
} catch (e) {}
