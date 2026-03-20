/** Constrângeri implicite: calitate bună, procesare audio activată. */

export function getAudioConstraints(): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 2,
  };
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function getVideoConstraints(prefer1080: boolean): MediaTrackConstraints {
  const mobile = isMobileDevice();
  if (mobile) {
    return {
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 24, max: 30 },
    };
  }
  if (prefer1080) {
    return {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 30 },
    };
  }
  return {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 30 },
  };
}

export async function getCallMediaStream(audioOnly: boolean): Promise<MediaStream> {
  const audio = getAudioConstraints();
  if (audioOnly) {
    return navigator.mediaDevices.getUserMedia({ audio, video: false });
  }
  const prefer1080 = !isMobileDevice() && typeof window !== "undefined" && window.innerWidth >= 1200;
  const video = getVideoConstraints(prefer1080);
  return navigator.mediaDevices.getUserMedia({ audio, video });
}
