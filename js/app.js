/* CJRM UI — mobile-first desk. */
(function (global) {
  const CJRM = global.CJRM || (global.CJRM = {});

  CJRM._now = null;
  CJRM.now = function () {
    return CJRM._now == null ? Date.now() : CJRM._now;
  };

  const ui = {
    view: "desk",
    personId: null,
    personTab: "thread",
    filter: { kind: "open" },
    query: "",
    toast: "",
    hideDemoBanner: false,
    logLine: "phone1",
    logKind: "call",
    logDir: "in",
  };

  let deferredPrompt = null;
  let pollTimer = null;
  let clockTimer = null;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    ui.toast = msg;
    const el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }

  function setView(name, personId) {
    ui.view = name;
    if (personId) ui.personId = personId;
    if (name !== "person") ui.personTab = "thread";
    document.querySelectorAll(".tabbar [data-view]").forEach(function (btn) {
      const on = btn.getAttribute("data-view") === (name === "person" ? "desk" : name);
      btn.setAttribute("aria-current", on ? "page" : "false");
    });
    render();
    $("view").focus({ preventScroll: true });
  }

  function badgeClass(channel) {
    const short = ((CJRM.CHANNEL_META[channel] || {}).short || "?").toLowerCase();
    return "badge badge-" + short;
  }

  function updateChrome() {
    const state = CJRM.getState();
    const now = CJRM.now();
    const pinned = state.people.filter(function (p) { return CJRM.slipOf(p, state.messages, now); });
    const pin = $("pinCount");
    if (pin) {
      pin.hidden = false;
      pin.dataset.empty = pinned.length ? "false" : "true";
      pin.textContent = pinned.length ? pinned.length + (pinned.length === 1 ? " due" : " due") : "All clear";
    }
    const banner = $("demoBanner");
    if (banner) banner.hidden = !state.demo || ui.hideDemoBanner;
  }

  function render() {
    updateChrome();
    const view = $("view");
    view.classList.toggle("person-mode", ui.view === "person");
    if (ui.view === "desk") view.innerHTML = renderDesk();
    else if (ui.view === "person") view.innerHTML = renderPerson();
    else if (ui.view === "add") view.innerHTML = renderAdd();
    else view.innerHTML = renderMore();
    bind();
    if (ui.view === "person" && ui.personTab === "thread") {
      const thread = document.getElementById("thread");
      if (thread) thread.scrollTop = thread.scrollHeight;
    }
  }
  CJRM.render = render;
  CJRM.ui = ui;
  CJRM.setView = setView;

  function renderDesk() {
    const state = CJRM.getState();
    const now = CJRM.now();
    const filtered = state.people.filter(function (p) {
      return CJRM.matchesFilter(p, state.messages, ui.filter, now, ui.query);
    });
    const sorted = CJRM.sortPeople(filtered, state.messages, now);
    const pinned = sorted.filter(function (p) { return CJRM.slipOf(p, state.messages, now); });
    const rest = sorted.filter(function (p) { return !CJRM.slipOf(p, state.messages, now); });
    const counts = {
      open: state.people.filter(function (p) { return CJRM.matchesFilter(p, state.messages, { kind: "open" }, now, ""); }).length,
      slipping: state.people.filter(function (p) { return CJRM.matchesFilter(p, state.messages, { kind: "slipping" }, now, ""); }).length,
      waiting: state.people.filter(function (p) { return CJRM.matchesFilter(p, state.messages, { kind: "waiting" }, now, ""); }).length,
    };

    function chip(kind, label, extra, count) {
      const on = ui.filter.kind === kind && (!extra || ui.filter[kind === "stage" ? "stage" : "channel"] === extra);
      const payload = extra ? kind + ":" + extra : kind;
      return '<button type="button" class="chip" data-filter="' + esc(payload) + '" aria-pressed="' + on + '">' +
        esc(label) + (count != null ? '<span class="n">' + count + "</span>" : "") + "</button>";
    }

    let chips = chip("open", "Open", null, counts.open) +
      chip("slipping", "Needs answer", null, counts.slipping) +
      chip("waiting", "Waiting", null, counts.waiting) +
      chip("all", "All") +
      chip("starred", "Starred") +
      chip("snoozed", "Held");
    (CJRM.CHANNELS || []).forEach(function (c) {
      chips += chip("channel", CJRM.CHANNEL_META[c].short, c);
    });
    (CJRM.STAGES || []).forEach(function (s) {
      chips += chip("stage", CJRM.STAGE_META[s].name, s);
    });

    function row(p) {
      const slip = CJRM.slipOf(p, state.messages, now);
      const timer = slip ? CJRM.slipTimer(p, state.messages, now) : "";
      const preview = CJRM.previewText(state.messages, p.id);
      const used = CJRM.channelsUsed(p, state.messages);
      const cls = "lead" + (slip ? " is-pinned" : "") + (p.unread ? " is-unread" : "");
      return '<li><button type="button" class="' + cls + '" data-open="' + esc(p.id) + '">' +
        '<span class="' + badgeClass(p.channel) + '">' + esc(CJRM.CHANNEL_META[p.channel].short) + "</span>" +
        '<span class="lead-body"><p class="lead-name">' + esc(p.name) +
        (p.starred ? ' <span class="dot-unread" title="Starred" style="background:var(--wood)"></span>' : "") +
        "</p>" +
        (preview ? '<p class="lead-preview">' + esc(preview) + "</p>" : "") +
        '<p class="lead-meta">' + esc(CJRM.STAGE_META[p.stage].name) +
        (p.listing ? " · " + esc(p.listing) : "") +
        (used.length > 1 ? " · " + used.map(function (c) { return CJRM.CHANNEL_META[c].short; }).join(" ") : "") +
        "</p></span>" +
        '<span class="lead-side">' +
        (timer ? '<span class="timer' + (slip === "followup" ? " followup" : "") + '">' + esc(timer) + "</span>" : "") +
        '<span class="lead-age">' + esc(CJRM.shortAge(p.lastMessageAt, now)) + "</span>" +
        (p.unread ? '<span class="dot-unread" aria-label="Unread"></span>' : "") +
        "</span></button></li>";
    }

    if (!state.people.length) {
      return '<div class="empty"><h2>The desk is clear</h2>' +
        "<p>Add a lead by hand, or file a mailbox batch from the Add tab. You can also load the demo data from More.</p>" +
        '<button type="button" class="btn" id="btnGotoAdd">Add a lead</button></div>';
    }
    if (!sorted.length) {
      return '<div class="desk-toolbar"><input class="search" id="search" type="search" placeholder="Search people, numbers, notes" value="' + esc(ui.query) + '"></div>' +
        '<div class="chips" role="toolbar" aria-label="Filters">' + chips + "</div>" +
        '<div class="empty"><h2>Nothing in this filter</h2><p>Try Open, or clear the search.</p></div>';
    }

    let html = '<div class="desk-toolbar"><input class="search" id="search" type="search" placeholder="Search people, numbers, notes" value="' + esc(ui.query) + '"></div>' +
      '<div class="chips" role="toolbar" aria-label="Filters">' + chips + "</div>";
    if (pinned.length) {
      html += '<p class="section-label" id="pinnedLabel">Pinned — needs an answer</p><ul class="list" aria-labelledby="pinnedLabel">' + pinned.map(row).join("") + "</ul>";
    }
    if (rest.length) {
      html += (pinned.length ? '<p class="section-label">The rest of the desk</p>' : "") +
        '<ul class="list">' + rest.map(row).join("") + "</ul>";
    }
    return html;
  }

  function renderPerson() {
    const state = CJRM.getState();
    const person = CJRM.personById(ui.personId);
    if (!person) {
      return '<div class="empty"><h2>Person not found</h2><button type="button" class="btn" id="btnBackDesk">Back to the desk</button></div>';
    }
    const now = CJRM.now();
    const slip = CJRM.slipOf(person, state.messages, now);
    const thread = CJRM.threadOf(state.messages, person.id);
    const head = '<div class="subhead"><button type="button" class="icon-btn" id="btnBackDesk" aria-label="Back to the desk">' +
      '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      "<h1>" + esc(person.name) + "</h1></div>" +
      (slip ? '<p class="section-label">' + esc(CJRM.slipTimer(person, state.messages, now)) + "</p>" : "") +
      '<div class="subtabs" role="tablist">' +
      '<button type="button" role="tab" data-ptab="thread" aria-selected="' + (ui.personTab === "thread") + '">Thread</button>' +
      '<button type="button" role="tab" data-ptab="file" aria-selected="' + (ui.personTab === "file") + '">File</button>' +
      "</div>";

    if (ui.personTab === "file") {
      const stages = (CJRM.STAGES || []).map(function (s) {
        return '<button type="button" class="chip" data-stage="' + s + '" aria-pressed="' + (person.stage === s) + '">' +
          esc(CJRM.STAGE_META[s].name) + "</button>";
      }).join("");
      return head + '<div class="file">' +
        '<p class="lede">' + esc(CJRM.STAGE_META[person.stage].blurb) + "</p>" +
        '<div><span class="label">Stage</span><div class="stage-row">' + stages + "</div></div>" +
        field("Name", "p-name", person.name) +
        field("Job / listing", "p-listing", person.listing) +
        field("Phone", "p-phone", person.phone, "tel") +
        field("Second phone", "p-phone2", person.phone2, "tel") +
        field("Email", "p-email", person.email, "email") +
        field("City", "p-city", person.city) +
        field("Address", "p-address", person.address) +
        field("Instagram handle", "p-ig", person.igHandle) +
        field("Facebook / Messenger", "p-fb", person.fbHandle) +
        '<label class="field"><span>Notes</span><textarea id="p-notes">' + esc(person.notes) + "</textarea></label>" +
        '<div class="row">' +
        '<button type="button" class="btn-wood" id="btnFollow2">+2 days</button>' +
        '<button type="button" class="btn-secondary" id="btnClearFollow">Clear follow-up</button>' +
        '<button type="button" class="btn-secondary" id="btnStar">' + (person.starred ? "Unstar" : "Star") + "</button>" +
        "</div>" +
        (person.followUpAt ? '<p class="lede">Follow-up: ' + esc(CJRM.formatWhen(person.followUpAt)) + "</p>" : "") +
        '<div class="row">' +
        (person.phone || person.phone2 ? '<a class="btn" id="btnCall" href="' + esc(CJRM.telHref(person.phone || person.phone2)) + '">Call</a>' +
          '<a class="btn-secondary" id="btnSms" href="' + esc(CJRM.smsHref(person.phone || person.phone2)) + '">Text</a>' : "") +
        "</div>" +
        "<h2 class='section-label' style='padding:0'>Log a call or text</h2>" +
        '<div class="row">' +
        '<button type="button" class="chip" data-logline="phone1" aria-pressed="true" id="logLineShop">Shop line</button>' +
        '<button type="button" class="chip" data-logline="phone2" aria-pressed="false" id="logLinePers">Personal line</button>' +
        "</div>" +
        '<div class="row">' +
        '<button type="button" class="chip" data-logkind="call" aria-pressed="true" id="logKindCall">Call</button>' +
        '<button type="button" class="chip" data-logkind="text" aria-pressed="false" id="logKindText">Text</button>' +
        '<button type="button" class="chip" data-logdir="in" aria-pressed="true" id="logDirIn">Incoming</button>' +
        '<button type="button" class="chip" data-logdir="out" aria-pressed="false" id="logDirOut">Outgoing</button>' +
        "</div>" +
        '<label class="field"><span>Optional note</span><input id="logNote" placeholder="Missed, left a voicemail, booked a time…"></label>' +
        '<button type="button" class="btn" id="btnLogTap">Log it</button>' +
        '<span class="label">Photos (stay on this device)</span>' +
        '<div class="photos" id="photoGrid"></div>' +
        '<label class="btn-secondary" style="display:inline-flex"><input type="file" id="photoFile" accept="image/*" hidden>Add photo</label>' +
        '<button type="button" class="btn-danger" id="btnRemovePerson">Remove this person</button>' +
        "</div>";
    }

    const bubbles = thread.map(function (m) {
      const who = m.direction === "note" ? "Note" : (m.direction === "out" ? "You" : "Them") + " · " + CJRM.CHANNEL_META[m.channel].name;
      return '<article class="bubble ' + m.direction + '"><p class="who">' + esc(who) + "</p><p>" + esc(m.body) +
        "</p><time datetime=\"" + esc(m.at) + '">' + esc(CJRM.formatWhen(m.at)) + "</time></article>";
    }).join("") || "<p class='lede'>No messages yet. Log a call or paste a reply below.</p>";

    const templates = (state.templates || []).map(function (t) {
      return '<button type="button" class="chip" data-tpl="' + esc(t.id) + '">' + esc(t.title) + "</button>";
    }).join("");

    const channelOpts = (CJRM.CHANNELS || []).map(function (c) {
      const sel = c === person.channel ? " selected" : "";
      return '<option value="' + c + '"' + sel + ">" + esc(CJRM.CHANNEL_META[c].name) + "</option>";
    }).join("");

    return head + '<div class="thread" id="thread">' + bubbles + "</div>" +
      '<div class="composer">' +
      '<div class="row" style="margin-top:0">' + templates + "</div>" +
      '<textarea id="replyBody" placeholder="Write a reply to copy into the other app, or a note for the file."></textarea>' +
      '<div class="row"><label class="field" style="flex:1"><span>Send via</span>' +
      '<select id="replyVia">' + channelOpts + "</select></label></div>" +
      '<div class="row">' +
      '<button type="button" class="btn" id="btnCopyReply">Copy reply</button>' +
      '<button type="button" class="btn-wood" id="btnOpenApp">Open in app</button>' +
      '<button type="button" class="btn-secondary" id="btnLogOut">Log as sent</button>' +
      '<button type="button" class="btn-ghost" id="btnNote">Save note</button>' +
      "</div></div>";
  }

  function field(label, id, value, type) {
    return '<label class="field"><span>' + esc(label) + '</span><input id="' + id + '" type="' + (type || "text") + '" value="' + esc(value || "") + '"></label>';
  }

  function renderAdd() {
    const chOpts = (CJRM.CHANNELS || []).map(function (c) {
      return '<option value="' + c + '">' + esc(CJRM.CHANNEL_META[c].name) + "</option>";
    }).join("");
    return '<div class="page"><h1>Add to the desk</h1>' +
      '<p class="lede">Log a new lead by hand, file a mailbox paste, or tap a one-tap call or text after you open a person.</p>' +
      '<div class="stack card">' +
      "<h2 style='margin-top:0'>New lead</h2>" +
      field("Name", "add-name", "") +
      '<label class="field"><span>Channel</span><select id="add-channel">' + chOpts + "</select></label>" +
      field("Phone", "add-phone", "", "tel") +
      field("Email", "add-email", "", "email") +
      field("City", "add-city", "") +
      field("Job / listing", "add-listing", "") +
      '<label class="field"><span>First message</span><textarea id="add-body" placeholder="What they wrote, or what you want on the file."></textarea></label>' +
      '<button type="button" class="btn wide" id="btnSaveLead">Save lead</button>' +
      "</div>" +
      '<div class="stack card">' +
      "<h2 style='margin-top:0'>File mailbox paste</h2>" +
      "<p class='lede'>Paste letters that start with From:. Kijiji replies, Facebook and Instagram notices, and forwarded texts all file from here.</p>" +
      '<label class="field"><span>Mailbox text</span><textarea id="mailboxText" placeholder="From: Kijiji &lt;reply@kijiji.example.invalid&gt;&#10;Subject: Reply from …"></textarea></label>' +
      '<div class="row"><button type="button" class="btn" id="btnFileMail">File these letters</button>' +
      '<button type="button" class="btn-secondary" id="btnSampleMail">File a sample batch</button></div>' +
      "</div></div>";
  }

  function renderMore() {
    const state = CJRM.getState();
    const s = state.settings || {};
    const last = s.lastPollAt ? CJRM.formatWhen(s.lastPollAt) : "Never";
    const status = s.lastPollAt
      ? (s.lastPollOk ? '<p class="status-ok">Last check: ' + esc(last) + "</p>"
        : '<p class="status-bad">Last check failed: ' + esc(s.lastPollError || last) + "</p>")
      : "<p class='lede'>The mailbox has not been checked yet.</p>";
    const tpls = (state.templates || []).map(function (t, i) {
      return '<label class="field"><span>Template ' + (i + 1) + ' title</span><input data-ttitle="' + esc(t.id) + '" value="' + esc(t.title) + '"></label>' +
        '<label class="field"><span>Body</span><textarea data-tbody="' + esc(t.id) + '">' + esc(t.body) + "</textarea></label>";
    }).join("");
    return '<div class="page">' +
      '<h1>More</h1>' +
      '<p class="lede">Settings, backup, and install. Everything stays on this phone unless you export it.</p>' +
      '<p class="version" id="appVersion">Version ' + esc(CJRM.VERSION) + "</p>" +
      '<div class="card stack">' +
      "<h2 style='margin-top:0'>Mailbox hub</h2>" +
      "<p class='lede'>Paste the Apps Script web-app URL and the shared secret from ONBOARDING.md. The desk checks for new mail on its own while it is open.</p>" +
      field("Endpoint URL", "hubUrl", s.hubUrl, "url") +
      '<label class="field"><span>Shared secret</span><input id="hubSecret" type="password" value="' + esc(s.hubSecret) + '" autocomplete="off"></label>' +
      field("Shop line (for tagging forwarded texts)", "shopPhone", s.shopPhone, "tel") +
      field("Personal line", "personalPhone", s.personalPhone, "tel") +
      status +
      '<div class="row"><button type="button" class="btn" id="btnSaveHub">Save hub settings</button>' +
      '<button type="button" class="btn-secondary" id="btnPollNow">Check mailbox now</button></div>' +
      "</div>" +
      '<div class="card stack">' +
      "<h2 style='margin-top:0'>Quick replies</h2>" + tpls +
      '<button type="button" class="btn-secondary" id="btnSaveTpl">Save templates</button>' +
      "</div>" +
      '<div class="card stack">' +
      "<h2 style='margin-top:0'>Backup</h2>" +
      "<p class='lede'>Export a JSON copy of the desk, or import one. Photos stay in this browser unless you export separately later.</p>" +
      '<div class="row"><button type="button" class="btn" id="btnExport">Export desk</button>' +
      '<label class="btn-secondary" style="display:inline-flex"><input type="file" id="importFile" accept="application/json,.json" hidden>Import desk</label></div>' +
      "</div>" +
      '<div class="card stack">' +
      "<h2 style='margin-top:0'>Demo data</h2>" +
      "<p class='lede'>The sample desk uses fictional 555 numbers and example.com addresses. It is clearly marked as demo data.</p>" +
      '<div class="row"><button type="button" class="btn-wood" id="btnLoadDemo">Load demo data</button>' +
      '<button type="button" class="btn-danger" id="btnClearDesk">Clear the desk</button></div>' +
      "</div>" +
      '<div class="card stack">' +
      "<h2 style='margin-top:0'>Install</h2>" +
      "<p class='lede'>On Johnny's Android phone: open this page in Chrome, tap the menu, then Install app. The icon is the CJ stamp. Data stays on the device.</p>" +
      '<button type="button" class="btn" id="btnInstallMore">Install app</button>' +
      "</div>" +
      '<p class="lede">CJRM is a personal desk for Carpenter Johnny. It is not for sale and has no subscription.</p>' +
      "</div>";
  }

  function bind() {
    const view = $("view");

    view.querySelectorAll("[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const raw = btn.getAttribute("data-filter");
        if (raw.indexOf("channel:") === 0) ui.filter = { kind: "channel", channel: raw.slice(8) };
        else if (raw.indexOf("stage:") === 0) ui.filter = { kind: "stage", stage: raw.slice(6) };
        else ui.filter = { kind: raw };
        render();
      });
    });
    const search = $("search");
    if (search) {
      search.addEventListener("input", function () {
        ui.query = search.value;
        /* re-render would steal focus; update list live by re-render is ok if we restore caret */
        const pos = search.selectionStart;
        render();
        const again = $("search");
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      });
    }
    view.querySelectorAll("[data-open]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-open");
        CJRM.patchPerson(id, { unread: false });
        ui.personTab = "thread";
        setView("person", id);
      });
    });
    if ($("btnGotoAdd")) $("btnGotoAdd").addEventListener("click", function () { setView("add"); });
    if ($("btnBackDesk")) $("btnBackDesk").addEventListener("click", function () { setView("desk"); });

    view.querySelectorAll("[data-ptab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ui.personTab = btn.getAttribute("data-ptab");
        render();
      });
    });
    view.querySelectorAll("[data-stage]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        CJRM.patchPerson(ui.personId, { stage: btn.getAttribute("data-stage") });
        render();
      });
    });

    function bindField(id, key, transform) {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", function () {
        const val = transform ? transform(el.value) : el.value;
        CJRM.patchPerson(ui.personId, { [key]: val });
      });
    }
    bindField("p-name", "name");
    bindField("p-listing", "listing");
    bindField("p-phone", "phone");
    bindField("p-phone2", "phone2");
    bindField("p-email", "email");
    bindField("p-city", "city");
    bindField("p-address", "address");
    bindField("p-ig", "igHandle");
    bindField("p-fb", "fbHandle");
    if ($("p-notes")) $("p-notes").addEventListener("change", function () {
      CJRM.patchPerson(ui.personId, { notes: $("p-notes").value });
    });
    if ($("btnFollow2")) $("btnFollow2").addEventListener("click", function () {
      CJRM.patchPerson(ui.personId, { followUpAt: CJRM.plusDays(2, CJRM.now()) });
      toast("Follow-up set for two days from now.");
      render();
    });
    if ($("btnClearFollow")) $("btnClearFollow").addEventListener("click", function () {
      CJRM.patchPerson(ui.personId, { followUpAt: null });
      render();
    });
    if ($("btnStar")) $("btnStar").addEventListener("click", function () {
      const p = CJRM.personById(ui.personId);
      CJRM.patchPerson(ui.personId, { starred: !p.starred });
      render();
    });
    if ($("btnRemovePerson")) $("btnRemovePerson").addEventListener("click", function () {
      if (!confirm("Remove this person and their thread from this device?")) return;
      CJRM.removePerson(ui.personId);
      ui.personId = null;
      setView("desk");
    });
    function pressGroup(attr, value) {
      view.querySelectorAll("[" + attr + "]").forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute(attr) === value ? "true" : "false");
      });
    }
    view.querySelectorAll("[data-logline]").forEach(function (btn) {
      btn.addEventListener("click", function () { ui.logLine = btn.getAttribute("data-logline"); pressGroup("data-logline", ui.logLine); });
    });
    view.querySelectorAll("[data-logkind]").forEach(function (btn) {
      btn.addEventListener("click", function () { ui.logKind = btn.getAttribute("data-logkind"); pressGroup("data-logkind", ui.logKind); });
    });
    view.querySelectorAll("[data-logdir]").forEach(function (btn) {
      btn.addEventListener("click", function () { ui.logDir = btn.getAttribute("data-logdir"); pressGroup("data-logdir", ui.logDir); });
    });
    if ($("btnLogTap")) $("btnLogTap").addEventListener("click", function () {
      const line = ui.logLine || "phone1";
      const kind = ui.logKind || "call";
      const dir = ui.logDir || "in";
      const note = (($("logNote") || {}).value || "").trim();
      const lineName = line === "phone2" ? "personal line" : "shop line";
      const body = (dir === "in" ? "Incoming " : "Outgoing ") + kind + " on the " + lineName + (note ? " — " + note : ".");
      CJRM.addMessage(ui.personId, { direction: dir, channel: line, body: body });
      toast("Logged the " + kind + ".");
      ui.personTab = "thread";
      render();
    });
    if ($("photoFile")) {
      $("photoFile").addEventListener("change", async function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        await CJRM.savePhoto(ui.personId, file);
        render();
      });
      fillPhotos(ui.personId);
    }

    view.querySelectorAll("[data-tpl]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const t = CJRM.getState().templates.find(function (x) { return x.id === btn.getAttribute("data-tpl"); });
        if (t && $("replyBody")) $("replyBody").value = t.body;
      });
    });
    if ($("btnCopyReply")) $("btnCopyReply").addEventListener("click", async function () {
      const body = ($("replyBody") || {}).value || "";
      if (!body.trim()) { toast("Write a reply first."); return; }
      try { await navigator.clipboard.writeText(body); toast("Copied. Paste it in the other app to send."); }
      catch (e) { toast("Copy failed. Select the text and copy it yourself."); }
    });
    if ($("btnOpenApp")) $("btnOpenApp").addEventListener("click", function () {
      const person = CJRM.personById(ui.personId);
      const via = $("replyVia").value;
      const body = ($("replyBody") || {}).value || "";
      const href = CJRM.openLinkFor(via, person, body);
      if (!href) { toast("Add a phone, email, or handle on the File tab first."); return; }
      window.open(href, "_blank");
    });
    if ($("btnLogOut")) $("btnLogOut").addEventListener("click", function () {
      const body = ($("replyBody") || {}).value || "";
      const via = $("replyVia").value;
      if (!CJRM.addMessage(ui.personId, { direction: "out", channel: via, body: body })) {
        toast("Write something to log.");
        return;
      }
      $("replyBody").value = "";
      toast("Logged as sent. Send it from the other app if you have not already.");
      render();
    });
    if ($("btnNote")) $("btnNote").addEventListener("click", function () {
      const body = ($("replyBody") || {}).value || "";
      const via = $("replyVia").value;
      if (!CJRM.addMessage(ui.personId, { direction: "note", channel: via, body: body })) {
        toast("Write a note first.");
        return;
      }
      $("replyBody").value = "";
      render();
    });

    if ($("btnSaveLead")) $("btnSaveLead").addEventListener("click", function () {
      const name = $("add-name").value.trim() || "New lead";
      const channel = $("add-channel").value;
      const body = $("add-body").value.trim() || "Logged by hand.";
      const person = CJRM.newPerson({
        name: name,
        channel: channel,
        phone: $("add-phone").value.trim(),
        email: $("add-email").value.trim(),
        city: $("add-city").value.trim(),
        listing: $("add-listing").value.trim(),
      }, body);
      CJRM.setState({ demo: false });
      ui.personTab = "thread";
      setView("person", person.id);
      toast("Lead saved on the desk.");
    });
    if ($("btnFileMail")) $("btnFileMail").addEventListener("click", function () {
      const pieces = CJRM.parseMailbox($("mailboxText").value);
      if (!pieces.length) { toast("Paste letters that start with From:."); return; }
      const result = CJRM.filePieces(pieces);
      toast("Filed " + result.filed + (result.filed === 1 ? " letter." : " letters."));
      setView("desk");
    });
    if ($("btnSampleMail")) $("btnSampleMail").addEventListener("click", function () {
      const result = CJRM.filePieces(CJRM.parseMailbox(CJRM.SAMPLE_MAILBOX));
      toast("Filed " + result.filed + " sample letters. They are fictional.");
      setView("desk");
    });

    if ($("btnSaveHub")) $("btnSaveHub").addEventListener("click", function () {
      const settings = Object.assign({}, CJRM.getState().settings, {
        hubUrl: $("hubUrl").value.trim(),
        hubSecret: $("hubSecret").value,
        shopPhone: $("shopPhone").value.trim(),
        personalPhone: $("personalPhone").value.trim(),
      });
      CJRM.setState({ settings: settings });
      schedulePoll();
      toast("Hub settings saved on this device.");
      render();
    });
    if ($("btnPollNow")) $("btnPollNow").addEventListener("click", async function () {
      try {
        const r = await CJRM.pollHub();
        toast("Checked the mailbox. Filed " + r.filed + " new " + (r.filed === 1 ? "item." : "items."));
      } catch (err) {
        CJRM.recordPollError(err);
        toast(err.message || "Mailbox check failed.");
      }
      render();
    });
    if ($("btnSaveTpl")) $("btnSaveTpl").addEventListener("click", function () {
      const templates = (CJRM.getState().templates || []).map(function (t) {
        const title = view.querySelector('[data-ttitle="' + t.id + '"]');
        const body = view.querySelector('[data-tbody="' + t.id + '"]');
        return { id: t.id, title: title ? title.value : t.title, body: body ? body.value : t.body };
      });
      CJRM.setState({ templates: templates });
      toast("Templates saved.");
    });
    if ($("btnExport")) $("btnExport").addEventListener("click", function () {
      const bag = CJRM.exportBag();
      const blob = new Blob([JSON.stringify(bag, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cjrm-backup.json";
      a.click();
      toast("Backup downloaded. Keep it off shared chats.");
    });
    if ($("importFile")) $("importFile").addEventListener("change", async function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const err = CJRM.importBag(text);
      toast(err || "Desk imported.");
      if (!err) setView("desk");
      else render();
    });
    if ($("btnLoadDemo")) $("btnLoadDemo").addEventListener("click", function () {
      if (CJRM.getState().people.length && !confirm("Replace the current desk with fictional demo leads?")) return;
      CJRM.loadDemo(CJRM.now());
      ui.hideDemoBanner = false;
      setView("desk");
    });
    if ($("btnClearDesk")) $("btnClearDesk").addEventListener("click", function () {
      if (!confirm("Clear every person and message on this device?")) return;
      CJRM.clearDesk();
      setView("desk");
    });
    if ($("btnInstallMore")) $("btnInstallMore").addEventListener("click", function () {
      offerInstall(true);
    });
  }

  async function fillPhotos(personId) {
    const person = CJRM.personById(personId);
    const grid = $("photoGrid");
    if (!person || !grid) return;
    for (const id of person.photoIds || []) {
      try {
        const rec = await CJRM.loadPhoto(id);
        if (!rec) continue;
        const fig = document.createElement("figure");
        const img = document.createElement("img");
        img.alt = "Photo on file";
        img.src = URL.createObjectURL(rec.blob);
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "rm";
        rm.setAttribute("aria-label", "Remove photo");
        rm.textContent = "×";
        rm.addEventListener("click", async function () {
          await CJRM.deletePhoto(personId, id);
          render();
        });
        fig.appendChild(img);
        fig.appendChild(rm);
        grid.appendChild(fig);
      } catch (e) { /* skip */ }
    }
  }

  function offerInstall(force) {
    const banner = $("installBanner");
    const copy = $("installCopy");
    const steps = $("iosSteps");
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (standalone) {
      if (force) toast("CJRM is already installed.");
      return;
    }
    if (deferredPrompt) {
      if (force) {
        deferredPrompt.prompt();
        return;
      }
      copy.textContent = "Install CJRM on this phone. The icon is the CJ stamp. Your desk stays on the device.";
      steps.hidden = true;
      $("btnInstallNow").hidden = false;
      banner.hidden = false;
      $("btnInstall").hidden = false;
      return;
    }
    if (force || /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      copy.textContent = "Install from the browser menu so the desk has its own icon.";
      steps.hidden = false;
      $("btnInstallNow").hidden = true;
      banner.hidden = false;
      $("btnInstall").hidden = false;
    }
  }

  function schedulePoll() {
    if (pollTimer) clearInterval(pollTimer);
    const s = CJRM.getState().settings || {};
    if (!s.hubUrl) return;
    const ms = Math.max(1, Number(s.pollMinutes) || 5) * 60 * 1000;
    pollTimer = setInterval(function () {
      CJRM.pollHub().then(function () { updateChrome(); }).catch(function (err) { CJRM.recordPollError(err); });
    }, ms);
  }

  function startClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(function () {
      if (ui.view === "desk") render();
      else updateChrome();
    }, 30000);
  }

  function wireShell() {
    $("btnHome").addEventListener("click", function () { setView("desk"); });
    document.querySelectorAll(".tabbar [data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () { setView(btn.getAttribute("data-view")); });
    });
    if ($("btnDismissDemo")) $("btnDismissDemo").addEventListener("click", function () {
      ui.hideDemoBanner = true;
      $("demoBanner").hidden = true;
    });
    $("btnInstall").addEventListener("click", function () { offerInstall(true); });
    $("btnInstallNow").addEventListener("click", function () {
      if (deferredPrompt) deferredPrompt.prompt();
    });
    $("btnInstallDismiss").addEventListener("click", function () { $("installBanner").hidden = true; });
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      $("btnInstall").hidden = false;
    });
  }

  CJRM.start = function () {
    CJRM.hydrate();
    wireShell();
    render();
    offerInstall(false);
    schedulePoll();
    startClock();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline register can wait */ });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", CJRM.start);
  else CJRM.start();
})(window);
