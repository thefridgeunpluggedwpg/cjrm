package com.carpenterjohnny.cjrm;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Stores the mailbox URL and secret for background checks. Never log the secret. */
final class MailboxPrefs {
    private static final String PREFS = "cjrm-mailbox";
    private static final String KEY_URL = "hubUrl";
    private static final String KEY_SECRET = "hubSecret";
    private static final String KEY_NOTIFIED = "notifiedIds";

    private MailboxPrefs() {}

    static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void save(Context context, String url, String secret) {
        prefs(context).edit()
                .putString(KEY_URL, url == null ? "" : url.trim())
                .putString(KEY_SECRET, secret == null ? "" : secret)
                .apply();
    }

    static String url(Context context) {
        return prefs(context).getString(KEY_URL, "");
    }

    static String secret(Context context) {
        return prefs(context).getString(KEY_SECRET, "");
    }

    static String urlWithSecret(Context context) {
        String url = url(context);
        if (url == null || url.trim().isEmpty()) return "";
        String secret = secret(context);
        Uri uri = Uri.parse(url);
        if (secret != null && !secret.isEmpty() && uri.getQueryParameter("secret") == null) {
            uri = uri.buildUpon().appendQueryParameter("secret", secret).build();
        }
        return uri.toString();
    }

    static Set<String> notifiedIds(Context context) {
        String raw = prefs(context).getString(KEY_NOTIFIED, "[]");
        Set<String> ids = new LinkedHashSet<>();
        try {
            JSONArray array = new JSONArray(raw);
            for (int i = 0; i < array.length(); i++) {
                String id = array.optString(i, "");
                if (!id.isEmpty()) ids.add(id);
            }
        } catch (Exception ignored) {}
        return ids;
    }

    static void saveNotifiedIds(Context context, Set<String> ids) {
        List<String> list = new ArrayList<>(ids);
        if (list.size() > 2000) list = list.subList(list.size() - 2000, list.size());
        JSONArray array = new JSONArray();
        for (String id : list) array.put(id);
        prefs(context).edit().putString(KEY_NOTIFIED, array.toString()).apply();
    }
}
