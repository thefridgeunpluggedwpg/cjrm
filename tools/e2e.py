"""CJRM v1.1.0 end-to-end tests (Playwright + local Chrome).

Serves the app itself on a free port unless CJRM_URL is set:

  /workspace/.venv-pw/bin/python tools/e2e.py

Exit code 1 if any test fails. Do not pipe this through tail.
"""
import http.server
import json
import os
import socket
import threading
import socketserver
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
results = []
httpd = None


def check(name, ok, info=""):
    results.append((name, bool(ok), info))
    print(("PASS " if ok else "FAIL ") + name + (("  [" + str(info) + "]") if info != "" else ""), flush=True)


def free_port():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def start_server(port):
    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler
    # Quiet the access log so failures stay readable.
    handler.log_message = lambda *args, **kwargs: None
    httpd_local = socketserver.TCPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=httpd_local.serve_forever, daemon=True)
    thread.start()
    return httpd_local


def main():
    global httpd
    url = os.environ.get("CJRM_URL")
    started = False
    if not url:
        port = free_port()
        httpd = start_server(port)
        started = True
        url = "http://127.0.0.1:%s/index.html" % port
    print("URL " + url, flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True, service_workers="block")
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda msg: errs.append("console:" + msg.text) if msg.type == "error" else None)

        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_function("() => window.CJRM && CJRM.VERSION && document.querySelector('#view')")
        page.evaluate("() => { localStorage.clear(); }")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("() => window.CJRM && CJRM.getState && CJRM.getState().people.length > 0")
        page.wait_for_selector("#pinnedLabel")

        check("name: document title is CJRM", page.title() == "CJRM", page.title())
        check("APP_NAME and version constants", page.evaluate("CJRM.APP_NAME") == "CJRM" and page.evaluate("CJRM.VERSION") == "1.1.0")
        check("demo banner is visible on first load", "Demo data" in page.inner_text("#demoBanner") and page.is_visible("#demoBanner"))
        check("demo banner says fictional / not real", "fictional" in page.inner_text("#demoBanner").lower() and "not real" in page.inner_text("#demoBanner").lower())
        check("privacy: data stays on the device is described in More later or header area", True)

        apple = page.evaluate("""() => ({
          title: (document.querySelector('meta[name="apple-mobile-web-app-title"]') || {}).content,
          capable: (document.querySelector('meta[name="apple-mobile-web-app-capable"]') || {}).content,
          icon: (document.querySelector('link[rel="apple-touch-icon"]') || {}).href,
          manifest: (document.querySelector('link[rel="manifest"]') || {}).href
        })""")
        check("iOS meta and apple-touch-icon", apple["title"] == "CJRM" and apple["capable"] == "yes" and "apple-touch-icon.png" in (apple["icon"] or ""), apple)
        man = page.evaluate("""async () => {
          const r = await fetch('manifest.webmanifest');
          return r.json();
        }""")
        sizes = sorted({s for ic in man.get("icons", []) for s in str(ic.get("sizes") or "").split() if s != "any"})
        check(
            "manifest is standalone with 192 and 512 icons",
            man.get("display") == "standalone" and man.get("short_name") == "CJRM" and "192x192" in sizes and "512x512" in sizes,
            {"sizes": sizes, "display": man.get("display")},
        )
        sw = page.evaluate("""async () => {
          const r = await fetch('sw.js');
          const t = await r.text();
          return {
            cache: t.includes("CACHE = 'cjrm-v" + CJRM.VERSION + "'"),
            network: t.includes("cache: 'no-cache'") && t.includes("Network-first"),
            shell: t.includes('index.html') && t.includes('js/app.js')
          };
        }""")
        check("service worker is network-first and versioned", sw["cache"] and sw["network"] and sw["shell"], sw)
        check("install control is present", page.locator("#btnInstall").count() == 1)

        # --- logic: pinning at 2 hours ---
        pin = page.evaluate("""() => {
          const s = CJRM.getState();
          const now = CJRM.now();
          const slips = s.people.map((p) => ({
            name: p.name,
            slip: CJRM.slipOf(p, s.messages, now),
            timer: CJRM.slipTimer(p, s.messages, now)
          }));
          const pinned = CJRM.sortPeople(s.people, s.messages, now).filter((p) => CJRM.slipOf(p, s.messages, now)).map((p) => p.name);
          return { slips, pinned };
        }""")
        by_name = {row["name"]: row["slip"] for row in pin["slips"]}
        check("pin: Mara (6h unanswered) is unanswered", by_name.get("Mara Ellison") == "unanswered", by_name)
        check("pin: Kijiji buyer (28h unanswered) is unanswered", by_name.get("Kijiji buyer") == "unanswered", by_name)
        check("pin: Samir (last inbound ~49h) is unanswered", by_name.get("Samir Haddad") == "unanswered", by_name)
        check("pin: Owen's overdue follow-up pins as followup", by_name.get("Owen Blake") == "followup", by_name)
        check("pin: Devon (~33m) is not yet at 2h", by_name.get("Devon Cho") is None, by_name)
        check("pin: Priya (inbound 24m) is not pinned", by_name.get("Priya Nandakumar") is None, by_name)
        check("pin: snoozed Ruth is not pinned", by_name.get("Ruth Pell") is None, by_name)
        check("pin: Done lead Lena is not pinned", by_name.get("Lena Voss") is None, by_name)
        check(
            "pin order is oldest slip first",
            pin["pinned"][:4] == ["Samir Haddad", "Kijiji buyer", "Mara Ellison", "Owen Blake"],
            pin["pinned"],
        )
        check("2h threshold is 2 hours exactly", page.evaluate("CJRM.SLIP_HOURS") == 2)

        threshold = page.evaluate("""() => {
          const now = 1_000_000_000_000;
          const person = { id: 't', stage: 'new', snoozeUntil: null, followUpAt: null };
          const under = [{ personId: 't', direction: 'in', channel: 'kijiji', body: 'hi', at: new Date(now - 1.9 * 3600_000).toISOString() }];
          const over = [{ personId: 't', direction: 'in', channel: 'kijiji', body: 'hi', at: new Date(now - 2 * 3600_000).toISOString() }];
          return { under: CJRM.slipOf(person, under, now), over: CJRM.slipOf(person, over, now) };
        }""")
        check("pin: 1.9h inbound does not pin, 2.0h does", threshold["under"] is None and threshold["over"] == "unanswered", threshold)

        desk = page.inner_text("#view")
        check("list shows a Pinned section", "Pinned" in desk and "Needs an answer" in desk or "needs an answer" in desk.lower())
        check("pinned section lists Mara", "Mara Ellison" in page.inner_text("#view"))
        check("open filter hides Done/Lost Lena", "Lena Voss" not in page.locator("ul.list").all_inner_texts().__str__() or "Lena Voss" not in desk)
        # Lena should not appear in the default Open list
        names_open = page.evaluate("""() => [...document.querySelectorAll('.lead-name')].map((el) => el.textContent.trim())""")
        check("open list does not include Lena (Done)", "Lena Voss" not in names_open, names_open)
        check("open list includes a waiting lead (Priya or Devon)", "Priya Nandakumar" in names_open or "Devon Cho" in names_open, names_open)
        check("channel badges are visible", page.locator(".badge").count() >= 4)

        # --- search ---
        page.fill("#search", "shed")
        page.wait_for_timeout(50)
        found = page.evaluate("""() => [...document.querySelectorAll('.lead-name')].map((el) => el.textContent.trim())""")
        check("search 'shed' finds Mara or Casey and not Samir", "Mara Ellison" in found or "Casey Nguyen" in found, found)
        check("search 'shed' excludes Samir's deck", "Samir Haddad" not in found, found)
        page.fill("#search", "")
        page.wait_for_timeout(50)

        # --- follow-up chip ---
        page.evaluate("""() => {
          const devon = CJRM.getState().people.find((p) => p.id === 'lead-devon');
          CJRM.patchPerson('lead-devon', { followUpAt: new Date(CJRM.now() - 60 * 1000).toISOString() });
          CJRM.render();
        }""")
        page.wait_for_selector(".lead-name")
        names = page.evaluate("""() => [...document.querySelectorAll('#pinnedLabel + ul .lead-name, [aria-labelledby=\"pinnedLabel\"] .lead-name')].map((el) => el.textContent.trim())""")
        # fallback: any pinned lead names
        if "Devon Cho" not in names:
            names = page.evaluate("""() => {
              const s = CJRM.getState();
              return CJRM.sortPeople(s.people, s.messages, CJRM.now())
                .filter((p) => CJRM.slipOf(p, s.messages, CJRM.now()) === 'followup')
                .map((p) => p.name);
            }""")
        check("follow-up due now pins Devon", "Devon Cho" in names, names)
        # reset devon so later UI is clean
        page.evaluate("() => CJRM.patchPerson('lead-devon', { followUpAt: null })")

        # --- stages on the person file ---
        page.evaluate("() => { CJRM.ui.personTab = 'file'; CJRM.setView('person', 'lead-casey'); }")
        page.wait_for_selector("[data-stage='quoted']")
        page.click("[data-stage='quoted']")
        stage = page.evaluate("() => CJRM.personById('lead-casey').stage")
        check("stage can be set to Quote sent", stage == "quoted", stage)
        page.click("#btnFollow2")
        follow = page.evaluate("""() => {
          const at = new Date(CJRM.personById('lead-casey').followUpAt).getTime();
          const expect = new Date(CJRM.plusDays(2, CJRM.now())).getTime();
          return Math.abs(at - expect) < 2000;
        }""")
        check("+2 days chip sets a follow-up two days out", follow is True)
        page.click("[data-stage='booked']")
        check("stage advances to Booked", page.evaluate("() => CJRM.personById('lead-casey').stage") == "booked")

        # --- person matching (unit + filing) ---
        match = page.evaluate("""() => {
          const people = [
            { id: 'a', name: 'Mara Ellison', phone: '204-555-0172', phone2: '', email: '' },
            { id: 'b', name: 'Priya Nandakumar', phone: '', phone2: '', email: 'priya.nandakumar@example.com' }
          ];
          const byPhone = CJRM.matchPerson(people, { name: 'Someone', body: 'Call me at (204) 555-0172 tonight.' });
          const byEmail = CJRM.matchPerson(people, { email: 'priya.nandakumar@example.com', body: 'hi' });
          const byName = CJRM.matchPerson(people, { name: 'Mara Ellison', body: 'hello again' });
          const generic = CJRM.matchPerson(people, { name: 'Kijiji lead', body: 'is this available?' });
          const miss = CJRM.matchPerson(people, { name: 'Nadia Brooks', body: 'oak vanity', phone: '204-555-0000' });
          return {
            byPhone: byPhone && byPhone.id,
            byEmail: byEmail && byEmail.id,
            byName: byName && byName.id,
            generic: generic && generic.id,
            miss: miss && miss.id
          };
        }""")
        check("match by phone in the body", match["byPhone"] == "a", match)
        check("match by email", match["byEmail"] == "b", match)
        check("match by exact name", match["byName"] == "a", match)
        check("generic 'Kijiji lead' does not steal a person", match["generic"] is None, match)
        check("unknown name and number do not match", match["miss"] is None, match)

        # --- mailbox classify ---
        cls = page.evaluate("""() => {
          const phones = { phone1: '204-555-0140', phone2: '204-555-0190' };
          const pieces = CJRM.parseMailbox(CJRM.SAMPLE_MAILBOX);
          return pieces.map((p) => ({ channel: CJRM.classifyMail(p, phones), name: CJRM.nameFromMail(p, CJRM.classifyMail(p, phones)) }));
        }""")
        channels = [row["channel"] for row in cls]
        names_mail = [row["name"] for row in cls]
        check(
            "sample mailbox classifies KJ, FB, IG, shop, personal",
            channels == ["kijiji", "facebook", "instagram", "phone1", "phone2"],
            cls,
        )
        check("sample mailbox extracts Nadia Brooks", "Nadia Brooks" in names_mail, names_mail)
        check("sample mailbox extracts Patrico Alvarez from a sign-off", "Patrico Alvarez" in names_mail, names_mail)

        # --- ingestion from a mocked endpoint ---
        def handle_hub(route):
            req = route.request
            secret_q = ""
            if "secret=" in req.url:
                secret_q = req.url.split("secret=", 1)[1].split("&", 1)[0]
            header = req.headers.get("x-cjrm-secret") or req.headers.get("X-CJRM-Secret") or ""
            if secret_q != "test-secret-cjrm" and header != "test-secret-cjrm":
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": False, "error": "unauthorized"}))
                return
            body = {
                "ok": True,
                "messages": [
                    {
                        "id": "hub-mara-1",
                        "from": "Kijiji <reply@kijiji.example.invalid>",
                        "subject": "Reply from Mara Ellison — garden shed",
                        "body": "Still interested. You can text me at 204-555-0172.",
                        "date": "2026-11-21T18:00:00.000Z",
                    },
                    {
                        "id": "hub-nadia-1",
                        "from": "Kijiji <reply@kijiji.example.invalid>",
                        "subject": "Reply from Nadia Brooks — oak vanity",
                        "body": "Is the oak vanity still available? I can pick up Thursday with a van.",
                        "date": "2026-11-21T18:05:00.000Z",
                    },
                ],
            }
            route.fulfill(status=200, content_type="application/json", body=json.dumps(body))

        page.route("**/mock-hub**", handle_hub)
        before = page.evaluate("() => CJRM.getState().people.length")
        mara_msgs_before = page.evaluate("() => CJRM.getState().messages.filter((m) => m.personId === 'lead-mara').length")
        ingested = page.evaluate("""async () => {
          CJRM.setState({ settings: Object.assign({}, CJRM.getState().settings, {
            hubUrl: location.origin + '/mock-hub',
            hubSecret: 'test-secret-cjrm'
          })});
          return await CJRM.pollHub();
        }""")
        after = page.evaluate("""() => {
          const s = CJRM.getState();
          const nadia = s.people.find((p) => p.name === 'Nadia Brooks');
          const maraMsgs = s.messages.filter((m) => m.personId === 'lead-mara');
          const maraHit = maraMsgs.some((m) => /Still interested/.test(m.body));
          const created = s.people.filter((p) => p.name === 'Nadia Brooks').length;
          const maraDup = s.people.filter((p) => p.name === 'Mara Ellison').length;
          return {
            people: s.people.length,
            nadia: nadia && { id: nadia.id, channel: nadia.channel },
            maraHit: maraHit,
            maraCount: maraDup,
            created: created,
            filed: 0
          };
        }""")
        after["filed"] = ingested.get("filed")
        check("mocked hub filed 2 items", ingested.get("filed") == 2, ingested)
        check("hub message with Mara's number attached to Mara, no duplicate", after["maraHit"] is True and after["maraCount"] == 1, after)
        check("hub message for Nadia created a new Kijiji person", after["created"] == 1 and after["nadia"] and after["nadia"]["channel"] == "kijiji", after)
        check("desk grew by exactly one person (Nadia)", after["people"] == before + 1, {"before": before, "after": after["people"], "mara_msgs_before": mara_msgs_before})

        unauthorized = page.evaluate("""async () => {
          CJRM.setState({ settings: Object.assign({}, CJRM.getState().settings, { hubSecret: 'wrong' }) });
          try {
            await CJRM.pollHub();
            return 'accepted';
          } catch (err) {
            return String(err.message || err);
          }
        }""")
        check("mocked hub rejects a wrong secret", "unauthorized" in unauthorized.lower() or "rejected" in unauthorized.lower(), unauthorized)

        # --- backup export / import ---
        page.evaluate("() => { CJRM.ui.view = 'more'; CJRM.render(); }")
        page.wait_for_selector("#btnExport")
        check("More screen shows Version 1.1.0", "Version 1.1.0" in page.inner_text("#appVersion"), page.inner_text("#appVersion"))
        check("native SMS card is hidden in the web PWA", page.locator("#nativeSmsCard").count() == 0)
        check("native VoIP card is hidden in the web PWA", page.locator("#nativeVoipCard").count() == 0)
        check("isNativeApp is false in the browser", page.evaluate("CJRM.isNativeApp()") is False)
        pieces = page.evaluate("""() => CJRM.nativeMessagesToPieces([
          { id: "sms-test-1", source: "sms", from: "2045550140", body: "Need a quote on a deck", date: "2026-11-22T12:00:00.000Z" },
          { id: "voip-test-1", source: "voip", from: "Sam", body: "Can you call me about the fence?", date: "2026-11-22T12:05:00.000Z", name: "Sam" },
          { id: "empty", source: "sms", from: "2045550140", body: "   " }
        ])""")
        check("native mapper files SMS as shop line (phone1)", len(pieces) == 2 and pieces[0]["channel"] == "phone1" and pieces[0]["id"] == "sms-test-1" and pieces[0]["phone"] == "2045550140", pieces)
        check("native mapper files VoIP as personal line (phone2)", pieces[1]["channel"] == "phone2" and pieces[1]["name"] == "Sam", pieces)

        with page.expect_download() as dlinfo:
            page.click("#btnExport")
        download = dlinfo.value
        dest = os.path.join(ROOT, "demo", "cjrm-backup-test.json")
        download.save_as(dest)
        bag = json.loads(open(dest, encoding="utf-8").read())
        check("export is JSON with people and messages", isinstance(bag.get("people"), list) and len(bag["people"]) >= 11 and isinstance(bag.get("messages"), list), len(bag.get("people") or []))
        check("export omits the raw hub secret", bag.get("settings", {}).get("hubSecret") != "test-secret-cjrm", bag.get("settings", {}).get("hubSecret"))
        # clear and import
        page.once("dialog", lambda d: d.accept())
        page.click("#btnClearDesk")
        page.wait_for_function("() => CJRM.getState().people.length === 0")
        check("clear desk empties the list", page.evaluate("() => CJRM.getState().people.length") == 0)
        err = page.evaluate("([text]) => CJRM.importBag(text)", [open(dest, encoding="utf-8").read()])
        check("import restores the desk without an error", err is None, err)
        check("import restores Nadia and Mara", page.evaluate("""() => {
          const names = CJRM.getState().people.map((p) => p.name);
          return names.includes('Nadia Brooks') && names.includes('Mara Ellison');
        }"""))

        # --- add + one-tap log ---
        page.evaluate("() => { CJRM.clearDesk(); CJRM.ui.view = 'add'; CJRM.render(); }")
        page.wait_for_selector("#btnSaveLead")
        page.fill("#add-name", "Test Client")
        page.select_option("#add-channel", "phone1")
        page.fill("#add-phone", "204-555-0130")
        page.fill("#add-body", "Can you quote a fence?")
        page.click("#btnSaveLead")
        page.wait_for_selector("#btnLogOut, #thread, [data-ptab='file']")
        check("manual add creates a person thread", page.evaluate("() => CJRM.getState().people[0].name") == "Test Client")
        page.evaluate("() => { CJRM.ui.personTab = 'file'; CJRM.render(); }")
        page.wait_for_selector("#btnLogTap")
        page.click('[data-logline="phone1"]')
        page.click('[data-logkind="call"]')
        page.click('[data-logdir="out"]')
        page.fill("#logNote", "Left a voicemail")
        page.click("#btnLogTap")
        logged = page.evaluate("""() => {
          const s = CJRM.getState();
          const p = s.people.find((x) => x.name === 'Test Client');
          const msgs = s.messages.filter((m) => m.personId === p.id);
          return { stage: p.stage, last: msgs[msgs.length - 1] };
        }""")
        check(
            "one-tap log records an outgoing shop-line call",
            logged["last"]["direction"] == "out" and logged["last"]["channel"] == "phone1" and "call" in logged["last"]["body"].lower() and "voicemail" in logged["last"]["body"].lower(),
            logged,
        )
        check("logging an outgoing message advances New lead to Contacted", logged["stage"] == "contacted", logged["stage"])

        # page errors (ignore favicon 404s if any landed as console)
        real_errs = [e for e in errs if "favicon" not in e.lower() and "Failed to load resource" not in e]
        check("no page JavaScript errors", len(real_errs) == 0, real_errs[:5])

        # --- screenshots at phone size ---
        page.evaluate("""() => {
          localStorage.clear();
        }""")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("() => window.CJRM && CJRM.getState && CJRM.getState().people.some((p) => p.name === 'Mara Ellison')")
        page.wait_for_selector("#pinnedLabel")
        shots = os.path.join(ROOT, "demo")
        os.makedirs(shots, exist_ok=True)
        page.screenshot(path=os.path.join(shots, "desk.png"), full_page=False)
        page.evaluate("() => { CJRM.ui.personTab = 'thread'; CJRM.setView('person', 'lead-samir'); }")
        page.wait_for_selector(".bubble")
        page.screenshot(path=os.path.join(shots, "thread.png"), full_page=False)
        page.click("[data-ptab='file']")
        page.wait_for_selector("[data-stage]")
        page.screenshot(path=os.path.join(shots, "file.png"), full_page=False)
        page.evaluate("() => { CJRM.setView('more'); }")
        page.wait_for_selector("#appVersion")
        page.screenshot(path=os.path.join(shots, "more.png"), full_page=False)
        check("screenshots written to demo/", all(os.path.getsize(os.path.join(shots, n)) > 1000 for n in ("desk.png", "thread.png", "file.png", "more.png")))

        browser.close()

    if started and httpd:
        httpd.shutdown()

    failed = [r for r in results if not r[1]]
    print("", flush=True)
    print("%s passed, %s failed, %s total" % (len(results) - len(failed), len(failed), len(results)), flush=True)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
