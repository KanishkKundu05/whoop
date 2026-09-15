/** Keep OAuth return paths on this app, including URL-parser edge cases. */
export function safeNextPath(value: string | null | undefined, fallback = "/whoop") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) {
    return fallback;
  }
  return value;
}

export function whoopAuthError(code?: string) {
  if (!code) return null;
  const messages: Record<string, string> = {
    access_denied: "WHOOP access was declined. You can try again whenever you’re ready.",
    missing_config: "WHOOP connection is being configured. Please try again later.",
    session_expired: "Your WHOOP connection expired. Reconnect to continue.",
    refresh_failed: "We couldn’t renew your WHOOP connection. Please reconnect.",
    disconnect_failed: "We couldn’t finish disconnecting WHOOP. Please try again.",
    state_mismatch: "Your sign-in session expired. Please start again.",
  };
  return messages[code] ?? "We couldn’t connect to WHOOP. Please try again.";
}
