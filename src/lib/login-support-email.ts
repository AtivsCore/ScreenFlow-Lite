export const LOGIN_SUPPORT_EMAIL_DEFAULT = "appercomp@gmail.com";

export const LOGIN_SUPPORT_GMAIL_COMPOSE_URL =
  "https://mail.google.com/mail/?view=cm&fs=1&to=appercomp@gmail.com&su=Suporte%20-%20ScreenFlow";

export async function copyLoginSupportEmail(
  email = LOGIN_SUPPORT_EMAIL_DEFAULT
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(email);
    return true;
  } catch {
    return false;
  }
}

export function openLoginSupportGmailCompose(): void {
  if (typeof window === "undefined") return;
  window.open(LOGIN_SUPPORT_GMAIL_COMPOSE_URL, "_blank", "noopener,noreferrer");
}
