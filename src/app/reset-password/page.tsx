"use client";

import { useMergedSupabaseClient } from "@/hooks/use-merged-supabase-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type PagePhase = "loading" | "form" | "invalid" | "success";

function hashIndicatesRecovery(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  return params.get("type") === "recovery";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase, envChecking, envMissing } = useMergedSupabaseClient();

  const [phase, setPhase] = useState<PagePhase>("loading");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (envMissing) {
      queueMicrotask(() => setPhase("invalid"));
      return;
    }
    if (!supabase) return;

    let cancelled = false;
    let settled = false;

    const openForm = () => {
      if (cancelled || settled) return;
      settled = true;
      setPhase("form");
    };

    const markInvalid = () => {
      if (cancelled || settled) return;
      settled = true;
      setPhase("invalid");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") openForm();
    });

    void (async () => {
      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeErr) markInvalid();
        else openForm();
        return;
      }

      if (hashIndicatesRecovery()) {
        await new Promise((r) => window.setTimeout(r, 400));
        if (cancelled || settled) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled || settled) return;
        if (session) openForm();
        else markInvalid();
        return;
      }

      await new Promise((r) => window.setTimeout(r, 600));
      if (cancelled || settled) return;
      markInvalid();
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, envMissing, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || phase !== "form") return;

    setError(null);
    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updateErr) {
      setError(updateErr.message);
      setBusy(false);
      return;
    }

    setPhase("success");
    setBusy(false);

    window.setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 3000);
  }

  if (envChecking || phase === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-100 text-sm text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-center text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          ScreenFlow Lite
        </h1>
        <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">Redefinir senha</p>

        {envMissing && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Supabase não configurado neste ambiente.
          </p>
        )}

        {phase === "invalid" && (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Link de recuperação inválido ou expirado. Solicite um novo link na tela de login.
            </p>
            <Link
              href="/login"
              className="flex w-full items-center justify-center rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Voltar para o login
            </Link>
          </div>
        )}

        {phase === "success" && (
          <div className="mt-6 space-y-3">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              Senha alterada com sucesso! Redirecionando para o painel…
            </p>
            <Link
              href="/"
              className="block text-center text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Ir agora
            </Link>
          </div>
        )}

        {phase === "form" && (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 flex flex-col gap-3">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Confirmar nova senha
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </label>
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy || !supabase}
              className="mt-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {busy ? "Salvando…" : "Salvar nova senha"}
            </button>
            <Link
              href="/login"
              className="text-center text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Voltar para o login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
