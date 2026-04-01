package ro.align.app.call

import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager

object TelecomBridge {
    fun addIncomingCall(
        context: Context,
        roomId: String,
        callerId: String,
        callerName: String,
        audioOnly: Boolean,
    ) {
        val app = context.applicationContext
        PhoneAccountRegistrar.ensureAccount(app)
        val tm = app.getSystemService(TelecomManager::class.java) ?: return
        val handle = PhoneAccountRegistrar.handle(app)
        val extras = Bundle()
        extras.putString(AlignConnection.EXTRA_ROOM_ID, roomId)
        extras.putString(AlignConnection.EXTRA_CALLER_ID, callerId)
        extras.putString(AlignConnection.EXTRA_CALLER_NAME, callerName)
        extras.putBoolean(AlignConnection.EXTRA_AUDIO_ONLY, audioOnly)
        val uri = Uri.fromParts("align", roomId, null)
        extras.putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, uri)
        tm.addNewIncomingCall(handle, extras)
    }
}
