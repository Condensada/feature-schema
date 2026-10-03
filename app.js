// 1. Paste your Google Sheets links here (the normal "Share" link works).
//    Sheet sharing must allow the people viewing this site, or be published to the web.
const SHEETS = {
  planner: "",   // e.g. "https://docs.google.com/spreadsheets/d/XXXX/edit"
  creative: ""   // e.g. "https://docs.google.com/spreadsheets/d/YYYY/edit"
};

(function () {
  const tabs = document.querySelectorAll(".tab");
  const links = document.querySelectorAll("nav a");

  function isGoogleSheet(u) {
    try {
      const url = new URL(u);
      return url.protocol === "https:" && url.hostname === "docs.google.com";
    } catch (e) { return false; }
  }

  function embedUrl(u) {
    // Published-to-web links already embed; normal links need the minimal view.
    if (u.includes("/pubhtml")) return u;
    return u.replace(/\/(edit|view|preview).*$/, "") + "/edit?rm=minimal";
  }

  function buildSheet(section) {
    const holder = section.querySelector(".sheet");
    if (holder.dataset.ready) return;
    holder.dataset.ready = "1";
    const url = SHEETS[section.dataset.sheet];

    if (!url || !isGoogleSheet(url)) {
      const box = document.createElement("div");
      box.className = "empty";
      const p = document.createElement("p");
      p.textContent = "No sheet linked yet. Add the Google Sheets link for \"" + section.dataset.sheet + "\" in app.js, then redeploy.";
      box.appendChild(p);
      holder.appendChild(box);
      return;
    }

    const actions = document.createElement("div");
    actions.className = "actions";
    const open = document.createElement("a");
    open.className = "btn";
    open.href = url;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "Open in Sheets";
    actions.appendChild(open);

    const frame = document.createElement("iframe");
    frame.className = "frame";
    frame.src = embedUrl(url);
    frame.title = section.querySelector("h1").textContent;
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer";

    holder.append(actions, frame);
  }

  function show() {
    const id = (location.hash || "#notes").slice(1);
    const current = document.getElementById(id) ? id : "notes";
    tabs.forEach(function (t) { t.hidden = t.id !== current; });
    links.forEach(function (a) {
      if (a.dataset.tab === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const section = document.getElementById(current);
    if (section.dataset.sheet) buildSheet(section);
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", show);
  show();
})();
