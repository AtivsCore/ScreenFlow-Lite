import { getMasterEmail } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

type AdminLiteLayoutProps = { children: ReactNode };

const ADMIN_LOGIN_NEXT = "/admin/clientes-lite";

export default async function AdminLiteLayout({ children }: AdminLiteLayoutProps) {
  const master = getMasterEmail();
  if (!master) {
    redirect(`/login?next=${encodeURIComponent(ADMIN_LOGIN_NEXT)}&reason=master_env`);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = (user?.email ?? "").trim().toLowerCase();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(ADMIN_LOGIN_NEXT)}&reason=no_session`);
  }
  if (email !== master) {
    redirect(`/login?next=${encodeURIComponent(ADMIN_LOGIN_NEXT)}&reason=not_master`);
  }

  return <>{children}</>;
}
