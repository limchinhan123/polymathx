const DEVICE_ID_KEY = "polymath-x-device-id";

/** Anonymous device identifier persisted in localStorage only (not debate payloads). */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
