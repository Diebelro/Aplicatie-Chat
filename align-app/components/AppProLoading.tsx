"use client";

import { Loader2 } from "lucide-react";
import {
  SkeletonChatThread,
  SkeletonConversationList,
  SkeletonFormPanel,
  SkeletonMapPanel,
  SkeletonProfileGrid,
} from "@/components/perceived/AppShellLoadingLayout";

export type AppProLoadingVariant = "spinner" | "list" | "chat" | "profiles" | "form" | "map";

type AppProLoadingProps = {
  label: string;
  className?: string;
  /** Cum arată conținutul în timpul încărcării — skeleton-uri pentru perceived performance. */
  variant?: AppProLoadingVariant;
};

export function AppProLoading({
  label,
  className = "",
  variant = "spinner",
}: AppProLoadingProps) {
  if (variant === "spinner") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-4 py-20 px-6 ${className}`.trim()}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dark-600/70 bg-dark-800/90 shadow-sm">
          <Loader2 className="h-7 w-7 animate-spin text-brand-500" aria-hidden />
        </div>
        <p className="text-sm font-medium text-dark-500 text-center max-w-xs leading-relaxed">{label}</p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-5 py-4 px-0 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {variant === "list" && <SkeletonConversationList />}
      {variant === "chat" && <SkeletonChatThread />}
      {variant === "profiles" && <SkeletonProfileGrid />}
      {variant === "form" && <SkeletonFormPanel />}
      {variant === "map" && <SkeletonMapPanel />}
      <p className="text-sm font-medium text-dark-500 text-center max-w-xs leading-relaxed mx-auto">{label}</p>
    </div>
  );
}
