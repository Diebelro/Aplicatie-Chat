package ro.diebel.chat.call

import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccountHandle

class AlignConnectionService : ConnectionService() {

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest,
    ): Connection {
        val ex = request.extras
        val roomId = ex.getString(AlignConnection.EXTRA_ROOM_ID)
            ?: return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR))
        val callerId = ex.getString(AlignConnection.EXTRA_CALLER_ID).orEmpty()
        val callerName = ex.getString(AlignConnection.EXTRA_CALLER_NAME).orEmpty()
        val audioOnly = ex.getBoolean(AlignConnection.EXTRA_AUDIO_ONLY, false)
        val conn = AlignConnection(applicationContext, roomId, callerId, callerName, audioOnly)
        conn.setRinging()
        return conn
    }

    override fun onCreateIncomingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest,
    ) {
        super.onCreateIncomingConnectionFailed(connectionManagerPhoneAccount, request)
    }
}
