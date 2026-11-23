# Building the CJRM Android app

This is a Capacitor wrapper around the same web desk. Incoming SIM texts are filed as the Winnipeg number. An optional notification listener can file texts from a chosen VoIP app as the Toronto number. The listener is off until notification access is granted and an app is picked. SIM capture works on its own.

While the app is open, the mailbox hub is checked every 30 seconds (and immediately when the app is opened or comes back to the front). Incoming SIM and VoIP texts are filed as soon as they arrive. In the background, a battery-safe WorkManager job may check the mailbox about every 15 minutes when the phone has a network and is not low on battery, and can show a local notification if new mail is waiting. That background check only notifies; the desk still files the items the next time CJRM is open.

## Release build

The signing key lives at `/home/box/secrets/cjrm-release.keystore` and must never be committed. Later updates have to be signed with this same key so they install over the old copy.

```bash
source tools/android-env.sh
npm install
npm run apk
```

The signed APK is written to `android/app/build/outputs/apk/release/app-release.apk`. Rename a copy to `CJRM-v1.1.4.apk` for delivery.

## Google developer verification (as of 22 Nov 2026)

Direct sideloading is **not** covered by the 30 September 2026 checks. Those checks apply only to listed app stores in Brazil, Indonesia, Singapore, and Thailand. Google says a global rollout to all install sources on certified Android devices begins in January 2027 and will expand over several months. ADB installs stay exempt. Plan to verify and register this package before that 2027 expansion if Johnny will keep installing from a file. Sources: [Android Developers' Blog, 19 Nov 2026](https://developer.android.com/blog/posts/android-developer-verification-2027) and the [developer verification FAQ](https://developer.android.com/developer-verification/guides/faq).
