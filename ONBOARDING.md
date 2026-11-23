# CJRM onboarding — hand-hold notes for Johnny

CJRM is a personal desk for one Android phone. It is not for sale and has no subscription. Data stays on that phone. Replies are copied out of CJRM and sent in the app they came from (Kijiji, Messenger, SMS, and so on).

Do this on Johnny's Android phone and in his own Google account. Do not put real phone numbers, addresses, or the shared secret in the GitHub repo or in a group chat.

## 1. Install the app

The app is live at:

`https://thefridgeunpluggedwpg.github.io/cjrm/`

On the Android phone:

1. Open the link in Chrome (not a Facebook or Instagram in-app browser).
2. Tap the Chrome menu (three dots), then **Install app** or **Add to Home screen**.
3. The icon is the CJ stamp. Open CJRM from the home screen.
4. The first open is a short setup wizard. The desk starts empty — there are no sample leads.
   - In the browser, step 1 says **Install the Android app for texts**. You can continue to email from here.
   - In the Android app, step 1 is **Connect your phone**. Allow **Contacts** (so a name can show on a number) and **SMS** (so new texts land on the desk). If the phone says no, tap **Retry** or **Open settings**, allow both, and come back. You cannot continue without them. You may also turn on notification access for the Toronto VoIP number on this step; that part is optional.
   - Step 2 is **Connect your email**. Paste the mailbox hub URL and the same secret you set in the Apps Script. Tap **Test connection**. Wait for the green **Mailbox connected** line, then tap **Open the desk**.
5. The desk should say **Waiting for your first message**.

To confirm the version after setup, open **More**. It should say **Version 1.1.6**.

If you are using the Android app file (CJRM-v1.1.6.apk) instead of the browser install, follow **Install CJRM on Android** in [SETUP-CHEATSHEETS.md](SETUP-CHEATSHEETS.md). That app can file texts from this phone's SIM as the Winnipeg number, and optionally file VoIP-app notifications as the Toronto number. The mailbox hub steps below are the same.


## 2. Install the mailbox hub (Google Apps Script)

Johnny's email is the hub. Kijiji replies, Facebook and Instagram “someone sent you a message” notices, website form mail, and forwarded texts all land there. The Apps Script reads those letters and hands them to CJRM. It lives in his Google account, so Google sign-in never expires the way a “testing” Gmail login would.

1. On a computer, signed into Johnny's Google account, open [https://script.google.com](https://script.google.com).
2. New project. Name it **CJRM mailbox**.
3. Delete the stub code. Paste the contents of `apps-script/Code.gs` from this repo.
4. Project Settings (gear) → Script properties → Add:
   - `CJRM_SECRET` — a long random string (a password manager can make one). Keep it only in the script and in the app.
   - optional `CJRM_SHOP_PHONE` — the Winnipeg number, so texts to that line are tagged Winnipeg.
   - optional `CJRM_PERSONAL_PHONE` — the Toronto number, tagged Toronto.
5. Save. Deploy → New deployment → Type: **Web app**.
   - Description: `CJRM v1`
   - Execute as: **Me**
   - Who has access: **Anyone** (the secret still protects it)
6. Authorize the script when Google asks (Gmail read + labels).
7. Copy the web-app URL.
8. If you already connected the hub in the first-run wizard, you can skip this. Otherwise, in CJRM on the phone, open **More**. Paste the URL and the same secret. Fill in the Winnipeg and Toronto numbers if you have them. Tap **Save hub settings**. The desk starts checking the mailbox on its own (every 30 seconds while it is open). You can still tap **Check mailbox now** if you want an extra check.

If the check fails, confirm the secret matches and that the deployment is a Web app, not a library. After you edit `Code.gs`, make a **New version** of the same deployment or the phone will still call the old one.

The script labels matching threads **CJRM** and returns mail from the last 14 days that looks like a Kijiji reply, a Facebook or Instagram notice, a website form, or a forwarded text.

## 3. Forward both phone lines into the mailbox

A website cannot read Android texts. A free SMS-forwarder app on Johnny's phone sends incoming texts to the hub email. Missed calls can be forwarded the same way, or logged by hand with **Log a call or text** on a person's File tab.

Recommended: [pppscn/SmsForwarder](https://github.com/pppscn/SmsForwarder) (dual SIM). Other MIT forwarders such as pxf0rge/sms-forwarder-v2 also work if they can email both SIMs.

1. Install the forwarder from its official release page, not a random APK site.
2. Give it SMS (and optional call) permission. On Android 13+, allow notifications and disable battery restrictions for the app so it is not killed overnight.
3. Add a send rule for the Winnipeg number (the SIM line) → email to Johnny's Gmail. Put `Text to Winnipeg number` and the Winnipeg number in the subject, for example: `Text to Winnipeg number 204-555-0140`. The older wording `Text to shop phone` still works.
4. If you also forward the Toronto number, add a second rule to the same mailbox, with a subject like `Text to Toronto number` and that number. The older wording `Text to personal phone` still works.
5. Send a test text to each line you set up. Confirm the emails arrive. Leave CJRM open, or tap **Check mailbox now**. The Winnipeg test should file under **WPG**, the Toronto test under **TOR**, and each should attach to the right person if the number or name already exists.

WhatsApp notices work the same way if he forwards them, or he can log them by hand. Personal WhatsApp and personal Facebook/Instagram DMs cannot be read directly. That is a later (v2) job, and only if he moves the business to a Page, Instagram Professional, or WhatsApp Business.

## 4. Daily use

- The home screen is one vertical list. Anything unanswered for two hours, or with a follow-up due, pins at the top with a timer.
- To remove a person from the Desk, or any message in a thread, swipe left. A toast lets you **Undo** for five seconds. Press and hold to select several, then **Delete**.
- Open a person to see the whole thread across every channel. The **File** tab holds the stage (New lead → Contacted → Quote sent → Booked → Done / Lost), notes, photos, and the +2 days follow-up chip.
- Quick replies live on the thread. **Copy reply**, then paste into Kijiji, Messenger, or Messages. **Open in app** starts a call, SMS, WhatsApp, Messenger, or Instagram thread when a number or handle is on file. **Log as sent** keeps the desk in sync.
- **Add** is for a new lead or a pasted mailbox batch. **More** is for the hub, templates, and backup.
- Export a backup from **More** every so often and keep the file somewhere safe. Import replaces the desk on that phone.

## 5. If the app looks old after an update

This build uses a network-first cache, so a new version should show on the first open when the phone is online. If it does not: close CJRM fully, open it again, or uninstall and install from Chrome once more. Check **More** for the version number.
