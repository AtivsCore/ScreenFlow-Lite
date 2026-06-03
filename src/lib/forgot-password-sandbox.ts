/** E-mail admin com entrega Resend ativa no sandbox (reset automático). */
export const SANDBOX_ADMIN_RESET_EMAIL = "graffenun@gmail.com";

export function buildForgotPasswordWhatsAppUrl(email: string): string {
  const text = `Olá suporte! Esqueci minha senha de acesso do ScreenFlow para o e-mail: ${email.trim()}`;
  return `https://wa.me/5541995282939?text=${encodeURIComponent(text)}`;
}
