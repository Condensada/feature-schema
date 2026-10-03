// Set the admin email to the one account permitted to change handbook data.
const ADMIN_EMAIL = "2240084@slu.edu.ph";
const FILE_BUCKET = "tab-uploads";

(function () {
  const nav = document.querySelector("nav");
  const main = document.querySelector("main");
  const tabDialog = document.getElementById("tab-dialog");
  const tabForm = tabDialog.querySelector("form");
  const nameInput = document.getElementById("tab-name");
  const urlInput = document.getElementById("tab-url");
  const fileInput = document.getElementById("tab-file");
  const urlField = document.getElementById("tab-url-field");
  const fileField = document.getElementById("tab-file-field");
  const editorDialog = document.getElementById("editor-dialog");
  const editorForm = editorDialog.querySelector("form");
  const editorTitle = document.getElementById("edit-title");
  const editorDescription = document.getElementById("edit-description");
  const editorContent = document.getElementById("edit-content");
  const editorContentField = document.getElementById("edit-content-field");
  const deleteTabButton = document.getElementById("delete-tab");
  const status = document.getElementById("tab-status");
  const supabaseConfig = window.HANDBOOK_SUPABASE;
  const isConfigured = Boolean(
    supabaseConfig && supabaseConfig.url && supabaseConfig.anonKey &&
    !supabaseConfig.url.includes("YOUR_PROJECT") && !supabaseConfig.anonKey.includes("YOUR_ANON_KEY")
  );
  const client = isConfigured ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;
  let isAdmin = false;
  let currentUser = null;
  let tabType = "link";
  let editingSection = null;
  let customTabs = [];
  let pageOverrides = {};

  function isGoogleSheet(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "docs.google.com";
    } catch (error) {
      return false;
    }
  }

  function embedUrl(value) {
    if (value.includes("/pubhtml")) return value;
    return value.replace(/\/(edit|view|preview).*$/, "") + "/edit?rm=minimal";
  }

  function buildSheet(section) {
    const holder = section.querySelector(".sheet");
    if (holder.dataset.ready) return;
    holder.dataset.ready = "1";
    const url = window.HANDBOOK_SHEETS[section.dataset.sheet];
    if (!url || !isGoogleSheet(url)) {
      const box = document.createElement("div");
      box.className = "empty";
      const message = document.createElement("p");
      message.textContent = "No sheet linked yet. Add the Google Sheets link in config.js, then redeploy.";
      box.appendChild(message);
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

  function cleanMarkup(markup) {
    const allowedTags = new Set([
      "P", "BR", "STRONG", "B", "EM", "I", "H2", "H3", "UL", "OL", "LI",
      "BLOCKQUOTE", "DETAILS", "SUMMARY", "A"
    ]);
    const parsed = new DOMParser().parseFromString(markup, "text/html");

    function copyNode(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.appendChild(document.createTextNode(node.nodeValue));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (!allowedTags.has(tag)) {
        Array.from(node.childNodes).forEach(function (child) { copyNode(child, parent); });
        return;
      }
      const clean = document.createElement(tag.toLowerCase());
      if (tag === "A") {
        const href = node.getAttribute("href") || "";
        try {
          const parsedUrl = new URL(href, location.href);
          if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" || parsedUrl.protocol === "mailto:") {
            clean.href = parsedUrl.href;
            clean.rel = "noopener noreferrer";
          }
        } catch (error) {
          // Invalid links are preserved as text, not executable markup.
        }
      }
      Array.from(node.childNodes).forEach(function (child) { copyNode(child, clean); });
      parent.appendChild(clean);
    }

    const fragment = document.createDocumentFragment();
    Array.from(parsed.body.childNodes).forEach(function (node) { copyNode(node, fragment); });
    const container = document.createElement("div");
    container.appendChild(fragment);
    return container.innerHTML;
  }

  function show() {
    const requestedId = (location.hash || "#notes").slice(1);
    const currentId = document.getElementById(requestedId) ? requestedId : "notes";
    main.querySelectorAll(".tab").forEach(function (section) { section.hidden = section.id !== currentId; });
    nav.querySelectorAll("a").forEach(function (link) {
      if (link.dataset.tab === currentId) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    const section = document.getElementById(currentId);
    if (section.dataset.sheet) buildSheet(section);
    document.getElementById("edit-current-tab").hidden = !isAdmin;
    window.scrollTo(0, 0);
  }

  function setAdminControls() {
    document.getElementById("add-link-tab").hidden = !isAdmin;
    document.getElementById("add-upload-tab").hidden = !isAdmin;
    document.getElementById("sign-in").hidden = isAdmin || !isConfigured;
    document.getElementById("sign-out").hidden = !isAdmin;
    document.getElementById("edit-current-tab").hidden = !isAdmin;
    if (isAdmin) {
      status.textContent = "Signed in as " + currentUser.email + ". You can edit handbook content and tabs.";
    } else if (!isConfigured) {
      status.textContent = "Read-only mode. Admin sign-in is not configured yet.";
    } else {
      status.textContent = "Read-only view.";
    }
  }

  function applyPageOverrides() {
    Object.keys(pageOverrides).forEach(function (id) {
      const section = document.getElementById(id);
      const page = pageOverrides[id];
      if (!section || !page) return;
      const navLink = nav.querySelector('[data-tab="' + id + '"]');
      if (navLink) navLink.textContent = page.title;
      section.querySelector("h1").textContent = page.title;
      const band = section.querySelector(".band");
      const description = band.querySelector("p");
      if (description) description.textContent = page.description || "";
      const body = section.querySelector(".body");
      if (body && !body.classList.contains("sheet") && typeof page.content_html === "string") {
        const primaryLink = section.dataset.custom ? body.querySelector(".btn") : null;
        body.innerHTML = cleanMarkup(page.content_html);
        if (primaryLink) body.appendChild(primaryLink);
      }
    });
  }

  function makeCustomTab(tab) {
    const link = document.createElement("a");
    link.href = "#" + tab.id;
    link.dataset.tab = tab.id;
    link.dataset.custom = "true";
    link.textContent = tab.name;
    nav.appendChild(link);

    const section = document.createElement("section");
    section.id = tab.id;
    section.className = "tab";
    section.dataset.custom = "true";
    section.dataset.kind = tab.kind;
    section.hidden = true;

    const header = document.createElement("header");
    header.className = "band";
    const heading = document.createElement("h1");
    heading.textContent = tab.name;
    const description = document.createElement("p");
    description.textContent = tab.kind === "file" ? "Uploaded file" : "Web link";
    header.append(heading, description);

    const body = document.createElement("div");
    body.className = "body";
    const openLink = document.createElement("a");
    openLink.className = "btn";
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = tab.kind === "file" ? "Open uploaded file" : "Open link";
    if (tab.kind === "file") {
      const { data } = client.storage.from(FILE_BUCKET).getPublicUrl(tab.storage_path);
      openLink.href = data.publicUrl;
      openLink.download = "";
    } else {
      openLink.href = tab.url;
    }
    body.appendChild(openLink);

    const override = pageOverrides[tab.id];
    if (override) {
      heading.textContent = override.title;
      description.textContent = override.description || "";
      link.textContent = override.title;
      if (tab.kind !== "file" && override.content_html) {
        body.innerHTML = cleanMarkup(override.content_html);
        body.appendChild(openLink);
      }
    }
    section.append(header, body);
    main.appendChild(section);
  }

  async function loadSharedContent() {
    if (!client) return;
    const [tabsResult, pagesResult] = await Promise.all([
      client.from("handbook_tabs").select("id,name,kind,url,storage_path").order("created_at"),
      client.from("handbook_pages").select("page_id,title,description,content_html")
    ]);
    if (tabsResult.error) throw tabsResult.error;
    if (pagesResult.error) throw pagesResult.error;
    customTabs = tabsResult.data || [];
    pageOverrides = {};
    (pagesResult.data || []).forEach(function (page) { pageOverrides[page.page_id] = page; });
    customTabs.forEach(makeCustomTab);
    applyPageOverrides();
    show();
  }

  function openTabDialog(type) {
    tabType = type;
    tabForm.reset();
    urlField.hidden = type !== "link";
    fileField.hidden = type !== "file";
    urlInput.required = type === "link";
    fileInput.required = type === "file";
    document.getElementById("tab-dialog-title").textContent = type === "file" ? "Upload a file tab" : "Add a link tab";
    tabDialog.showModal();
    nameInput.focus();
  }

  function openEditor() {
    editingSection = document.getElementById((location.hash || "#notes").slice(1)) || document.getElementById("notes");
    const id = editingSection.id;
    const page = pageOverrides[id];
    editorTitle.value = page ? page.title : editingSection.querySelector("h1").textContent;
    editorDescription.value = page ? page.description || "" : (editingSection.querySelector(".band p") || {}).textContent || "";
    const body = editingSection.querySelector(".body");
    editorContentField.hidden = !body || body.classList.contains("sheet") || editingSection.dataset.kind === "file";
    if (page && typeof page.content_html === "string") {
      editorContent.value = page.content_html;
    } else if (body) {
      const content = body.cloneNode(true);
      if (editingSection.dataset.custom) {
        const openLink = content.querySelector(".btn");
        if (openLink) openLink.remove();
      }
      editorContent.value = content.innerHTML;
    } else {
      editorContent.value = "";
    }
    deleteTabButton.hidden = !editingSection.dataset.custom;
    editorDialog.showModal();
    editorTitle.focus();
  }

  function validWebUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  async function createCustomTab(event) {
    event.preventDefault();
    status.textContent = "";
    const name = nameInput.value.trim();
    const file = fileInput.files[0];
    const url = urlInput.value.trim();
    if (!name) return;
    if (tabType === "link" && !validWebUrl(url)) {
      status.textContent = "Enter a valid http or https link.";
      return;
    }
    if (tabType === "file" && !file) {
      status.textContent = "Choose a file to upload.";
      return;
    }
    if (file && file.size > 25 * 1024 * 1024) {
      status.textContent = "Files must be 25 MB or smaller.";
      return;
    }

    const tab = { id: crypto.randomUUID(), name: name, kind: tabType, url: tabType === "link" ? url : null, storage_path: null };
    if (tabType === "file") {
      const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-120) || "upload";
      tab.storage_path = tab.id + "/" + safeName;
      const upload = await client.storage.from(FILE_BUCKET).upload(tab.storage_path, file, { upsert: false });
      if (upload.error) {
        status.textContent = "Upload failed: " + upload.error.message;
        return;
      }
    }
    const result = await client.from("handbook_tabs").insert({
      id: tab.id,
      name: tab.name,
      kind: tab.kind,
      url: tab.url,
      storage_path: tab.storage_path
    });
    if (result.error) {
      if (tab.storage_path) {
        const cleanup = await client.storage.from(FILE_BUCKET).remove([tab.storage_path]);
        status.textContent = cleanup.error
          ? "Could not add the tab (" + result.error.message + ") or clean up its uploaded file (" + cleanup.error.message + ")."
          : "Could not add the tab: " + result.error.message;
      } else {
        status.textContent = "Could not add the tab: " + result.error.message;
      }
      return;
    }
    tabDialog.close();
    status.textContent = "";
    await refreshSharedContent();
    location.hash = tab.id;
  }

  async function savePage(event) {
    event.preventDefault();
    if (!editingSection || !isAdmin) return;
    const id = editingSection.id;
    const body = editingSection.querySelector(".body");
    const content = editorContentField.hidden ? (pageOverrides[id] || {}).content_html || "" : cleanMarkup(editorContent.value);
    const page = {
      page_id: id,
      title: editorTitle.value.trim(),
      description: editorDescription.value.trim(),
      content_html: content
    };
    if (!page.title) {
      status.textContent = "A tab title is required.";
      return;
    }
    const result = await client.from("handbook_pages").upsert(page, { onConflict: "page_id" });
    if (result.error) {
      status.textContent = "Could not save changes: " + result.error.message;
      return;
    }
    editorDialog.close();
    await refreshSharedContent();
    status.textContent = "Changes saved.";
  }

  async function deleteCurrentTab() {
    if (!editingSection || !editingSection.dataset.custom || !isAdmin) return;
    const tab = customTabs.find(function (item) { return item.id === editingSection.id; });
    if (!tab || !window.confirm("Delete this tab? This cannot be undone.")) return;
    const result = await client.from("handbook_tabs").delete().eq("id", tab.id);
    if (result.error) {
      status.textContent = "Could not delete the tab: " + result.error.message;
      return;
    }
    if (tab.storage_path) {
      const removal = await client.storage.from(FILE_BUCKET).remove([tab.storage_path]);
      if (removal.error) status.textContent = "The tab was deleted, but its uploaded file could not be removed: " + removal.error.message;
    }
    editorDialog.close();
    const pageResult = await client.from("handbook_pages").delete().eq("page_id", tab.id);
    if (pageResult.error) status.textContent = "Tab deleted, but its saved page content could not be removed: " + pageResult.error.message;
    await refreshSharedContent();
    location.hash = "notes";
  }

  async function refreshSharedContent() {
    try {
      nav.querySelectorAll('[data-custom="true"]').forEach(function (element) { element.remove(); });
      main.querySelectorAll('[data-custom="true"]').forEach(function (element) { element.remove(); });
      await loadSharedContent();
    } catch (error) {
      status.textContent = "Could not refresh shared handbook data: " + error.message;
    }
  }

  document.getElementById("sign-in").addEventListener("click", async function () {
    if (!client) return;
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname }
    });
    if (error) status.textContent = "Sign-in failed: " + error.message;
  });
  document.getElementById("sign-out").addEventListener("click", async function () {
    const { error } = await client.auth.signOut();
    if (error) status.textContent = "Sign-out failed: " + error.message;
  });
  document.getElementById("add-link-tab").addEventListener("click", function () { openTabDialog("link"); });
  document.getElementById("add-upload-tab").addEventListener("click", function () { openTabDialog("file"); });
  document.getElementById("cancel-tab").addEventListener("click", function () { tabDialog.close(); });
  document.getElementById("edit-current-tab").addEventListener("click", openEditor);
  document.getElementById("cancel-edit").addEventListener("click", function () { editorDialog.close(); });
  document.getElementById("delete-tab").addEventListener("click", deleteCurrentTab);
  tabForm.addEventListener("submit", function (event) {
    createCustomTab(event).catch(function (error) {
      status.textContent = "Could not add the tab: " + error.message;
    });
  });
  editorForm.addEventListener("submit", function (event) {
    savePage(event).catch(function (error) {
      status.textContent = "Could not save changes: " + error.message;
    });
  });

  if (client) {
    client.auth.getSession().then(function ({ data, error }) {
      if (error) throw error;
      currentUser = data.session ? data.session.user : null;
      isAdmin = Boolean(currentUser && currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL);
      setAdminControls();
      return loadSharedContent();
    }).catch(function (error) {
      status.textContent = "Could not load shared handbook data: " + error.message;
    });
    client.auth.onAuthStateChange(function (_event, session) {
      currentUser = session ? session.user : null;
      isAdmin = Boolean(currentUser && currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL);
      setAdminControls();
    });
  } else {
    setAdminControls();
  }

  window.addEventListener("hashchange", show);
  show();
})();
