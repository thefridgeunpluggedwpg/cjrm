package com.carpenterjohnny.cjrm;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Quiet background mailbox check. It only counts new message ids and posts a local
 * notification. It does not mark ids as filed — the desk still files them on the next
 * foreground poll.
 */
public class MailboxCheckWorker extends Worker {
    public MailboxCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        String endpoint = MailboxPrefs.urlWithSecret(context);
        if (endpoint == null || endpoint.isEmpty()) return Result.success();
        try {
            JSONArray messages = fetchMessages(endpoint);
            Set<String> notified = MailboxPrefs.notifiedIds(context);
            int fresh = 0;
            for (int i = 0; i < messages.length(); i++) {
                JSONObject row = messages.optJSONObject(i);
                if (row == null) continue;
                String id = row.optString("id", row.optString("messageId", ""));
                if (id.isEmpty()) {
                    fresh++;
                    continue;
                }
                if (!notified.contains(id)) {
                    notified.add(id);
                    fresh++;
                }
            }
            if (fresh > 0) {
                MailboxPrefs.saveNotifiedIds(context, notified);
                MailboxNotifier.showNewLeads(context, fresh);
            }
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private JSONArray fetchMessages(String endpoint) throws Exception {
        HttpURLConnection conn = null;
        try {
            conn = open(endpoint);
            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("mailbox http " + status);
            }
            String body = readAll(conn.getInputStream());
            JSONObject data = new JSONObject(body);
            if (data.has("ok") && !data.optBoolean("ok", true)) {
                throw new IllegalStateException("mailbox rejected");
            }
            JSONArray messages = data.optJSONArray("messages");
            if (messages == null) messages = data.optJSONArray("mail");
            if (messages == null) messages = data.optJSONArray("items");
            if (messages == null) throw new IllegalStateException("mailbox json missing messages");
            return messages;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private HttpURLConnection open(String endpoint) throws Exception {
        URL url = new URL(endpoint);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(25000);
        conn.setUseCaches(false);
        conn.setRequestProperty("Accept", "application/json");
        return conn;
    }

    private String readAll(InputStream stream) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        char[] buf = new char[4096];
        int n;
        while ((n = reader.read(buf)) >= 0) out.append(buf, 0, n);
        return out.toString();
    }
}
