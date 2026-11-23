/* Device storage: localStorage for the desk, IndexedDB for photos. */
(function (global) {
  const CJRM = global.CJRM || (global.CJRM = {});

  function blankState() {
    return {
      demo: false,
      operator: "Carpenter Johnny",
      accounts: (CJRM.CHANNELS || []).map(function (channel) {
        return { id: "acc-" + channel, channel: channel, label: "", connected: false };
      }),
      people: [],
      messages: [],
      templates: (CJRM.DEFAULT_TEMPLATES || []).map(function (t) { return Object.assign({}, t); }),
      settings: Object.assign({}, CJRM.DEFAULT_SETTINGS),
    };
  }

  function asPerson(row) {
    if (!row || typeof row !== "object" || typeof row.id !== "string" || typeof row.name !== "string") return null;
    const stages = CJRM.STAGES || [];
    const channels = CJRM.CHANNELS || [];
    if (channels.indexOf(row.channel) === -1) return null;
    if (stages.indexOf(row.stage) === -1) return null;
    return {
      id: row.id,
      name: row.name,
      channel: row.channel,
      stage: row.stage,
      unread: Boolean(row.unread),
      starred: Boolean(row.starred),
      value: typeof row.value === "number" ? row.value : null,
      listing: String(row.listing || ""),
      phone: String(row.phone || ""),
      phone2: String(row.phone2 || ""),
      email: String(row.email || ""),
      city: String(row.city || ""),
      address: String(row.address || ""),
      notes: String(row.notes || ""),
      igHandle: String(row.igHandle || ""),
      fbHandle: String(row.fbHandle || ""),
      photoIds: Array.isArray(row.photoIds) ? row.photoIds.map(String) : [],
      snoozeUntil: row.snoozeUntil ? String(row.snoozeUntil) : null,
      followUpAt: row.followUpAt ? String(row.followUpAt) : null,
      freshAt: row.freshAt ? String(row.freshAt) : null,
      createdAt: String(row.createdAt || new Date().toISOString()),
      lastMessageAt: String(row.lastMessageAt || new Date().toISOString()),
      demo: Boolean(row.demo),
    };
  }

  function asMessage(row) {
    if (!row || typeof row !== "object") return null;
    if (typeof row.id !== "string" || typeof row.body !== "string") return null;
    const personId = row.personId || row.leadId;
    if (typeof personId !== "string") return null;
    if ((CJRM.CHANNELS || []).indexOf(row.channel) === -1) return null;
    if (row.direction !== "in" && row.direction !== "out" && row.direction !== "note") return null;
    return {
      id: row.id,
      personId: personId,
      direction: row.direction,
      channel: row.channel,
      body: row.body,
      at: String(row.at || new Date().toISOString()),
      sourceId: row.sourceId ? String(row.sourceId) : "",
    };
  }

  function loadRaw() {
    try {
      const raw = localStorage.getItem(CJRM.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function persist(state) {
    const bag = {
      v: 1,
      demo: Boolean(state.demo),
      operator: state.operator,
      accounts: state.accounts,
      people: state.people,
      messages: state.messages,
      templates: state.templates,
      settings: state.settings,
    };
    localStorage.setItem(CJRM.STORAGE_KEY, JSON.stringify(bag));
  }

  let state = blankState();

  function isDemoPerson(p) {
    if (!p) return false;
    if (p.demo) return true;
    return (CJRM.DEMO_PERSON_IDS || []).indexOf(p.id) !== -1;
  }

  function purgeDemoRecords() {
    const demoIds = {};
    state.people.forEach(function (p) { if (isDemoPerson(p)) demoIds[p.id] = true; });
    const keep = {};
    state.messages.forEach(function (m) {
      if (demoIds[m.personId] && m.sourceId) keep[m.personId] = true;
    });
    const people = state.people.filter(function (p) { return !demoIds[p.id] || keep[p.id]; }).map(function (p) {
      if (!keep[p.id]) return p;
      const next = Object.assign({}, p);
      delete next.demo;
      return next;
    });
    const messages = state.messages.filter(function (m) {
      if (demoIds[m.personId] && !keep[m.personId]) return false;
      if (keep[m.personId] && !m.sourceId) return false;
      return true;
    });
    const changed = people.length !== state.people.length || messages.length !== state.messages.length || state.demo;
    state.people = people;
    state.messages = messages;
    state.demo = false;
    return changed;
  }

  function hydrate() {
    const raw = loadRaw();
    if (!raw) {
      state = blankState();
      persist(state);
      return state;
    }
    const people = Array.isArray(raw.people || raw.leads)
      ? (raw.people || raw.leads).map(asPerson).filter(Boolean)
      : [];
    const messages = Array.isArray(raw.messages) ? raw.messages.map(asMessage).filter(Boolean) : [];
    const accounts = Array.isArray(raw.accounts) && raw.accounts.length
      ? (CJRM.CHANNELS || []).map(function (channel) {
          const found = raw.accounts.find(function (a) { return a && a.channel === channel; });
          return {
            id: "acc-" + channel,
            channel: channel,
            label: found ? String(found.label || "") : "",
            connected: found ? Boolean(found.connected) : false,
          };
        })
      : blankState().accounts;
    state = {
      demo: Boolean(raw.demo),
      operator: typeof raw.operator === "string" && raw.operator.trim() ? raw.operator : "Carpenter Johnny",
      accounts: accounts,
      people: people,
      messages: messages,
      templates: Array.isArray(raw.templates) && raw.templates.length
        ? raw.templates.map(function (t) {
            return { id: String(t.id || CJRM.uid()), title: String(t.title || ""), body: String(t.body || "") };
          })
        : (CJRM.DEFAULT_TEMPLATES || []).map(function (t) { return Object.assign({}, t); }),
      settings: Object.assign({}, CJRM.DEFAULT_SETTINGS, raw.settings || {}),
    };
    if (!Array.isArray(state.settings.seenHubIds)) state.settings.seenHubIds = [];
    if (state.settings.onboarded == null) state.settings.onboarded = false;
    if (purgeDemoRecords()) persist(state);
    return state;
  }

  function getState() {
    return state;
  }

  function setState(patch) {
    state = Object.assign({}, state, patch);
    persist(state);
    return state;
  }

  function loadDemo(now) {
    const prev = state && state.settings ? Object.assign({}, state.settings) : {};
    state = CJRM.buildDemo(now == null ? Date.now() : now);
    state.settings = Object.assign({}, state.settings, {
      onboarded: Boolean(prev.onboarded),
      hubUrl: prev.hubUrl || state.settings.hubUrl || "",
      hubSecret: prev.hubSecret || state.settings.hubSecret || "",
      seenHubIds: Array.isArray(prev.seenHubIds) ? prev.seenHubIds : (state.settings.seenHubIds || []),
      hubVerified: Boolean(prev.hubVerified),
      hubVerifiedUrl: prev.hubVerifiedUrl || "",
      hubVerifiedSecret: prev.hubVerifiedSecret || "",
    });
    persist(state);
    return state;
  }

  function clearDesk() {
    const settings = state && state.settings ? Object.assign({}, state.settings) : Object.assign({}, CJRM.DEFAULT_SETTINGS);
    state = blankState();
    state.settings = settings;
    persist(state);
    return state;
  }

  function personById(id) {
    return state.people.find(function (p) { return p.id === id; }) || null;
  }

  function patchPerson(id, patch) {
    state.people = state.people.map(function (p) {
      if (p.id !== id) return p;
      return Object.assign({}, p, patch, { id: p.id });
    });
    persist(state);
    return personById(id);
  }

  function addMessage(personId, fields) {
    const at = fields.at || new Date().toISOString();
    const message = {
      id: fields.id || CJRM.uid(),
      personId: personId,
      direction: fields.direction,
      channel: fields.channel,
      body: String(fields.body || "").trim(),
      at: at,
      sourceId: fields.sourceId || "",
    };
    if (!message.body) return null;
    state.messages = state.messages.concat([message]);
    state.people = state.people.map(function (p) {
      if (p.id !== personId) return p;
      const next = Object.assign({}, p, { lastMessageAt: message.direction === "note" ? p.lastMessageAt : at });
      if (message.direction === "in") next.unread = true;
      if (message.direction === "out") {
        next.unread = false;
        if (p.stage === "new") next.stage = "contacted";
      }
      return next;
    });
    persist(state);
    return message;
  }

  function newPerson(input, messageBody) {
    const at = input.createdAt || new Date().toISOString();
    const person = {
      id: input.id || CJRM.uid(),
      name: (input.name || "New lead").trim() || "New lead",
      channel: input.channel || "manual",
      stage: input.stage || "new",
      unread: input.unread !== false,
      starred: Boolean(input.starred),
      value: typeof input.value === "number" ? input.value : null,
      listing: String(input.listing || ""),
      phone: String(input.phone || ""),
      phone2: String(input.phone2 || ""),
      email: String(input.email || ""),
      city: String(input.city || ""),
      address: String(input.address || ""),
      notes: String(input.notes || ""),
      igHandle: String(input.igHandle || ""),
      fbHandle: String(input.fbHandle || ""),
      photoIds: [],
      snoozeUntil: input.snoozeUntil || null,
      followUpAt: input.followUpAt || null,
      freshAt: input.freshAt || null,
      createdAt: at,
      lastMessageAt: at,
    };
    state.people = [person].concat(state.people);
    state.accounts = state.accounts.map(function (a) {
      if (a.channel !== person.channel) return a;
      return Object.assign({}, a, { connected: true, label: a.label || a.channel });
    });
    if (messageBody) {
      state.messages = state.messages.concat([{
        id: CJRM.uid(),
        personId: person.id,
        direction: input.direction || "in",
        channel: person.channel,
        body: String(messageBody).trim(),
        at: at,
        sourceId: input.sourceId || "",
      }]);
    }
    persist(state);
    return person;
  }

  function cloneRow(row) {
    return Object.assign({}, row, row.photoIds ? { photoIds: (row.photoIds || []).slice() } : {});
  }

  function rememberSeenIds(ids) {
    const seen = (state.settings.seenHubIds || []).slice();
    (ids || []).forEach(function (id) {
      const s = String(id || "");
      if (s && seen.indexOf(s) === -1) seen.push(s);
    });
    state.settings.seenHubIds = seen.length > 2000 ? seen.slice(seen.length - 2000) : seen;
  }

  function sourceIdsOf(people, messages) {
    const ids = [];
    (messages || []).forEach(function (m) { if (m && m.sourceId) ids.push(m.sourceId); });
    (people || []).forEach(function (p) { if (p && p.sourceId) ids.push(p.sourceId); });
    return ids;
  }

  function relinkPersonMail(person) {
    if (!person) return;
    const talk = state.messages.filter(function (m) {
      return m.personId === person.id && m.direction !== "note";
    });
    const last = talk.length ? talk[talk.length - 1] : null;
    const unread = Boolean(last && last.direction === "in" && person.unread);
    const i = state.people.findIndex(function (p) { return p.id === person.id; });
    if (i < 0) return;
    state.people[i] = Object.assign({}, state.people[i], {
      lastMessageAt: last ? last.at : state.people[i].createdAt,
      unread: unread
    });
  }

  function removePeople(ids) {
    const idSet = {};
    (ids || []).forEach(function (id) { if (id) idSet[id] = true; });
    const people = state.people.filter(function (p) { return idSet[p.id]; }).map(cloneRow);
    const messages = state.messages.filter(function (m) { return idSet[m.personId]; }).map(cloneRow);
    rememberSeenIds(sourceIdsOf(people, messages));
    state.people = state.people.filter(function (p) { return !idSet[p.id]; });
    state.messages = state.messages.filter(function (m) { return !idSet[m.personId]; });
    persist(state);
    return { people: people, messages: messages };
  }

  function removeMessages(ids) {
    const idSet = {};
    (ids || []).forEach(function (id) { if (id) idSet[id] = true; });
    const messages = state.messages.filter(function (m) { return idSet[m.id]; }).map(cloneRow);
    if (!messages.length) return { messages: [], peopleState: [] };
    const personIds = {};
    messages.forEach(function (m) { if (m.personId) personIds[m.personId] = true; });
    const peopleState = state.people.filter(function (p) { return personIds[p.id]; }).map(cloneRow);
    rememberSeenIds(sourceIdsOf(null, messages));
    state.messages = state.messages.filter(function (m) { return !idSet[m.id]; });
    Object.keys(personIds).forEach(function (pid) { relinkPersonMail(personById(pid)); });
    persist(state);
    return { messages: messages, peopleState: peopleState };
  }

  function removePerson(id) {
    const snap = removePeople([id]);
    return snap.people.length > 0;
  }

  function removeMessage(id) {
    const snap = removeMessages([id]);
    return snap.messages.length > 0;
  }

  function restoreDeleted(snap) {
    if (!snap) return false;
    let changed = false;
    (snap.people || []).forEach(function (p) {
      if (!personById(p.id)) {
        state.people = [cloneRow(p)].concat(state.people);
        changed = true;
      }
    });
    (snap.messages || []).forEach(function (m) {
      if (!state.messages.some(function (x) { return x.id === m.id; })) {
        state.messages = state.messages.concat([cloneRow(m)]);
        changed = true;
      }
    });
    (snap.peopleState || []).forEach(function (p) {
      const i = state.people.findIndex(function (x) { return x.id === p.id; });
      if (i >= 0) {
        state.people[i] = cloneRow(p);
        changed = true;
      }
    });
    if (changed) persist(state);
    return changed;
  }

  function filePieces(pieces, opts) {
    opts = opts || {};
    const settings = state.settings || {};
    const phones = {
      phone1: settings.shopPhone || (state.accounts.find(function (a) { return a.channel === "phone1"; }) || {}).label || "",
      phone2: settings.personalPhone || (state.accounts.find(function (a) { return a.channel === "phone2"; }) || {}).label || "",
    };
    let filed = 0;
    const results = [];
    pieces.forEach(function (piece) {
      const channel = piece.channel || CJRM.classifyMail(piece, phones);
      let name = piece.name || CJRM.nameFromMail(piece, channel);
      if (!String(name || "").trim() || (CJRM.isPhoneLikeName && CJRM.isPhoneLikeName(name))) {
        name = CJRM.nameFromMail(piece, channel);
      }
      const body = String(piece.body || piece.subject || "").trim();
      const sourceId = piece.id || piece.sourceId || "";
      if (!body) {
        results.push({ status: "skipped", sourceId: sourceId, reason: "empty", name: name, channel: channel });
        return;
      }
      if (sourceId && (state.messages.some(function (m) { return m.sourceId && m.sourceId === sourceId; }) || (state.settings.seenHubIds || []).indexOf(sourceId) !== -1)) {
        results.push({ status: "duplicate", sourceId: sourceId, name: name, channel: channel });
        return;
      }
      const extractedPhones = CJRM.extractPhones(body + " " + (piece.from || ""));
      const email = piece.email || CJRM.emailFromHeader(piece.from) || (CJRM.extractEmails(body)[0] || "");
      const phone = piece.phone || extractedPhones[0] || "";
      const existing = CJRM.matchPerson(state.people, { phone: phone, email: email, name: name, body: body });
      const freshAt = new Date().toISOString();
      if (existing) {
        const duplicate = state.messages.some(function (m) {
          return m.personId === existing.id && m.body === body;
        });
        if (!duplicate) {
          addMessage(existing.id, {
            direction: "in",
            channel: channel,
            body: body,
            at: piece.date || piece.at || new Date().toISOString(),
            sourceId: sourceId,
          });
          const patch = { freshAt: freshAt, unread: true, snoozeUntil: null };
          if (!existing.phone && phone) patch.phone = phone;
          if (!existing.email && email) patch.email = email;
          if (CJRM.isClosed(existing)) patch.stage = "contacted";
          if (piece.subject) patch.listing = piece.subject;
          patchPerson(existing.id, patch);
          filed += 1;
          results.push({ status: "matched", personId: existing.id, channel: channel, sourceId: sourceId, name: existing.name || name });
        } else {
          results.push({ status: "duplicate", personId: existing.id, channel: channel, sourceId: sourceId, name: existing.name || name });
        }
      } else {
        const person = newPerson({
          name: name,
          channel: channel,
          phone: phone,
          email: email,
          listing: piece.subject || "",
          notes: "Filed from the mailbox.",
          sourceId: sourceId,
          createdAt: piece.date || piece.at,
          freshAt: freshAt,
          unread: true,
        }, body);
        filed += 1;
        results.push({ status: "created", personId: person.id, channel: channel, sourceId: sourceId, name: person.name });
      }
    });
    if (opts.markDemo === false) {
      /* leave demo flag alone */
    }
    return { filed: filed, results: results };
  }

  function exportBag() {
    return {
      v: 1,
      app: CJRM.APP_NAME,
      version: CJRM.VERSION,
      exportedAt: new Date().toISOString(),
      demo: state.demo,
      operator: state.operator,
      accounts: state.accounts,
      people: state.people,
      messages: state.messages,
      templates: state.templates,
      settings: Object.assign({}, state.settings, {
        hubSecret: state.settings.hubSecret ? "(stored on device, omitted from this file)" : "",
        hubVerifiedSecret: state.settings.hubVerifiedSecret ? "(stored on device, omitted from this file)" : "",
      }),
    };
  }

  function importBag(raw, secretToKeep) {
    let parsed;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      return "That file isn't JSON.";
    }
    if (!parsed || typeof parsed !== "object") return "Nothing to import.";
    const people = Array.isArray(parsed.people || parsed.leads)
      ? (parsed.people || parsed.leads).map(asPerson).filter(Boolean)
      : [];
    const messages = Array.isArray(parsed.messages) ? parsed.messages.map(asMessage).filter(Boolean) : [];
    if (people.length === 0) return "No people in that file.";
    const importedSettings = Object.assign({}, CJRM.DEFAULT_SETTINGS, parsed.settings || {});
    if (importedSettings.hubSecret === "(stored on device, omitted from this file)") {
      importedSettings.hubSecret = secretToKeep || state.settings.hubSecret || "";
    }
    if (importedSettings.hubVerifiedSecret === "(stored on device, omitted from this file)") {
      importedSettings.hubVerifiedSecret = state.settings.hubVerifiedSecret || importedSettings.hubSecret || "";
    }
    if (state.settings && state.settings.onboarded) importedSettings.onboarded = true;
    state = {
      demo: Boolean(parsed.demo),
      operator: typeof parsed.operator === "string" && parsed.operator.trim() ? parsed.operator : state.operator,
      accounts: Array.isArray(parsed.accounts)
        ? (CJRM.CHANNELS || []).map(function (channel) {
            const found = parsed.accounts.find(function (a) { return a && a.channel === channel; });
            return {
              id: "acc-" + channel,
              channel: channel,
              label: found ? String(found.label || "") : "",
              connected: found ? Boolean(found.connected) : false,
            };
          })
        : blankState().accounts,
      people: people,
      messages: messages,
      templates: Array.isArray(parsed.templates) && parsed.templates.length
        ? parsed.templates.map(function (t) {
            return { id: String(t.id || CJRM.uid()), title: String(t.title || ""), body: String(t.body || "") };
          })
        : state.templates,
      settings: importedSettings,
    };
    persist(state);
    return null;
  }

  /* Photos in IndexedDB */
  function openPhotoDb() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(CJRM.PHOTO_DB, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains("photos")) req.result.createObjectStore("photos");
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function savePhoto(personId, blob) {
    const id = CJRM.uid();
    const db = await openPhotoDb();
    await new Promise(function (resolve, reject) {
      const tx = db.transaction("photos", "readwrite");
      tx.objectStore("photos").put({ id: id, personId: personId, type: blob.type, blob: blob, at: Date.now() }, id);
      tx.oncomplete = resolve;
      tx.onerror = function () { reject(tx.error); };
    });
    const person = personById(personId);
    if (person) patchPerson(personId, { photoIds: (person.photoIds || []).concat([id]) });
    return id;
  }

  async function loadPhoto(id) {
    const db = await openPhotoDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction("photos", "readonly");
      const req = tx.objectStore("photos").get(id);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function deletePhoto(personId, id) {
    const db = await openPhotoDb();
    await new Promise(function (resolve, reject) {
      const tx = db.transaction("photos", "readwrite");
      tx.objectStore("photos").delete(id);
      tx.oncomplete = resolve;
      tx.onerror = function () { reject(tx.error); };
    });
    const person = personById(personId);
    if (person) patchPerson(personId, { photoIds: (person.photoIds || []).filter(function (x) { return x !== id; }) });
  }

  CJRM.blankState = blankState;
  CJRM.hydrate = hydrate;
  CJRM.getState = getState;
  CJRM.setState = setState;
  CJRM.loadDemo = loadDemo;
  CJRM.purgeDemoRecords = purgeDemoRecords;
  CJRM.isDemoPerson = isDemoPerson;
  CJRM.clearDesk = clearDesk;
  CJRM.personById = personById;
  CJRM.patchPerson = patchPerson;
  CJRM.addMessage = addMessage;
  CJRM.newPerson = newPerson;
  CJRM.removePerson = removePerson;
  CJRM.removeMessage = removeMessage;
  CJRM.removePeople = removePeople;
  CJRM.removeMessages = removeMessages;
  CJRM.restoreDeleted = restoreDeleted;
  CJRM.rememberSeenIds = rememberSeenIds;
  CJRM.filePieces = filePieces;
  CJRM.exportBag = exportBag;
  CJRM.importBag = importBag;
  CJRM.savePhoto = savePhoto;
  CJRM.loadPhoto = loadPhoto;
  CJRM.deletePhoto = deletePhoto;
  CJRM.asPerson = asPerson;
  CJRM.asMessage = asMessage;
})(window);
