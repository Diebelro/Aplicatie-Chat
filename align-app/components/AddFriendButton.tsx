"use client";

import { useState } from "react";
import { UserPlus, Clock, Users, UserMinus, Check, X } from "lucide-react";
import { getAuthHeaders } from "@/lib/authClient";
import { useI18n } from "@/lib/i18n/context";

export type FriendStatusForButton = "pending_sent" | "pending_received" | "accepted" | "rejected" | null;

interface AddFriendButtonProps {
  userId: string;
  friendStatus: FriendStatusForButton;
  onStatusChange?: () => void;
  variant?: "small" | "big";
  className?: string;
}

export function AddFriendButton({
  userId,
  friendStatus,
  onStatusChange,
  variant = "small",
  className = "",
}: AddFriendButtonProps) {
  const { tStr } = useI18n();
  const [loading, setLoading] = useState(false);

  const api = async (path: string, body?: { friend_id: string }) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/friends/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: body ? JSON.stringify({ friend_id: userId }) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || tStr("pages.addFriend.errGeneric"));
      }
      onStatusChange?.();
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = () => api("send-request", { friend_id: userId });
  const handleAccept = () => api("accept", { friend_id: userId });
  const handleReject = () => api("reject", { friend_id: userId });
  const handleRemove = () => api("remove", { friend_id: userId });

  const isBig = variant === "big";
  const baseClass = isBig
    ? "px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"
    : "p-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5";

  if (friendStatus === null) {
    return (
      <button
        type="button"
        onClick={handleSendRequest}
        disabled={loading}
        className={`${baseClass} bg-[#4DA6FF]/20 text-[#4DA6FF] hover:bg-[#4DA6FF]/30 border border-[#4DA6FF]/50 ${className}`}
        title={tStr("pages.addFriend.addTitle")}
      >
        <UserPlus className={isBig ? "w-4 h-4" : "w-3.5 h-3.5"} />
        {isBig ? tStr("pages.addFriend.addBig") : tStr("pages.addFriend.add")}
      </button>
    );
  }

  if (friendStatus === "pending_sent") {
    return (
      <span
        className={`${baseClass} bg-[#A0A0A0]/20 text-[#A0A0A0] border border-[#A0A0A0]/50 cursor-default ${className}`}
        title={tStr("pages.addFriend.pendingTitle")}
      >
        <Clock className={isBig ? "w-4 h-4" : "w-3.5 h-3.5"} />
        {isBig ? tStr("pages.addFriend.pendingBig") : tStr("pages.addFriend.pendingSmall")}
      </span>
    );
  }

  if (friendStatus === "pending_received") {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={handleAccept}
          disabled={loading}
          className={`${baseClass} bg-[#69DB7C]/20 text-[#69DB7C] hover:bg-[#69DB7C]/30 border border-[#69DB7C]/50`}
          title={tStr("pages.addFriend.acceptTitle")}
        >
          <Check className={isBig ? "w-4 h-4" : "w-3.5 h-3.5"} />
          {isBig ? tStr("pages.addFriend.acceptBig") : tStr("pages.addFriend.acceptSmall")}
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={loading}
          className={`${baseClass} bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50`}
          title={tStr("pages.addFriend.rejectTitle")}
        >
          <X className={isBig ? "w-4 h-4" : "w-3.5 h-3.5"} />
          {isBig ? tStr("pages.addFriend.rejectBig") : tStr("pages.addFriend.rejectSmall")}
        </button>
      </div>
    );
  }

  if (friendStatus === "accepted") {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span
          className={`${baseClass} bg-[#4DA6FF]/20 text-[#4DA6FF] border border-[#4DA6FF]/50 cursor-default`}
          title={tStr("pages.addFriend.friendsTitle")}
        >
          <Users className={isBig ? "w-4 h-4" : "w-3.5 h-3.5"} />
          {tStr("pages.addFriend.friendsLabel")}
        </span>
        <button
          type="button"
          onClick={handleRemove}
          disabled={loading}
          className={`${baseClass} bg-dark-600 text-dark-400 hover:bg-red-500/20 hover:text-red-400 border border-dark-500`}
          title={tStr("pages.addFriend.removeTitle")}
        >
          <UserMinus className={isBig ? "w-4 h-4" : "w-3.5 h-3.5"} />
          {isBig ? tStr("pages.addFriend.removeBig") : ""}
        </button>
      </div>
    );
  }

  return null;
}
