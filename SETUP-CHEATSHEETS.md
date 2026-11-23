# CJRM Setup Cheat Sheets

Do these sheets in order, on Johnny's computer and Johnny's Android phone, while signed into Johnny's Gmail.

Do not type the secret phrase or Johnny's real phone numbers into GitHub, a group chat, or this file.

**Total time:** about 1 hour 15 minutes, plus a few minutes for test emails and texts to arrive.

**Before you start**

- I will email the mailbox code to Johnny's Gmail. The subject will be **CJRM code v2**.
- Have a pen or a notes app ready. You will write down the secret phrase and keep it private.
- Have a second phone nearby for Sheet 2, so you can send test texts.

## Start here: put CJRM on the phone

**Time:** about 3 minutes

1. On the Android phone, open Chrome (not the Facebook or Instagram in-app browser).
2. Go to this address: `https://thefridgeunpluggedwpg.github.io/cjrm/`
3. Tap the Chrome menu (the three dots).
4. Tap **Install app** or **Add to Home screen**.
5. Open CJRM from the home screen. The icon is the CJ stamp.
6. Open **More** (bottom right).
7. Confirm it says **Version 1.1.1**. If it shows an older number, close CJRM all the way (swipe it out of recent apps), open it again, and check **More** once more.

You are done with this part when **More** shows **Version 1.1.1**.

---

## Install CJRM on Android

**Time:** about 10 minutes

**Where:** Johnny's Android phone

This installs the CJRM app file, which can read texts from this phone's SIM (the Winnipeg number) and, if you choose, from a VoIP app (the Toronto number). You do not need the SMS-forwarder app for the Winnipeg line if this works. The mailbox hub still needs to be set up (Sheet 1).

