package com.carpenterjohnny.cjrm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;

import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;

public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }
        Bundle bundle = intent.getExtras();
        if (bundle == null) return;
        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;
        String format = bundle.getString("format");
        Map<String, StringBuilder> bodies = new LinkedHashMap<>();
        Map<String, Long> times = new LinkedHashMap<>();
        for (Object pdu : pdus) {
            SmsMessage msg;
            try {
                msg = SmsMessage.createFromPdu((byte[]) pdu, format);
            } catch (Exception e) {
                try { msg = SmsMessage.createFromPdu((byte[]) pdu); } catch (Exception e2) { continue; }
            }
            if (msg == null) continue;
            String from = msg.getDisplayOriginatingAddress();
            if (from == null || from.trim().isEmpty()) from = msg.getOriginatingAddress();
            if (from == null) from = "";
            String body = msg.getDisplayMessageBody();
            if (body == null) body = msg.getMessageBody();
            if (body == null) body = "";
            if (!bodies.containsKey(from)) bodies.put(from, new StringBuilder());
            bodies.get(from).append(body);
            times.put(from, msg.getTimestampMillis() > 0 ? msg.getTimestampMillis() : System.currentTimeMillis());
        }
        for (Map.Entry<String, StringBuilder> entry : bodies.entrySet()) {
            String body = entry.getValue().toString().trim();
            if (body.isEmpty()) continue;
            long when = times.containsKey(entry.getKey()) ? times.get(entry.getKey()) : System.currentTimeMillis();
            JSONObject message = NativeInbox.smsMessage(context, entry.getKey(), body, when);
            NativeInbox.append(context.getApplicationContext(), message);
            CjrmNativePlugin.emit(message);
        }
    }
}
