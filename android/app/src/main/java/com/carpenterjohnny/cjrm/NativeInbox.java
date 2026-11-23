package com.carpenterjohnny.cjrm;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

/** Thread-safe pending-message queue so texts can be captured while the app is closed. */
final class NativeInbox {
    private static final String TAG = "CjrmInbox";
    private static final String FILE_NAME = "cjrm-pending-messages.json";
    private static final String PREFS = "cjrm-native";
    private static final String KEY_VOIP_PACKAGE = "voipPackage";
    private static final String KEY_VOIP_LABEL = "voipAppLabel";
    private static final Object LOCK = new Object();

    private NativeInbox() {}

    static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return String.valueOf(input.hashCode());
        }
    }

    static String smsId(String sender, long dateMs, String body) {
        String key = normalizePhone(sender) + "|" + (dateMs / 1000L) + "|" + String.valueOf(body);
        return "sms:" + sha256(key).substring(0, 24);
    }

    static String voipId(String pkg, long postTime, String title, String body) {
        String key = String.valueOf(pkg) + "|" + postTime + "|" + String.valueOf(title) + "|" + String.valueOf(body);
        return "voip:" + sha256(key).substring(0, 24);
    }

    static String normalizePhone(String raw) {
        if (raw == null) return "";
        String digits = raw.replaceAll("\\D", "");
        return digits.isEmpty() ? raw.trim() : digits;
    }

    static JSONObject smsMessage(String sender, String body, long dateMs) {
        JSONObject o = new JSONObject();
        try {
            o.put("id", smsId(sender, dateMs, body));
            o.put("source", "sms");
            o.put("from", sender == null ? "" : sender);
            o.put("phone", sender == null ? "" : sender);
            o.put("name", sender == null ? "" : sender);
            o.put("body", body == null ? "" : body);
            o.put("date", toIso(dateMs));
        } catch (Exception ignored) {}
        return o;
    }

    static JSONObject voipMessage(String pkg, String title, String body, long postTime) {
        JSONObject o = new JSONObject();
        try {
            String name = title == null ? "" : title.trim();
            o.put("id", voipId(pkg, postTime, name, body));
            o.put("source", "voip");
            o.put("from", name);
            o.put("phone", name);
            o.put("name", name);
            o.put("body", body == null ? "" : body);
            o.put("date", toIso(postTime));
            o.put("packageName", pkg == null ? "" : pkg);
        } catch (Exception ignored) {}
        return o;
    }

    static String toIso(long ms) {
        try {
            return new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US) {{
                setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            }}.format(new java.util.Date(ms));
        } catch (Exception e) {
            return String.valueOf(ms);
        }
    }

    static void append(Context context, JSONObject message) {
        if (message == null) return;
        String id = message.optString("id", "");
        String body = message.optString("body", "").trim();
        if (body.isEmpty()) return;
        synchronized (LOCK) {
            JSONArray arr = readLocked(context);
            if (!id.isEmpty()) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject existing = arr.optJSONObject(i);
                    if (existing != null && id.equals(existing.optString("id", ""))) return;
                }
            }
            arr.put(message);
            writeLocked(context, arr);
        }
        Log.i(TAG, "queued " + message.optString("source") + " " + id);
    }

    static List<JSONObject> drain(Context context) {
        synchronized (LOCK) {
            JSONArray arr = readLocked(context);
            List<JSONObject> out = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o != null) out.add(o);
            }
            writeLocked(context, new JSONArray());
            return out;
        }
    }

    static int pendingCount(Context context) {
        synchronized (LOCK) {
            return readLocked(context).length();
        }
    }

    static void setVoipApp(Context context, String packageName, String label) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        p.edit()
            .putString(KEY_VOIP_PACKAGE, packageName == null ? "" : packageName.trim())
            .putString(KEY_VOIP_LABEL, label == null ? "" : label.trim())
            .apply();
    }

    static String getVoipPackage(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_VOIP_PACKAGE, "");
    }

    static String getVoipLabel(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_VOIP_LABEL, "");
    }

    private static File file(Context context) {
        return new File(context.getFilesDir(), FILE_NAME);
    }

    private static JSONArray readLocked(Context context) {
        File f = file(context);
        if (!f.exists()) return new JSONArray();
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[(int) f.length()];
            int n = in.read(buf);
            if (n <= 0) return new JSONArray();
            String raw = new String(buf, 0, n, StandardCharsets.UTF_8).trim();
            if (raw.isEmpty()) return new JSONArray();
            return new JSONArray(raw);
        } catch (Exception e) {
            Log.w(TAG, "read inbox failed", e);
            return new JSONArray();
        }
    }

    private static void writeLocked(Context context, JSONArray arr) {
        File f = file(context);
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(arr.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            Log.w(TAG, "write inbox failed", e);
        }
    }
}
