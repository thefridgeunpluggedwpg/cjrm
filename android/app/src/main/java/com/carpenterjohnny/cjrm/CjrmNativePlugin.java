package com.carpenterjohnny.cjrm;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Settings;
import android.provider.Telephony;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(
    name = "CjrmNative",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }
        ),
        @Permission(
            alias = "contacts",
            strings = { Manifest.permission.READ_CONTACTS }
        ),
        @Permission(
            alias = "phone",
            strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS, Manifest.permission.READ_CONTACTS }
        ),
        @Permission(
            alias = "alerts",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class CjrmNativePlugin extends Plugin {
    private static volatile CjrmNativePlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        notifyListeners("appResume", new JSObject(), false);
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        super.handleOnDestroy();
    }

    static void emit(JSONObject message) {
        CjrmNativePlugin plugin = instance;
        if (plugin == null || message == null) return;
        try {
            plugin.notifyListeners("nativeMessage", JSObject.fromJSONObject(message), true);
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject out = new JSObject();
        out.put("smsReceiveGranted", granted(Manifest.permission.RECEIVE_SMS));
        out.put("smsReadGranted", granted(Manifest.permission.READ_SMS));
        out.put("contactsGranted", granted(Manifest.permission.READ_CONTACTS));
        out.put("notificationAccess", hasNotificationAccess());
        out.put("voipPackage", NativeInbox.getVoipPackage(getContext()));
        out.put("voipAppLabel", NativeInbox.getVoipLabel(getContext()));
        out.put("pendingCount", NativeInbox.pendingCount(getContext()));
        call.resolve(out);
    }

    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        if (granted(Manifest.permission.RECEIVE_SMS) && granted(Manifest.permission.READ_SMS)) {
            getStatus(call);
            return;
        }
        requestPermissionForAlias("sms", call, "smsPermsResult");
    }

    @PermissionCallback
    private void smsPermsResult(PluginCall call) {
        getStatus(call);
    }

    @PluginMethod
    public void requestPhonePermissions(PluginCall call) {
        if (granted(Manifest.permission.RECEIVE_SMS)
                && granted(Manifest.permission.READ_SMS)
                && granted(Manifest.permission.READ_CONTACTS)) {
            getStatus(call);
            return;
        }
        requestPermissionForAlias("phone", call, "phonePermsResult");
    }

    @PermissionCallback
    private void phonePermsResult(PluginCall call) {
        getStatus(call);
    }

    @PluginMethod
    public void lookupContactName(PluginCall call) {
        String phone = call.getString("phone", "");
        JSObject out = new JSObject();
        out.put("name", NativeInbox.contactName(getContext(), phone));
        call.resolve(out);
    }

    @PluginMethod
    public void openAppInfo(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openNotificationAccess(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void drainInbox(PluginCall call) {
        List<JSONObject> messages = NativeInbox.drain(getContext());
        call.resolve(wrapMessages(messages));
    }

    @PluginMethod
    public void importRecentSms(PluginCall call) {
        if (!granted(Manifest.permission.READ_SMS)) {
            call.reject("Reading recent texts is not allowed yet. Tap Allow texts first.");
            return;
        }
        int limit = call.getInt("limit", 100);
        int days = call.getInt("days", 14);
        if (limit < 1) limit = 1;
        if (limit > 200) limit = 200;
        if (days < 1) days = 1;
        long cutoff = System.currentTimeMillis() - days * 24L * 60L * 60L * 1000L;
        List<JSONObject> messages = new ArrayList<>();
        String[] projection = new String[] {
            Telephony.Sms.Inbox._ID,
            Telephony.Sms.Inbox.ADDRESS,
            Telephony.Sms.Inbox.BODY,
            Telephony.Sms.Inbox.DATE
        };
        try (Cursor cursor = getContext().getContentResolver().query(
                Telephony.Sms.Inbox.CONTENT_URI,
                projection,
                Telephony.Sms.Inbox.DATE + " >= ?",
                new String[] { String.valueOf(cutoff) },
                Telephony.Sms.Inbox.DATE + " DESC"
        )) {
            if (cursor != null) {
                while (cursor.moveToNext() && messages.size() < limit) {
                    String from = cursor.getString(1);
                    String body = cursor.getString(2);
                    long date = cursor.getLong(3);
                    if (body == null || body.trim().isEmpty()) continue;
                    messages.add(NativeInbox.smsMessage(getContext(), from, body.trim(), date));
                }
            }
        } catch (SecurityException e) {
            call.reject("Reading recent texts is not allowed yet. Tap Allow texts first.");
            return;
        } catch (Exception e) {
            call.reject("Could not read recent texts.");
            return;
        }
        call.resolve(wrapMessages(messages));
    }

    @PluginMethod
    public void listApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN, null);
        main.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> infos = pm.queryIntentActivities(main, 0);
        List<JSObject> apps = new ArrayList<>();
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        for (ResolveInfo info : infos) {
            if (info.activityInfo == null) continue;
            String pkg = info.activityInfo.packageName;
            if (pkg == null || !seen.add(pkg)) continue;
            if (pkg.equals(getContext().getPackageName())) continue;
            CharSequence labelCs = info.loadLabel(pm);
            String label = labelCs == null ? pkg : labelCs.toString();
            JSObject row = new JSObject();
            row.put("packageName", pkg);
            row.put("label", label);
            apps.add(row);
        }
        Collections.sort(apps, new Comparator<JSObject>() {
            @Override
            public int compare(JSObject a, JSObject b) {
                return a.getString("label", "").compareToIgnoreCase(b.getString("label", ""));
            }
        });
        JSArray array = new JSArray();
        for (JSObject row : apps) array.put(row);
        JSObject out = new JSObject();
        out.put("apps", array);
        call.resolve(out);
    }

    @PluginMethod
    public void setVoipApp(PluginCall call) {
        String pkg = call.getString("packageName", "");
        String label = call.getString("label", "");
        if (pkg == null) pkg = "";
        NativeInbox.setVoipApp(getContext(), pkg, label);
        JSObject out = new JSObject();
        out.put("voipPackage", NativeInbox.getVoipPackage(getContext()));
        out.put("voipAppLabel", NativeInbox.getVoipLabel(getContext()));
        out.put("notificationAccess", hasNotificationAccess());
        call.resolve(out);
    }

    @PluginMethod
    public void setHubConfig(PluginCall call) {
        String url = call.getString("url", "");
        String secret = call.getString("secret", "");
        if (url == null) url = "";
        if (secret == null) secret = "";
        MailboxPrefs.save(getContext(), url, secret);
        boolean scheduled = !url.trim().isEmpty();
        if (scheduled) {
            MailboxWork.schedule(getContext());
            if (android.os.Build.VERSION.SDK_INT >= 33
                    && !granted(Manifest.permission.POST_NOTIFICATIONS)) {
                requestPermissionForAlias("alerts", call, "alertsCallback");
                return;
            }
        } else {
            MailboxWork.cancel(getContext());
        }
        JSObject out = new JSObject();
        out.put("ok", true);
        out.put("scheduled", scheduled);
        call.resolve(out);
    }

    @PermissionCallback
    public void alertsCallback(PluginCall call) {
        JSObject out = new JSObject();
        out.put("ok", true);
        out.put("scheduled", true);
        out.put("alertsGranted", android.os.Build.VERSION.SDK_INT < 33
                || granted(Manifest.permission.POST_NOTIFICATIONS));
        call.resolve(out);
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasNotificationAccess() {
        Set<String> enabled = NotificationManagerCompat.getEnabledListenerPackages(getContext());
        return enabled != null && enabled.contains(getContext().getPackageName());
    }

    private JSObject wrapMessages(List<JSONObject> messages) {
        JSArray array = new JSArray();
        for (JSONObject message : messages) {
            try {
                array.put(JSObject.fromJSONObject(message));
            } catch (Exception ignored) {}
        }
        JSObject out = new JSObject();
        out.put("messages", array);
        return out;
    }
}
