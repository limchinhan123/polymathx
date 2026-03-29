const DEVICE_ID_KEY = "polymath-x-device-id";

/** Dispatched on `window` after the history sync key in localStorage changes. */
export const HISTORY_SYNC_KEY_CHANGED_EVENT = "polymathx-history-sync-key";

/** Accepts standard UUID strings (e.g. from `crypto.randomUUID()`). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notifyHistorySyncKeyChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HISTORY_SYNC_KEY_CHANGED_EVENT));
  }
}

/** Anonymous history key persisted in localStorage (Convex `deviceId`). */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Normalize user paste (trim, lowercase) and validate UUID shape. */
export function parseHistorySyncKey(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  return UUID_RE.test(s) ? s : null;
}

/**
 * Point this browser at the same Convex history as another device.
 * Returns an error if the string is not a valid UUID.
 */
export function setHistorySyncKey(raw: string): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined") {
    return { ok: false, error: "Not available in this environment." };
  }
  const key = parseHistorySyncKey(raw);
  if (!key) {
    return {
      ok: false,
      error: "Use a full UUID (copy from Settings on your other device).",
    };
  }
  const prev = localStorage.getItem(DEVICE_ID_KEY);
  if (prev === key) {
    return { ok: true };
  }
  localStorage.setItem(DEVICE_ID_KEY, key);
  notifyHistorySyncKeyChanged();
  return { ok: true };
}
