/**
 * Separă tap (deschide poză) de scroll pe mobil.
 * Folosește touch-action: pan-y pe element + acest helper pe touch/click.
 */

const TAP_MAX_MOVE_PX = 14;

export type TapTrack = {
  x: number;
  y: number;
  moved: boolean;
};

export function beginTapTrack(clientX: number, clientY: number): TapTrack {
  return { x: clientX, y: clientY, moved: false };
}

export function updateTapTrack(track: TapTrack | null, clientX: number, clientY: number): void {
  if (!track || track.moved) return;
  if (Math.hypot(clientX - track.x, clientY - track.y) > TAP_MAX_MOVE_PX) {
    track.moved = true;
  }
}

/** true = a fost tap (nu scroll / drag). */
export function endTapTrack(track: TapTrack | null): boolean {
  return !!track && !track.moved;
}
