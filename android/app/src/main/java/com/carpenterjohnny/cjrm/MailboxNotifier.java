package com.carpenterjohnny.cjrm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

final class MailboxNotifier {
    static final String CHANNEL = "cjrm_mailbox";
    static final int NOTICE_ID = 1121;

    private MailboxNotifier() {}

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL,
                "New mailbox leads",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Lets you know when the mailbox hub has a new lead while CJRM is in the background.");
        manager.createNotificationChannel(channel);
    }

    static void showNewLeads(Context context, int count) {
        if (count <= 0) return;
        ensureChannel(context);
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String title = count == 1 ? "New lead in CJRM" : count + " new leads in CJRM";
        String text = "Open the app to file them on the desk.";
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pending);
        try {
            NotificationManagerCompat.from(context).notify(NOTICE_ID, builder.build());
        } catch (SecurityException ignored) {
            /* Android 13+ can deny POST_NOTIFICATIONS. */
        }
    }
}
