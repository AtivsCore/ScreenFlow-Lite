"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

type SecuritySettingsPanelProps = {
  supabase: SupabaseClient | null;
};

export function SecuritySettingsPanel({ supabase }: SecuritySettingsPanelProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!supabase) {
      setErr("Supabase indisponível.");
      return;
    }
    if (newPassword.length < 6) {
      setErr("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("A confirmação não coincide com a nova senha.");
      return;
    }

    setBusy(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user.email;
    if (!email) {
      setErr("Sessão inválida. Faça login novamente.");
      setBusy(false);
      return;
    }

    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyErr) {
      setErr("Senha atual incorreta.");
      setBusy(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updateErr) {
      setErr(updateErr.message);
      setBusy(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMsg("Senha alterada com sucesso.");
    setBusy(false);
  }

  return (
    <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Segurança da conta
      </p>
      <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
        Senha atual
        <input
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
        Nova senha
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
        Confirmar nova senha
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      {err ? (
        <p className="text-[10px] text-red-600 dark:text-red-400">{err}</p>
      ) : null}
      {msg ? (
        <p className="text-[10px] text-emerald-700 dark:text-emerald-400">{msg}</p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !supabase}
        className="w-full rounded-lg border border-zinc-300 bg-white py-1.5 text-[11px] font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      >
        {busy ? "Salvando…" : "Alterar senha"}
      </button>
    </form>
  );
}
