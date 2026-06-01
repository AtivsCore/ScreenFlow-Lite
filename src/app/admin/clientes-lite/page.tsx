import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type TenantRow = {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  status: string;
  created_at: string;
};

function statusColor(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "ativo") return "#22c55e";
  if (s === "bloqueado") return "#ef4444";
  if (s === "trial") return "#eab308";
  return "#94a3b8";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ClientesLitePage() {
  const supabaseUser = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, nome, slug, plano, status, created_at")
    .order("created_at", { ascending: false });

  const rows: TenantRow[] = error !== null || data === null ? [] : (data as TenantRow[]);

  return (
    <div
      className="min-h-screen w-full p-6 md:p-10"
      style={{ background: "#07111f", color: "#f8fafc" }}
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-2 border-b border-slate-600/50 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              ScreenFlow Lite — Painel de Clientes
            </h1>
            {user?.email ? (
              <p className="mt-1 text-sm text-slate-400">Admin: {user.email}</p>
            ) : null}
          </div>
          <div className="shrink-0 self-start md:self-auto">
            <Link
              href="/admin/clientes-lite/novo"
              className="inline-block rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#185FA5" }}
            >
              Novo cliente
            </Link>
          </div>
        </header>

        {error !== null ? (
          <p className="text-red-400" role="alert">
            {error.message}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-slate-600/50">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr
                className="text-slate-300"
                style={{ borderBottom: "1px solid rgba(100, 116, 139, 0.5)" }}
              >
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Data de criação</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderTop: "1px solid rgba(100, 116, 139, 0.35)" }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-100">{row.nome}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border border-zinc-600 bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-200">
                        Lite
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: statusColor(row.status) }}>
                      {row.status}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <Link
                        href={`/admin/clientes-lite/${row.id}`}
                        className="text-sky-400 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
