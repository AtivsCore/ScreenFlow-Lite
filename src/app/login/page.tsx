"use client";

import { useMergedSupabaseClient } from "@/hooks/use-merged-supabase-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function resolvePostLoginPath(nextParam: string | null): string {
  if (!nextParam) return "/";
  if (!nextParam.startsWith("/") || nextParam.startsWith("//")) return "/";
  return nextParam;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = resolvePostLoginPath(searchParams.get("next"));
  const denyReason = searchParams.get("reason");
  const { supabase, envChecking, envMissing } = useMergedSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (envMissing) {
      queueMicrotask(() => setCheckingSession(false));
      return;
    }
    if (!supabase) return;
    let cancelled = false;
    queueMicrotask(() => setCheckingSession(true));
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        router.replace(nextPath);
        return;
      }
      setCheckingSession(false);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, envMissing, router, nextPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signErr) {
      setError(signErr.message);
      setBusy(false);
      return;
    }
    router.replace(nextPath);
    router.refresh();
    setBusy(false);
  }

  async function handleForgotPassword() {
    if (!supabase) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Informe seu e-mail acima para receber o link de recuperação.");
      return;
    }
    setResetBusy(true);
    setError(null);
    setResetSent(false);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });
    if (resetErr) {
      setError(resetErr.message);
      setResetBusy(false);
      return;
    }
    setResetSent(true);
    setResetBusy(false);
  }

  if (envChecking || (supabase && checkingSession)) {
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
        <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">Entre com sua conta</p>

        {envMissing && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Supabase não configurado neste ambiente (variáveis de URL e anon key).
          </p>
        )}

        {denyReason === "not_master" && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Esta conta não é o administrador master. Use o e-mail configurado em{" "}
            <code className="font-mono">NEXT_PUBLIC_MASTER_EMAIL</code>.
          </p>
        )}
        {denyReason === "master_env" && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Painel admin indisponível: configure{" "}
            <code className="font-mono">NEXT_PUBLIC_MASTER_EMAIL</code> na Vercel e faça redeploy.
          </p>
        )}
        {denyReason === "no_session" && nextPath.startsWith("/admin/") && (
          <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
            Entre com a conta master para acessar o painel de clientes.
          </p>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 flex flex-col gap-3">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            E-mail
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
          <button
            type="button"
            disabled={resetBusy || !supabase}
            onClick={() => void handleForgotPassword()}
            className="-mt-1 text-left text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {resetBusy ? "Enviando link…" : "Esqueci minha senha"}
          </button>
          {resetSent ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              Se o e-mail existir na base, você receberá um link para redefinir a senha.
            </p>
          ) : null}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !supabase}
            className="mt-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
