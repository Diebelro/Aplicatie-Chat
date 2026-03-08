/**
 * Store pentru device-uri (în memorie; echivalent cu tabelul Devices din Prisma).
 * La login: căutăm/creăm device după userId + fingerprint; actualizăm trusted și lastUsedAt.
 */

export interface Device {
  id: string;
  userId: string;
  fingerprint: string;
  userAgent: string;
  ip: string;
  trusted: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

const devices: Device[] = [];

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function findDevice(userId: string, fingerprint: string): Device | undefined {
  const fp = (fingerprint || "").trim().slice(0, 128);
  if (!fp) return undefined;
  return devices.find(
    (d) => d.userId === userId && d.fingerprint === fp
  );
}

export function createDevice(params: {
  userId: string;
  fingerprint: string;
  userAgent: string;
  ip: string;
  trusted?: boolean;
}): Device {
  const fp = (params.fingerprint || "").trim().slice(0, 128);
  const now = new Date();
  const device: Device = {
    id: generateId(),
    userId: params.userId,
    fingerprint: fp,
    userAgent: params.userAgent || "",
    ip: params.ip || "unknown",
    trusted: params.trusted ?? false,
    createdAt: now,
    lastUsedAt: now,
  };
  devices.push(device);
  return device;
}

export function findDeviceById(deviceId: string): Device | undefined {
  return devices.find((d) => d.id === deviceId);
}

export function setDeviceTrusted(deviceId: string, trusted: boolean): void {
  const d = devices.find((x) => x.id === deviceId);
  if (d) d.trusted = trusted;
}

export function updateDeviceLastUsed(deviceId: string): void {
  const d = devices.find((x) => x.id === deviceId);
  if (d) d.lastUsedAt = new Date();
}

export function setAllDevicesUntrusted(userId: string): void {
  devices.forEach((d) => {
    if (d.userId === userId) d.trusted = false;
  });
}

export function deleteDevicesForUser(userId: string): void {
  for (let i = devices.length - 1; i >= 0; i--) {
    if (devices[i].userId === userId) devices.splice(i, 1);
  }
}