1. Open the file named **CJRM-v1.1.1.apk** (from Kyler's Drive, in the CJRM folder).
2. If the phone asks whether to allow installs from this source, turn that on, then tap to install.
3. Open CJRM. The icon is the CJ stamp.
4. Open **More** (bottom right) and confirm it says **Version 1.1.1**.
5. Under **Winnipeg number texts**, tap **Allow texts**, then allow SMS (and, if asked, allow reading texts so you can import recent ones).
6. If the phone will not let you turn texts on, open **App info** from that same card (or hold the CJRM icon, tap App info). Tap the three dots at the top, then tap **Allow restricted settings**. Go back to CJRM and tap **Allow texts** again. This is common on Android 13 and newer.
7. Confirm the green line says texts from this phone's SIM will be filed as the Winnipeg number.
8. Optional: tap **Import recent texts** to pull in recent SIM texts already on the phone.
9. Send a test text to the Winnipeg number from another phone, then open CJRM and look at the **Desk**. It should show the **WPG** badge.

### Optional: Toronto number (the VoIP line)

Do this only if the Toronto number is in a VoIP app. Winnipeg SIM texts still work if you skip it.

10. Under **Toronto number texts**, tap **Open notification access**.
11. In the list, turn on **CJRM**. Then go back to CJRM.
12. In **Toronto messaging app**, pick the app that receives the Toronto number's texts.
13. Tap **Save Toronto app**.
14. Confirm the green line names that app and says texts will be filed as the Toronto number.
15. Send a test text to the Toronto number, wait for the VoIP app's notification, then open CJRM and look at the **Desk**. It should show the **TOR** badge.

**You are done with this sheet when** a Winnipeg test text appears on the Desk with the **WPG** badge, and — if you set up Toronto capture — a Toronto test appears with the **TOR** badge.

If Toronto texts do not appear, confirm notification access is still on for CJRM, that the correct app is saved, and that the Toronto app actually showed a notification for the test.


---

## Sheet 1. Mailbox hub

**Time:** about 20 minutes

**Where:** a computer signed into Johnny's Gmail, then the phone

These are the same steps already proven to work. Do them again in Johnny's Google account, not a practice account.

### A. Put the code in

1. On the computer, open `https://script.google.com`
2. Confirm the account in the top right is Johnny's Gmail. If it is not, switch accounts.
3. Click **New project**.
4. Click the title at the top (it may say **Untitled project**).
5. Type `CJRM` and confirm the rename.
6. Click inside the code editor.
7. Press Ctrl+A to select everything, then press Delete, so the starter `myFunction` code is gone and the editor is empty.
8. Open the email with the subject **CJRM code v2**.
9. Copy only the code. It starts with `var LABEL_NAME = 'CJRM';` and has no notes at the top.
10. Go back to the editor and paste.
11. Press Ctrl+S to save. Wait until it says the project is saved. (If the computer tries to download a file, you clicked outside the editor. Click back inside the editor, then press Ctrl+S again.)

### B. Save the secret

12. Click the gear icon on the far left. That is **Project Settings**.
13. Scroll down to **Script Properties**.
14. Click **Add script property**.
15. In **Property**, type exactly: `CJRM_SECRET` (one underscore, no spaces, no dash).
16. In **Value**, type a long phrase you will remember, all lowercase, with single spaces and nothing after the last word. An example shape is `orange lake bicycle`. Use your own phrase, not that example.
17. Write the phrase down somewhere private. You will type it again in the app. Do not put it in this document, GitHub, or a group chat.
18. Click **Save script properties**. Do not press Ctrl+S on this screen. That can try to download a file.
19. Confirm the button now says **Edit script properties**. That means it saved.

### C. Turn it into a web app

20. Click the blue **Deploy** button at the top right.
21. Click **New deployment**.
22. Click the gear next to **Select type**.
23. Click **Web app**.
24. In **Description**, type `CJRM v1`.
25. In **Execute as**, choose **Me**.
26. In **Who has access**, choose **Anyone**. If the menu says **Anyone with the link**, choose that. Do not choose **Only myself**.
27. Click **Deploy**.
28. If you see **Authorize access**, click it.
29. Pick Johnny's Gmail account.
30. If you see **Google hasn't verified this app**, that is normal. It appears because you made this script yourself.
31. Click **Advanced** at the bottom left.
32. Click **Go to CJRM (unsafe)**.
33. Click **Allow**.
34. You will see a box with a **Web app URL** (the bottom link, ending in `/exec`) and a **Deployment ID** (a long code). Click **Copy** next to the **Web app URL** only. Do not copy the Deployment ID.
35. Click **Done**.

### D. Connect it in CJRM

36. On the phone, open CJRM.
37. Tap **More**.
38. In the box labelled **Endpoint URL**, paste the Web app URL you copied.
39. Tap the **Shared secret** box, delete anything already in it, and type the secret phrase exactly as you wrote it down: all lowercase, single spaces, nothing after the last word.
40. Tap **Save hub settings**.
41. Tap **Check mailbox now**.

**You are done with this sheet when** you see a line that says **Last check:** followed by a date and time, with no red error.

**If something goes wrong**

- If it says **unauthorized**: the secret in the app does not match the one in the script. Delete everything in the **Shared secret** box, type the phrase again carefully, tap **Save hub settings**, then tap **Check mailbox now**.
- If it says **Failed to fetch**: close CJRM all the way (swipe it out of recent apps), open it again, confirm **More** says **Version 1.1.1**, then tap **Check mailbox now**.
- If you are not sure the secret was saved: go back to **Project Settings**. If you see **Edit script properties**, it was saved. Open it and confirm the name is exactly `CJRM_SECRET`.

---

## Sheet 2. Phone numbers (Winnipeg number and Toronto number)

**Time:** about 25 minutes

**Where:** Johnny's Android phone, then Gmail, then CJRM

CJRM cannot read text messages by itself. A free app on the Android phone forwards incoming texts to Johnny's Gmail. Then CJRM files them.

This sheet is for Android. The official setup notes do not cover iPhone text forwarding, so do this on the Android phone that receives the Winnipeg and Toronto texts.

If you already installed the Android app and Winnipeg texts are filing on the Desk, you can skip the SMS-forwarder steps below for the SIM line. Use the optional Toronto steps in **Install CJRM on Android** for the second number instead of a second forwarder rule.

Use Johnny's real numbers. In the examples below, `204-555-0140` stands for the Winnipeg number and `416-555-0190` stands for the Toronto number. Do not type those 555 numbers into the app. Do not write the real numbers in GitHub or a group chat.

### A. Install the forwarder

1. On the Android phone, open this official page: `https://github.com/pppscn/SmsForwarder`
2. Look for a **Releases** section and install the app from there. Do not install it from a random download site.
3. Open the app.
4. When the phone asks, allow SMS permission. You may also allow call permission if you want missed calls forwarded too.
5. If the phone is Android 13 or newer, look for a notifications permission and allow it.
6. Look for battery or battery-optimization settings for this app, and turn restrictions off so the phone does not stop it overnight.

### B. Make a rule for the Winnipeg number

7. In the forwarder app, look for a way to add a send rule or a similar forwarding rule. The exact wording varies by version, so look for those words rather than waiting for one fixed button name.
8. Point the rule at the SIM that is the Winnipeg number, not simply "SIM 1" if the slots are the other way around.
9. Set it to email Johnny's Gmail (the same account you used in Sheet 1).
10. Set the email subject to this pattern, using the real Winnipeg number: `Text to Winnipeg number 204-555-0140`. Replace the 555 example with the real Winnipeg number. The older wording `Text to shop phone` still works.

### C. Make a rule for the Toronto number

11. Add a second rule.
12. Point it at the line or app that is the Toronto number.
13. Set it to email the same Gmail account.
14. Set the email subject to this pattern, using the real Toronto number: `Text to Toronto number 416-555-0190`. Replace the 555 example with the real Toronto number. The older wording `Text to personal phone` still works.

### D. Enter the numbers in CJRM

15. Open CJRM and tap **More**.
16. In **Winnipeg number (for tagging forwarded texts)**, type the real Winnipeg number.
17. In **Toronto number**, type the real Toronto number.
18. Tap **Save hub settings**.

You do not need to add the phone numbers in Apps Script. Entering them in **More** is enough.

### E. Test both lines

19. From a different phone, send a short test text to the Winnipeg number.
20. From a different phone, send a short test text to the Toronto number.
21. Open Gmail for Johnny's account and confirm two emails arrived, one with Winnipeg in the subject and one with Toronto in the subject.
22. In CJRM, tap **More**, then **Check mailbox now**.
23. Open the **Desk**. The Winnipeg test should show the **WPG** badge. The Toronto test should show the **TOR** badge.

**You are done with this sheet when** both test texts appear on the Desk with the right badges.

**If a test email does not arrive:** check that the rule is on, that it is tied to the correct SIM, and that the email address is Johnny's Gmail. Then send one more test text.

Missed calls can be forwarded the same way if the app allows it, or logged by hand later with **Log a call or text** on a person's **File** tab.

---

## Sheet 3. Kijiji

**Time:** about 10 minutes

**Where:** a computer signed into Kijiji and Johnny's Gmail, then CJRM

CJRM does not read Kijiji directly. It files Kijiji notification emails that land in the same Gmail you used in Sheet 1. Those emails usually come from kijiji.ca or kijiji.com, or have Kijiji or `reply from` in the subject.

The exact Kijiji menu names are not in our setup notes, so look for the settings below rather than waiting for a button with a fixed name.

1. On the computer, open Gmail for the same account you used in Sheet 1.
2. Open Kijiji and sign in to the account that owns the ads.
3. Look for account, profile, or email-notification settings.
4. Confirm the email on the Kijiji account is that same Gmail.
5. Look for email notices about replies or messages, and turn them on.
6. Send a test reply to one of the ads if Kijiji lets you, or wait for a real reply.
7. Confirm the notice arrived in that Gmail inbox.
8. In CJRM, tap **More**, then **Check mailbox now**.
9. Open the **Desk**. A Kijiji item shows the **KJ** badge.

**You are done with this sheet when** a Kijiji notice is in that Gmail inbox, and after **Check mailbox now** it appears on the Desk with the **KJ** badge.

---

## Sheet 4. Facebook / Messenger

**Time:** about 10 minutes

**Where:** a computer signed into Facebook and Johnny's Gmail, then CJRM

CJRM cannot read personal Facebook or Messenger chats directly. It files the "someone sent you a message" notification emails. Those emails usually come from facebookmail.com, or have `sent you a message` in the subject.

1. On the computer, open Gmail for the same account you used in Sheet 1.
2. Open Facebook and sign in to the account that receives the business messages.
3. Look for notification or email settings. The exact wording varies.
4. Confirm the email on the Facebook account is that same Gmail.
5. Look for email notices about new messages, and turn them on.
6. Send a test message to that account from a different Facebook or Messenger account, or wait for a real message.
7. Confirm the notice arrived in that Gmail inbox.
8. In CJRM, tap **More**, then **Check mailbox now**.
9. Open the **Desk**. A Facebook item shows the **FB** badge.

**You are done with this sheet when** a Facebook message notice is in that Gmail inbox, and after **Check mailbox now** it appears on the Desk with the **FB** badge.

---

## Sheet 5. Instagram

**Time:** about 10 minutes

**Where:** a computer signed into Instagram and Johnny's Gmail, then CJRM

CJRM cannot read personal Instagram direct messages directly. It files Instagram notification emails. Those emails usually come from mail.instagram.com.

1. On the computer, open Gmail for the same account you used in Sheet 1.
2. Open Instagram and sign in to the account that receives the business messages.
3. Look for notification or email settings. The exact wording varies.
4. Confirm the email on the Instagram account is that same Gmail.
5. Look for email notices about new messages, and turn them on.
6. Send a test message to that account from a different Instagram account, or wait for a real message.
7. Confirm the notice arrived in that Gmail inbox.
8. In CJRM, tap **More**, then **Check mailbox now**.
9. Open the **Desk**. An Instagram item shows the **IG** badge.

**You are done with this sheet when** an Instagram notice is in that Gmail inbox, and after **Check mailbox now** it appears on the Desk with the **IG** badge.

---

## Sheet 6. Website contact form

**Time:** about 10 minutes

**Where:** the website's form settings, Johnny's Gmail, then CJRM

CJRM files website form emails only when they land in the same Gmail you used in Sheet 1, and the email subject contains the words `contact form`.

1. Find how the website contact form sends email (the site settings, the form tool, or whoever built the site).
2. Look for the "send to" or destination email address.
3. Set that address to the same Gmail you used in Sheet 1.
4. Look for the subject line the form uses.
5. Make sure the subject includes the exact words `contact form`. For example: `Website contact form`.
6. Submit a test through the form, using a clearly fake name such as Test Lead.
7. Confirm the email arrived in that Gmail inbox, and that the subject includes `contact form`.
8. In CJRM, tap **More**, then **Check mailbox now**.
9. Open the **Desk**. A website form item shows the **WEB** badge.

**You are done with this sheet when** a form email with `contact form` in the subject is in that Gmail inbox, and after **Check mailbox now** it appears on the Desk with the **WEB** badge.

If you cannot change the form's destination or subject yourself, ask whoever built the site to set those two things, then run steps 6 to 9.

---

## Quick test checklist

**Time:** about 5 minutes

Use this after Sheet 1 is working. It confirms the mailbox can file a message, even before the other channels are fully set up.

1. On a computer or phone, send an email to Johnny's Gmail (the same account you used in Sheet 1).
2. Put these exact words in the subject: `contact form`. For example: `Test contact form`.
3. Write a short body, such as: `This is a CJRM test. You can delete it.`
4. Send the email.
5. Open that Gmail inbox and confirm the email arrived.
6. On the phone, open CJRM.
7. Tap **More**.
8. Confirm it still says **Version 1.1.1**.
9. Tap **Check mailbox now**.
10. Confirm you see **Last check:** followed by a date and time, with no red error.
11. Open the **Desk** and look for the test item. It should show the **WEB** badge.

**The mailbox is working when** that test email appears on the Desk with no red error on **More**.

You can delete the test email from Gmail afterward, and you can clear a leftover test lead from the Desk when you no longer need it.
