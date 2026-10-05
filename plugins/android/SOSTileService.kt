// Rewritten at prebuild time from android.package — see
// plugins/withSOSQuickSettingsTile.js. The value here is only a placeholder
// so the file parses on its own; it is never the one that gets compiled.
package com.wayloc.app

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * Quick Settings Tile: one tap triggers SOS without unlocking the phone or
 * opening the app first. Deliberately does NOT write to Firestore directly
 * from here — it opens the app at a dedicated deep-link route
 * (wayloc:///sos-trigger, see app/(app)/sos-trigger.tsx) which calls the
 * app's existing triggerSOS() so offline queueing, journey linking, and the
 * Firestore write shape all stay defined in exactly one place.
 */
class SOSTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            label = "SOS"
            state = Tile.STATE_INACTIVE
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("wayloc:///sos-trigger")).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // startActivityAndCollapse(Intent) is deprecated from API 34 in favor of
            // the PendingIntent overload — the plain-Intent overload still exists but
            // logs a deprecation warning and may be removed in a future OS release.
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE,
            )
            startActivityAndCollapse(pendingIntent)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
