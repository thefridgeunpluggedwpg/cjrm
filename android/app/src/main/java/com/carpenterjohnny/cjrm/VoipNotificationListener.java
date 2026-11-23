package com.carpenterjohnny.cjrm;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

public class VoipNotificationListener extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String pkg = sbn.getPackageName();
        if (pkg == null || pkg.equals(getPackageName())) return;
        String wanted = NativeInbox.getVoipPackage(this);
        if (wanted == null || wanted.trim().isEmpty()) return; // off by default
        if (!wanted.equals(pkg)) return;
        if (sbn.isOngoing()) return;
        Notification notification = sbn.getNotification();
        if (notification == null) return;
        if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        Bundle extras = notification.extras;
        if (extras == null) return;

        String title = stringOf(extras.getCharSequence(Notification.EXTRA_TITLE));
        boolean filedAny = false;

        Object rawMsgs = extras.get(Notification.EXTRA_MESSAGES);
        if (rawMsgs instanceof java.util.ArrayList) {
            java.util.ArrayList<?> list = (java.util.ArrayList<?>) rawMsgs;
            for (Object item : list) {
                if (!(item instanceof Bundle)) continue;
                Bundle b = (Bundle) item;
                String text = stringOf(b.getCharSequence("text"));
                String sender = stringOf(b.getCharSequence("sender"));
                if (text.isEmpty()) continue;
                long when = b.getLong("time", sbn.getPostTime());
                enqueue(pkg, sender.isEmpty() ? title : sender, text, when);
                filedAny = true;
            }
        }

        if (!filedAny) {
            String body = stringOf(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
            if (body.isEmpty()) body = stringOf(extras.getCharSequence(Notification.EXTRA_TEXT));
            if (body.isEmpty()) body = stringOf(extras.getCharSequence(Notification.EXTRA_SUB_TEXT));
            if (body.isEmpty()) return;
            enqueue(pkg, title, body, sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis());
        }
    }

    private void enqueue(String pkg, String title, String body, long when) {
        if (body == null || body.trim().isEmpty()) return;
        JSONObject message = NativeInbox.voipMessage(pkg, title, body.trim(), when);
        NativeInbox.append(getApplicationContext(), message);
        CjrmNativePlugin.emit(message);
    }

    private static String stringOf(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }
}
