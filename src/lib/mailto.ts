/** Monta href mailto com subject/body codificados corretamente. */
export function buildMailtoHref(
  to: string,
  options?: { subject?: string; body?: string }
): string {
  const email = to.trim();
  if (!email) return "mailto:";
  const params = new URLSearchParams();
  if (options?.subject) params.set("subject", options.subject);
  if (options?.body) params.set("body", options.body);
  const qs = params.toString();
  return qs ? `mailto:${email}?${qs}` : `mailto:${email}`;
}

/**
 * Abre o cliente de e-mail padrão do sistema (Outlook, Mail, Thunderbird, etc.).
 */
export function openNativeMailClient(href: string): void {
  if (typeof window === "undefined" || !href.startsWith("mailto:")) return;
  // assign dispara o handler mailto do SO (Windows/macOS/Linux).
  window.location.assign(href);
}
