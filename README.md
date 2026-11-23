# CJRM — Carpenter Johnny Relationship Management

A personal desk that puts every lead in one vertical list so nothing slips. Built for one user, on one Android phone. Not for sale, no subscription.

Kijiji replies, Facebook and Instagram notification emails, WhatsApp notices, the shop line, the personal line, the website, and manual entries all land on the same desk. Anything unanswered for two hours, or with a follow-up due, stays pinned at the top.

## Run it locally

```bash
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/index.html`. On an Android phone: Chrome menu → Install app. The icon is the CJ stamp. Data stays on the device (localStorage and IndexedDB), with an export/import backup under **More**.

## Tests

Serve the app, then:

```bash
python3 -m http.server 8765
/workspace/.venv-pw/bin/python tools/e2e.py
```

`CJRM_URL` can override the base URL.

## Android app (v1.1)

A signed Android app wraps this same desk and can file incoming texts from the phone's SIM as the shop line, even when the app is closed. An optional notification listener can file texts from a chosen VoIP app as the VoIP (personal) line. The web app in the browser is unchanged.

Build the release APK on a machine with the Android SDK and the release key at `/home/box/secrets/cjrm-release.keystore` (never commit the key):

```bash
source tools/android-env.sh
npm install
npm run apk
```

The APK lands at `android/app/build/outputs/apk/release/app-release.apk`. Later updates must be signed with the same key so they install over the old copy.

## Mailbox hub

Email is the door into the desk. The Google Apps Script in [`apps-script/`](apps-script/) labels and classifies lead mail and serves it as JSON, protected by a shared secret. The PWA polls that endpoint from **More**. Step-by-step setup, including the SMS-forwarder for both phone lines, is in [ONBOARDING.md](ONBOARDING.md).

## What v1 does

- Unified list with channel badges, search, and filters (open, needs answer, channel, stage)
- Pin + timer for 2-hour unanswered threads and due follow-ups
- Person card: history across every channel, notes, photos, stages
- Stages: New lead → Contacted → Quote sent → Booked → Done / Lost
- +2 days follow-up, quick replies with copy and open-in-app links, one-tap call/text log
- Demo mode with clearly fictional leads (555 numbers, example.com)
- Installable PWA, network-first service worker, version on the More screen

## GitHub Pages

Pages is not enabled. When it should go live:

```bash
gh api -X POST repos/thefridgeunpluggedwpg/cjrm/pages -f build_type=workflow
```

If the repo has no Pages workflow yet, enable Pages on the `main` branch `/ (root)` in the GitHub Settings UI, or:

```bash
gh api -X POST repos/thefridgeunpluggedwpg/cjrm/pages -F "source[branch]=main" -F "source[path]=/"
```

## License and privacy

Private client work for Carpenter Johnny. The repo is public, so this tree contains only fictional demo data and placeholder secrets. Do not commit real numbers, addresses, tokens, or the Apps Script secret.
