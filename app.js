// 1. Paste your Google Sheets links here (the normal "Share" link works).
//    Sheet sharing must allow the people viewing this site, or be published to the web.
const SHEETS = {
  planner: "",   // e.g. "https://docs.google.com/spreadsheets/d/XXXX/edit"
  creative: ""   // e.g. "https://docs.google.com/spreadsheets/d/YYYY/edit"
};

(function () {
  const nav = document.querySelector("nav");
  const main = document.querySelector("main");
  const dialog = document.getElementById("tab-dialog");
  const form = dialog.querySelector("form");
  const nameInput = document.getElementById("tab-name");
  const urlInput = document.getElementById("tab-url");
  const fileInput = document.getElementById("tab-file");
  const urlField = document.getElementById("tab-url-field");
  const fileField = document.getElementById("tab-file-field");
  const status = document.getElementById("tab-status");
  const tabsKey = "feature-department-custom-tabs";
  let tabType = "link";

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
    main.querySelectorAll(".tab").forEach(function (t) { t.hidden = t.id !== current; });
    nav.querySelectorAll("a").forEach(function (a) {
      if (a.dataset.tab === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const section = document.getElementById(current);
    if (section.dataset.sheet) buildSheet(section);
    window.scrollTo(0, 0);
  }

  function readCustomTabs() {
    try {
      const saved = JSON.parse(localStorage.getItem(tabsKey) || "[]");
      return Array.isArray(saved) ? saved.filter(function (tab) {
        return tab && typeof tab.id === "string" && /^custom-[a-z0-9-]+$/.test(tab.id) &&
          typeof tab.name === "string" && tab.name.trim() && tab.name.length <= 80 &&
          (tab.kind === "file" || (tab.kind === "link" && typeof tab.url === "string" && validWebUrl(tab.url)));
      }) : [];
    } catch (error) {
      status.textContent = "Saved tabs could not be read. You can still use the built-in tabs.";
      return [];
    }
  }

  function saveCustomTabs(customTabs) {
    localStorage.setItem(tabsKey, JSON.stringify(customTabs));
  }

  function addCustomTab(tab) {
    const link = document.createElement("a");
    link.href = "#" + tab.id;
    link.dataset.tab = tab.id;
    link.textContent = tab.name;
    nav.appendChild(link);

    const section = document.createElement("section");
    section.id = tab.id;
    section.className = "tab";
    section.hidden = true;

    const header = document.createElement("header");
    header.className = "band";
    const heading = document.createElement("h1");
    heading.textContent = tab.name;
    const description = document.createElement("p");
    description.textContent = tab.kind === "file" ? "File uploaded in this browser." : "Web link";
    header.append(heading, description);

    const body = document.createElement("div");
    body.className = "body";
    const openLink = document.createElement("a");
    openLink.className = "btn";
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = tab.kind === "file" ? "Open uploaded file" : "Open link";
    if (tab.kind === "file") {
      openLink.textContent = "Loading file...";
      openLink.setAttribute("aria-disabled", "true");
      openLink.tabIndex = -1;
      prepareUploadedFile(tab.id, openLink);
    } else {
      openLink.href = tab.url;
    }
    body.appendChild(openLink);
    section.append(header, body);
    main.appendChild(section);
  }

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      const request = indexedDB.open("feature-department-tabs", 1);
      request.onupgradeneeded = function () {
        request.result.createObjectStore("uploads");
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function storeUploadedFile(id, file) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        const transaction = db.transaction("uploads", "readwrite");
        transaction.objectStore("uploads").put(file, id);
        transaction.oncomplete = function () { db.close(); resolve(); };
        transaction.onerror = function () { db.close(); reject(transaction.error); };
        transaction.onabort = function () { db.close(); reject(transaction.error); };
      });
    });
  }

  function prepareUploadedFile(id, link) {
    openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        const request = db.transaction("uploads").objectStore("uploads").get(id);
        request.onsuccess = function () {
          db.close();
          resolve(request.result);
        };
        request.onerror = function () {
          db.close();
          reject(request.error);
        };
      });
    }).then(function (file) {
      if (!file) throw new Error("The uploaded file is no longer available in this browser.");
      const objectUrl = URL.createObjectURL(file);
      link.href = objectUrl;
      link.download = file.name;
      link.textContent = "Open uploaded file";
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
    }).catch(function () {
      link.textContent = "Uploaded file unavailable";
      status.textContent = "Could not open the uploaded file. It may have been removed from this browser.";
    });
  }

  function openDialog(type) {
    tabType = type;
    form.reset();
    urlField.hidden = type !== "link";
    fileField.hidden = type !== "file";
    urlInput.required = type === "link";
    fileInput.required = type === "file";
    document.getElementById("tab-dialog-title").textContent = type === "file" ? "Upload a file tab" : "Add a link tab";
    dialog.showModal();
    nameInput.focus();
  }

  function validWebUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function createId() {
    return "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  document.getElementById("add-link-tab").addEventListener("click", function () { openDialog("link"); });
  document.getElementById("add-upload-tab").addEventListener("click", function () { openDialog("file"); });
  document.getElementById("cancel-tab").addEventListener("click", function () { dialog.close(); });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    status.textContent = "";
    const name = nameInput.value.trim();
    const file = fileInput.files[0];
    if (!name) return;

    if (tabType === "link") {
      const url = urlInput.value.trim();
      if (!validWebUrl(url)) {
        status.textContent = "Enter a valid http or https link.";
        return;
      }
      const tab = { id: createId(), name: name, kind: "link", url: url };
      try {
        const customTabs = readCustomTabs();
        customTabs.push(tab);
        saveCustomTabs(customTabs);
        addCustomTab(tab);
        dialog.close();
        location.hash = tab.id;
      } catch (error) {
        status.textContent = "Could not save this tab in the browser.";
      }
      return;
    }

    if (!file) {
      status.textContent = "Choose a file to upload.";
      return;
    }
    const tab = { id: createId(), name: name, kind: "file" };
    storeUploadedFile(tab.id, file).then(function () {
      const customTabs = readCustomTabs();
      customTabs.push(tab);
      saveCustomTabs(customTabs);
      addCustomTab(tab);
      dialog.close();
      location.hash = tab.id;
    }).catch(function () {
      status.textContent = "Could not save the uploaded file in this browser. Check available storage and try again.";
    });
  });

  readCustomTabs().forEach(addCustomTab);
  window.addEventListener("hashchange", show);
  show();
})();
