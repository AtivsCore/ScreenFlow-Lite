import { getMasterEmail } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

type AdminLiteLayoutProps = { children: ReactNode };

export default async function AdminLiteLayout({ children }: AdminLiteLayoutProps) {
  const master = getMasterEmail();
  if (!master) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = (user?.email ?? "").trim().toLowerCase();
  if (!user || email !== master) {
    redirect("/login");
  }

  return <>{children}</>;
}
