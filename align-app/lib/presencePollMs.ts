import { isDiebelAndroidShell } from "@/lib/navigateApp";

/** Interval reîmprospătare status online în UI (Discover / Profiluri / Match-uri). */
export function getPresencePollMs(): number {
  return isDiebelAndroidShell() ? 5000 : 10000;
}
