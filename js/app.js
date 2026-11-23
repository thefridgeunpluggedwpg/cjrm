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
    replyOpen: false,
  };

  let deferredPrompt = null;
  let clockTimer = null;
  let pendingNewCount = 0;

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

  function paintNewBadge() {
    const el = $("newCount");
    if (!el) return;
    if (!pendingNewCount) {
      el.hidden = true;
      el.textContent = "New";
      return;
    }
    el.hidden = false;
    el.textContent = pendingNewCount === 1 ? "1 new" : pendingNewCount + " new";
  }

  function clearNewBadge() {
    pendingNewCount = 0;
    paintNewBadge();
  }

  function messageToast(filed, names) {
    const n = Number(filed) || 0;
    const unique = [];
    (names || []).forEach(function (name) {
      const label = String(name || "").trim();
      if (label && unique.indexOf(label) === -1) unique.push(label);
    });
    if (n === 1 && unique[0]) return "1 new message from " + unique[0];
    if (n > 1 && unique.length === 1) return n + " new messages from " + unique[0];
    if (unique.length === 2) return n + " new messages from " + unique[0] + " and " + unique[1];
    if (unique.length > 2) return n + " new messages from " + unique[0] + " and " + (unique.length - 1) + " others";
    return n === 1 ? "1 new message on the desk." : n + " new messages on the desk.";
  }

  function notifyNewItems(filed, names) {
    const n = Number(filed) || 0;
    if (n <= 0) return;
    pendingNewCount += n;
    toast(messageToast(n, names));
    paintNewBadge();
    if (typeof CJRM.refresh === "function") CJRM.refresh();
  }

  function revealFiledOnDesk() {
    ui.filter = { kind: "open" };
    ui.query = "";
  }

  function setView(name, personId) {
    ui.view = name;
    if (personId && personId !== ui.personId) ui.replyOpen = false;
    if (personId) ui.personId = personId;
    if (name === "desk" || name === "person") clearNewBadge();
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
    paintNewBadge();
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
      if (thread) {
        const last = thread.querySelector(".bubble-wrap:last-child .bubble, .bubble:last-child");
        thread.scrollTop = thread.scrollHeight;
        if (last && last.scrollIntoView) last.scrollIntoView({ block: "end", inline: "nearest" });
      }
    }
  }
  CJRM.render = render;
  CJRM.ui = ui;
  CJRM.setView = setView;

  function renderDesk() {
    const state = CJRM.getState();
    const now = CJRM.now();
    const filtered = state.people.filter(function (p) {
      if (CJRM.isFresh && CJRM.isFresh(p) && (!ui.query || CJRM.matchesFilter(p, state.messages, { kind: "all" }, now, ui.query))) {
        return ui.filter.kind !== "channel" && ui.filter.kind !== "stage" ? true : CJRM.matchesFilter(p, state.messages, ui.filter, now, ui.query);
      }
      return CJRM.matchesFilter(p, state.messages, ui.filter, now, ui.query);
    });
    const sorted = CJRM.sortPeople(filtered, state.messages, now);
    const fresh = sorted.filter(function (p) { return CJRM.isFresh && CJRM.isFresh(p); });
    const pinned = sorted.filter(function (p) { return !CJRM.isFresh(p) && CJRM.slipOf(p, state.messages, now); });
    const rest = sorted.filter(function (p) { return !CJRM.isFresh(p) && !CJRM.slipOf(p, state.messages, now); });
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
      const preview = CJRM.previewLine
        ? CJRM.previewLine(CJRM.previewText(state.messages, p.id), p.listing)
        : CJRM.previewText(state.messages, p.id);
      const used = CJRM.channelsUsed(p, state.messages);
      const fresh = CJRM.isFresh && CJRM.isFresh(p);
      const cls = "lead" + (slip ? " is-pinned" : "") + (p.unread ? " is-unread" : "") + (fresh ? " is-fresh" : "");
      const lastTalk = CJRM.lastSpoken ? CJRM.lastSpoken(state.messages, p.id) : null;
      const badgeChannel = (lastTalk && lastTalk.channel) || p.channel;
      const badgeLabel = CJRM.sourceLabel ? CJRM.sourceLabel(badgeChannel) : ((CJRM.CHANNEL_META[badgeChannel] || {}).short || "?");
      const stageMeta = CJRM.STAGE_META[p.stage] || { name: p.stage || "" };
      const subject = String(p.listing || "").trim();
      const showSubject = subject && subject.toLowerCase() !== String(p.name || "").toLowerCase();
      return '<li class="swipe-item" data-person-swipe="' + esc(p.id) + '">' +
        '<div class="swipe-actions"><button type="button" class="btn-swipe-del" data-del-person="' + esc(p.id) + '">Delete</button></div>' +
        '<button type="button" class="' + cls + '" data-open="' + esc(p.id) + '">' +
        '<span class="' + badgeClass(badgeChannel) + '">' + esc(badgeLabel) + "</span>" +
        '<span class="lead-body"><p class="lead-name">' + esc(p.name) +
        (p.starred ? ' <span class="dot-unread" title="Starred" style="background:var(--wood)"></span>' : "") +
        "</p>" +
        (showSubject ? '<p class="lead-subject">' + esc(subject) + "</p>" : "") +
        (preview ? '<p class="lead-preview">' + esc(preview) + "</p>" : "") +
        '<p class="lead-meta">' + esc(stageMeta.name) +
        (used.length > 1 ? " · " + used.map(function (c) { return CJRM.sourceLabel ? CJRM.sourceLabel(c) : ((CJRM.CHANNEL_META[c] || {}).short || c); }).join(" ") : "") +
        "</p></span>" +
        '<span class="lead-side">' +
        (fresh ? '<span class="fresh-tag">New</span>' : "") +
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
    if (fresh.length) {
      html += '<p class="section-label" id="freshLabel">New</p><ul class="list" id="freshList" aria-labelledby="freshLabel">' + fresh.map(row).join("") + "</ul>";
    }
    if (pinned.length) {
      html += '<p class="section-label" id="pinnedLabel">Pinned — needs an answer</p><ul class="list" aria-labelledby="pinnedLabel">' + pinned.map(row).join("") + "</ul>";
    }
    if (rest.length) {
      html += (fresh.length || pinned.length ? '<p class="section-label">The rest of the desk</p>' : "") +
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
    const lastTalk = CJRM.lastSpoken ? CJRM.lastSpoken(state.messages, person.id) : null;
    const sourceChannel = (lastTalk && lastTalk.channel) || person.channel;
    const source = CJRM.sourceLabel ? CJRM.sourceLabel(sourceChannel) : ((CJRM.CHANNEL_META[sourceChannel] || {}).name || "");
    const subject = String(person.listing || "").trim();
    const head = '<div class="person-sheet"><div class="subhead"><button type="button" class="icon-btn" id="btnBackDesk" aria-label="Back to the desk">' +
      '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      "<h1>" + esc(person.name) + "</h1></div>" +
      '<p class="person-source"><span class="' + badgeClass(sourceChannel) + '">' + esc(source) + "</span>" +
      (subject ? esc(subject) : "") + "</p>" +
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
        '<button type="button" class="chip" data-logline="phone1" aria-pressed="true" id="logLineShop">Winnipeg number</button>' +
        '<button type="button" class="chip" data-logline="phone2" aria-pressed="false" id="logLinePers">Toronto number</button>' +
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
        "</div></div>";
    }

    const bubbles = thread.map(function (m) {
      const meta = CJRM.CHANNEL_META[m.channel] || {};
      const who = m.direction === "note" ? "Note" : (m.direction === "out" ? "You" : (person.name || "Them")) + " · " + (CJRM.sourceLabel ? CJRM.sourceLabel(m.channel) : (meta.name || ""));
      return '<div class="swipe-item bubble-wrap ' + m.direction + '" data-msg-swipe="' + esc(m.id) + '">' +
        '<div class="swipe-actions"><button type="button" class="btn-swipe-del" data-del-msg="' + esc(m.id) + '">Delete</button></div>' +
        '<article class="bubble ' + m.direction + '"><p class="who">' + esc(who) + "</p><p>" + esc(m.body) +
        "</p><time datetime=\"" + esc(m.at) + '">' + esc(CJRM.formatWhen(m.at)) + "</time></article></div>";
    }).join("") || "<p class='lede'>No messages yet. Log a call or write a reply below.</p>";

    const templates = (state.templates || []).map(function (t) {
      return '<button type="button" class="chip" data-tpl="' + esc(t.id) + '">' + esc(t.title) + "</button>";
    }).join("");

    const channelOpts = (CJRM.CHANNELS || []).map(function (c) {
      const sel = c === person.channel ? " selected" : "";
      return '<option value="' + c + '"' + sel + ">" + esc((CJRM.CHANNEL_META[c] || {}).name || c) + "</option>";
    }).join("");

    const actionsHidden = ui.replyOpen ? "" : " hidden";
    return head + '<div class="thread" id="thread">' + bubbles + "</div>" +
      '<div class="composer' + (ui.replyOpen ? " is-open" : "") + '" id="composer">' +
      (templates ? '<div class="tpl-row">' + templates + "</div>" : "") +
      '<div class="composer-bar">' +
      '<label class="visually-hidden" for="replyBody">Write a reply</label>' +
      '<textarea id="replyBody" rows="1" placeholder="Write a reply"></textarea>' +
      '<button type="button" class="btn" id="btnToggleReply">' + (ui.replyOpen ? "Hide" : "Reply") + "</button>" +
      "</div>" +
      '<div class="composer-actions" id="composerActions"' + actionsHidden + ">" +
      '<label class="field composer-via"><span>Send via</span>' +
      '<select id="replyVia">' + channelOpts + "</select></label>" +
      '<div class="composer-btns">' +
      '<button type="button" class="btn" id="btnCopyReply">Copy reply</button>' +
      '<button type="button" class="btn-wood" id="btnOpenApp">Open in app</button>' +
      '<button type="button" class="btn-secondary" id="btnLogOut">Log as sent</button>' +
      '<button type="button" class="btn-ghost" id="btnNote">Save note</button>' +
      "</div></div></div></div>";
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


  function renderNativeCards() {
    if (!(CJRM.isNativeApp && CJRM.isNativeApp())) return "";
    return '<div class="card stack" id="nativeSmsCard">' +
      "<h2 style='margin-top:0'>Winnipeg number texts (this phone's SIM)</h2>" +
      "<p class='lede'>The Android app can file incoming texts from this phone's SIM as the Winnipeg number, even when the app is closed. The mailbox hub still works the same way.</p>" +
      '<p id="smsStatus" class="lede">Checking text permission…</p>' +
      "<p class='lede'>If the phone will not let you turn texts on, open App info, tap the three dots at the top, then tap <strong>Allow restricted settings</strong>. Then come back and tap Allow texts again. This is common on Android 13 and newer.</p>" +
      '<div class="row">' +
      '<button type="button" class="btn" id="btnSmsAllow">Allow texts</button>' +
      '<button type="button" class="btn-secondary" id="btnSmsAppInfo">Open App info</button>' +
      '<button type="button" class="btn-secondary" id="btnSmsImport">Import recent texts</button>' +
      "</div></div>" +
      '<div class="card stack" id="nativeVoipCard">' +
      "<h2 style='margin-top:0'>Toronto number texts (optional)</h2>" +
      "<p class='lede'>If the Toronto number lives in a VoIP app, CJRM can file that app's message notifications as the Toronto number. This is off until you turn on notification access and pick the app. Winnipeg SIM texts still work if you skip this.</p>" +
      '<p id="voipStatus" class="lede">Checking notification access…</p>' +
      '<label class="field"><span>Toronto messaging app</span><select id="voipApp"><option value="">None — Toronto capture is off</option></select></label>' +
      '<div class="row">' +
      '<button type="button" class="btn" id="btnVoipAccess">Open notification access</button>' +
      '<button type="button" class="btn-secondary" id="btnVoipSave">Save Toronto app</button>' +
      "</div></div>";
  }

  async function fillNativeUi() {
    if (!(CJRM.isNativeApp && CJRM.isNativeApp())) return;
    const smsEl = $("smsStatus");
    const voipEl = $("voipStatus");
    const select = $("voipApp");
    try {
      const status = await CJRM.nativeGetStatus();
      const smsOn = !!(status.smsReceiveGranted);
      const smsRead = !!(status.smsReadGranted);
      if (smsEl) {
        if (smsOn) {
          smsEl.className = "status-ok";
          smsEl.textContent = "Texts from this phone's SIM will be filed as the Winnipeg number" + (smsRead ? ". Recent texts can be imported too." : ". Turn on read access if you want to import recent texts.");
        } else {
          smsEl.className = "status-bad";
          smsEl.textContent = "Texts are not allowed yet. Tap Allow texts. If the switch is missing or greyed out, use Allow restricted settings in App info first.";
        }
      }
      if (select && !select.dataset.loaded) {
        const apps = await CJRM.nativeListApps();
        const current = status.voipPackage || "";
        const seen = {};
        apps.forEach(function (app) {
          if (!app || !app.packageName || seen[app.packageName]) return;
          seen[app.packageName] = true;
          const opt = document.createElement("option");
          opt.value = app.packageName;
          opt.textContent = (app.label || app.packageName) + " (" + app.packageName + ")";
          if (app.packageName === current) opt.selected = true;
          select.appendChild(opt);
        });
        if (current && !seen[current]) {
          const opt = document.createElement("option");
          opt.value = current;
          opt.textContent = (status.voipAppLabel || current) + " (" + current + ")";
          opt.selected = true;
          select.appendChild(opt);
        }
        select.dataset.loaded = "1";
      } else if (select && status.voipPackage) {
        select.value = status.voipPackage;
      }
      if (voipEl) {
        const access = !!(status.notificationAccess);
        const pkg = status.voipPackage || "";
        const label = status.voipAppLabel || pkg;
        if (!access && !pkg) {
          voipEl.className = "lede";
          voipEl.textContent = "Toronto capture is off. To use it, tap Open notification access, turn on CJRM, then pick the Toronto app and tap Save Toronto app.";
        } else if (!access) {
          voipEl.className = "status-bad";
          voipEl.textContent = "Notification access is off, so Toronto texts are not being captured. Tap Open notification access and turn on CJRM.";
        } else if (!pkg) {
          voipEl.className = "lede";
          voipEl.textContent = "Notification access is on. Pick the app that receives the Toronto number's texts, then tap Save Toronto app.";
        } else {
          voipEl.className = "status-ok";
          voipEl.textContent = "Toronto texts from " + label + " will be filed as the Toronto number.";
        }
      }
    } catch (err) {
      if (smsEl) {
        smsEl.className = "status-bad";
        smsEl.textContent = "Could not check text permission. " + (err && err.message ? err.message : "");
      }
    }
  }

  function bindNative() {
    if ($("btnSmsAllow")) $("btnSmsAllow").addEventListener("click", async function () {
      try {
        await CJRM.nativeRequestSmsPermission();
        toast("Checking text permission.");
      } catch (err) {
        toast(err.message || "Could not ask for text permission.");
      }
      fillNativeUi();
    });
    if ($("btnSmsAppInfo")) $("btnSmsAppInfo").addEventListener("click", async function () {
      try { await CJRM.nativeOpenAppInfo(); } catch (err) { toast(err.message || "Could not open App info."); }
    });
    if ($("btnSmsImport")) $("btnSmsImport").addEventListener("click", async function () {
      try {
        const r = await CJRM.nativeImportRecentSms();
        toast("Imported texts. Filed " + r.filed + " new " + (r.filed === 1 ? "item." : "items."));
      } catch (err) {
        toast(err.message || "Could not import recent texts. Allow texts, including read access, first.");
      }
      fillNativeUi();
    });
    if ($("btnVoipAccess")) $("btnVoipAccess").addEventListener("click", async function () {
      try { await CJRM.nativeOpenNotificationAccess(); } catch (err) { toast(err.message || "Could not open notification access."); }
    });
    if ($("btnVoipSave")) $("btnVoipSave").addEventListener("click", async function () {
      const select = $("voipApp");
      const pkg = select ? select.value : "";
      const label = select && select.selectedIndex >= 0 ? select.options[select.selectedIndex].textContent : "";
      try {
        await CJRM.nativeSetVoipApp(pkg, label);
        toast(pkg ? "Toronto app saved." : "Toronto capture is off.");
      } catch (err) {
        toast(err.message || "Could not save the Toronto app.");
      }
      fillNativeUi();
    });
    if ($("nativeSmsCard")) fillNativeUi();
  }

  function renderMore() {
    const state = CJRM.getState();
    const s = state.settings || {};
    const last = s.lastPollAt ? CJRM.formatWhen(s.lastPollAt) : "Never";
    const counts = (s.lastPollOk && s.lastPollAt)
      ? " · fetched " + Number(s.lastPollFetched || 0) + ", filed " + Number(s.lastPollFiled || 0)
      : "";
    const status = s.lastPollAt
      ? (s.lastPollOk ? '<p class="status-ok" id="hubLastCheck">Last check: ' + esc(last) + esc(counts) + "</p>"
        : '<p class="status-bad" id="hubLastCheck">Last check failed: ' + esc(s.lastPollError || last) + "</p>")
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
      "<p class='lede'>Paste the Apps Script web-app URL and the shared secret from ONBOARDING.md. While CJRM is open, it checks the mailbox every 30 seconds, and again as soon as you come back to the app. You can still tap Check mailbox now if you want an extra check.</p>" +
      field("Endpoint URL", "hubUrl", s.hubUrl, "url") +
      '<label class="field"><span>Shared secret</span><input id="hubSecret" type="password" value="' + esc(s.hubSecret) + '" autocomplete="off"></label>' +
      field("Winnipeg number (for tagging forwarded texts)", "shopPhone", s.shopPhone, "tel") +
      field("Toronto number", "personalPhone", s.personalPhone, "tel") +
      status +
      '<div class="row"><button type="button" class="btn" id="btnSaveHub">Save hub settings</button>' +
      '<button type="button" class="btn-secondary" id="btnPollNow">Check mailbox now</button></div>' +
      "</div>" +
      renderNativeCards() +
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


  function setComposerOpen(open) {
    ui.replyOpen = Boolean(open);
    const actions = $("composerActions");
    const composer = $("composer");
    const toggle = $("btnToggleReply");
    if (actions) actions.hidden = !ui.replyOpen;
    if (composer) composer.classList.toggle("is-open", ui.replyOpen);
    if (toggle) toggle.textContent = ui.replyOpen ? "Hide" : "Reply";
    const box = $("replyBody");
    if (box && ui.replyOpen) {
      resizeReplyBox(box);
      box.focus();
    } else if (box) {
      box.style.height = "44px";
    }
  }

  function resizeReplyBox(box) {
    if (!box) return;
    box.style.height = "44px";
    const next = Math.max(44, Math.min(box.scrollHeight, 120));
    box.style.height = next + "px";
  }

  function bindComposer() {
    const box = $("replyBody");
    const toggle = $("btnToggleReply");
    if (toggle) toggle.addEventListener("click", function () {
      setComposerOpen(!ui.replyOpen);
    });
    if (!box) return;
    if (ui.replyOpen) resizeReplyBox(box);
    box.addEventListener("focus", function () { setComposerOpen(true); });
    box.addEventListener("input", function () {
      if (box.value.trim()) setComposerOpen(true);
      resizeReplyBox(box);
    });
  }

  function closeOpenSwipes(except) {
    document.querySelectorAll(".swipe-item.is-open").forEach(function (el) {
      if (el !== except) el.classList.remove("is-open");
    });
  }

  function deletePersonCard(id) {
    const person = CJRM.personById(id);
    const label = person && person.name ? person.name : "this person";
    if (!confirm("Remove " + label + " and their thread from this device?")) return;
    CJRM.removePerson(id);
    if (ui.personId === id) ui.personId = null;
    setView("desk");
  }

  function deleteThreadMessage(id) {
    if (!confirm("Delete this message from the thread?")) return;
    CJRM.removeMessage(id);
    render();
  }

  function bindSwipeAndLongPress(el, onDelete) {
    const handle = el.querySelector("[data-open], .bubble") || el;
    const HOLD_MS = 500;
    const MOVE_CANCEL = 10;
    const SWIPE_DX = -60;
    let startX = 0, startY = 0, tracking = false, longTimer = null;
    let armed = false, cancelled = false, gesturing = false, lastOpened = false, capturedId = null, suppressClick = false;
    let verticalScroll = false, scrollTarget = null, lastY = 0;

    function clearTimer() {
      if (longTimer) { clearTimeout(longTimer); longTimer = null; }
    }

    function resetTransform() {
      handle.style.transition = "";
      handle.style.transform = "";
    }

    function releaseCapture() {
      if (capturedId == null) return;
      try { handle.releasePointerCapture(capturedId); } catch (err) {}
      capturedId = null;
    }

    function scrollParentOf(node) {
      let n = node;
      while (n && n !== document.body && n !== document.documentElement) {
        const style = window.getComputedStyle(n);
        const oy = style.overflowY;
        if ((oy === "auto" || oy === "scroll" || oy === "overlay") && n.scrollHeight > n.clientHeight + 1) return n;
        n = n.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    }

    function cancelArm() {
      clearTimer();
      armed = false;
      cancelled = true;
      releaseCapture();
      if (!lastOpened) {
        el.classList.remove("is-open");
        resetTransform();
      }
    }

    handle.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      tracking = true;
      armed = false;
      cancelled = false;
      gesturing = false;
      suppressClick = false;
      verticalScroll = false;
      scrollTarget = null;
      lastY = e.clientY;
      lastOpened = el.classList.contains("is-open");
      clearTimer();
      longTimer = setTimeout(function () {
        longTimer = null;
        if (!tracking || cancelled) return;
        armed = true;
        if (navigator.vibrate) navigator.vibrate(12);
      }, HOLD_MS);
    });
    handle.addEventListener("pointermove", function (e) {
      if (!tracking) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      // After a hold, the browser often will not start a native pan. Keep scrolling
      // the nearest overflow container so a vertical move never sticks or arms delete.
      if (verticalScroll && scrollTarget) {
        scrollTarget.scrollTop += lastY - e.clientY;
        lastY = e.clientY;
        return;
      }
      if (cancelled) return;
      if (!armed) {
        if (adx > MOVE_CANCEL || ady > MOVE_CANCEL) {
          suppressClick = true;
          cancelArm();
        }
        return;
      }
      if (ady > MOVE_CANCEL && ady >= adx) {
        suppressClick = true;
        verticalScroll = true;
        lastY = e.clientY;
        scrollTarget = scrollParentOf(el);
        cancelArm();
        if (scrollTarget) scrollTarget.scrollTop += -dy;
        return;
      }
      if (adx > 2 * ady && dx < 0) {
        gesturing = true;
        suppressClick = true;
        if (capturedId == null) {
          try { handle.setPointerCapture(e.pointerId); capturedId = e.pointerId; } catch (err) {}
        }
        if (e.cancelable) e.preventDefault();
        closeOpenSwipes(el);
        const shift = Math.max(-88, Math.min(0, lastOpened ? dx - 88 : dx));
        handle.style.transition = "none";
        handle.style.transform = "translateX(" + shift + "px)";
        if (dx < SWIPE_DX && adx > 2 * ady) el.classList.add("is-open");
        else if (!lastOpened) el.classList.remove("is-open");
      }
    }, { passive: false });
    function endPointer(e) {
      if (!tracking) return;
      tracking = false;
      clearTimer();
      const dx = e && e.clientX != null ? e.clientX - startX : 0;
      const dy = e && e.clientY != null ? e.clientY - startY : 0;
      const held = armed && !cancelled;
      const reveal = held && dx < SWIPE_DX && Math.abs(dx) > 2 * Math.abs(dy);
      releaseCapture();
      handle.style.transition = "";
      handle.style.transform = "";
      if (reveal) {
        gesturing = true;
        suppressClick = true;
        el.classList.add("is-open");
      } else if (!lastOpened) {
        el.classList.remove("is-open");
      }
      // A completed hold is not a tap, so the desk card does not open.
      if (held) suppressClick = true;
      armed = false;
    }
    handle.addEventListener("pointerup", endPointer);
    handle.addEventListener("pointercancel", endPointer);
    handle.addEventListener("click", function (e) {
      if (gesturing || suppressClick || el.classList.contains("is-open") || lastOpened) {
        e.preventDefault();
        e.stopPropagation();
        if (lastOpened && !gesturing) el.classList.remove("is-open");
        gesturing = false;
        suppressClick = false;
      }
    }, true);
  }

  function bindSwipeDeletes(view) {
    closeOpenSwipes(null);
    view.querySelectorAll("[data-person-swipe]").forEach(function (el) {
      const id = el.getAttribute("data-person-swipe");
      bindSwipeAndLongPress(el, function () { deletePersonCard(id); });
    });
    view.querySelectorAll("[data-msg-swipe]").forEach(function (el) {
      const id = el.getAttribute("data-msg-swipe");
      bindSwipeAndLongPress(el, function () { deleteThreadMessage(id); });
    });
    view.querySelectorAll("[data-del-person]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        deletePersonCard(btn.getAttribute("data-del-person"));
      });
    });
    view.querySelectorAll("[data-del-msg]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        deleteThreadMessage(btn.getAttribute("data-del-msg"));
      });
    });
  }

  function bind() {
    const view = $("view");
    bindSwipeDeletes(view);
    bindComposer();

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
        CJRM.patchPerson(id, { unread: false, freshAt: null });
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
      const lineName = line === "phone2" ? "Toronto number" : "Winnipeg number";
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
        if (t && $("replyBody")) {
          $("replyBody").value = t.body;
          setComposerOpen(true);
          resizeReplyBox($("replyBody"));
        }
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
      if (typeof CJRM.nativeSetHubConfig === "function") {
        CJRM.nativeSetHubConfig(s.hubUrl, s.hubSecret).catch(function () {});
      }
      if (typeof CJRM.kickPoll === "function") CJRM.kickPoll("save");
      toast("Hub settings saved on this device.");
      render();
    });
    if ($("btnPollNow")) $("btnPollNow").addEventListener("click", async function () {
      try {
        const r = await CJRM.pollHub();
        if (r.filed > 0) {
          revealFiledOnDesk();
          notifyNewItems(r.filed, r.names);
        } else {
          toast("Checked the mailbox. Fetched " + r.fetched + ", filed 0.");
        }
      } catch (err) {
        CJRM.recordPollError(err);
        toast(err.message || "Mailbox check failed.");
      }
      render();
    });
    bindNative();
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
    if (CJRM.isNativeApp && CJRM.isNativeApp()) {
      if (force) toast("You are already in the Android app.");
      return;
    }
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

  function startClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(function () {
      if (ui.view === "desk") render();
      else updateChrome();
    }, 30000);
  }

  function wireShell() {
    $("btnHome").addEventListener("click", function () { setView("desk"); });
    if ($("newCount")) $("newCount").addEventListener("click", function () { setView("desk"); });
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

  CJRM.refresh = function () {
    render();
  };

  CJRM.notifyNewItems = notifyNewItems;
  CJRM.clearNewBadge = clearNewBadge;
  CJRM.revealFiledOnDesk = revealFiledOnDesk;
  CJRM.messageToast = messageToast;

  CJRM.start = function () {
    CJRM.hydrate();
    wireShell();
    render();
    offerInstall(false);
    startClock();
    if (typeof CJRM.startAutoPoll === "function") CJRM.startAutoPoll();
    if (CJRM.isNativeApp && CJRM.isNativeApp()) {
      if (typeof CJRM.nativeStart === "function") CJRM.nativeStart();
    } else if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline register can wait */ });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", CJRM.start);
  else CJRM.start();
})(window);
