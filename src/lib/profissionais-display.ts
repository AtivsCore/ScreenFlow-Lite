export type ProfissionalRow = {
  id: string;
  nome: string | null;
  especialidade?: string | null;
};

/** Rótulo amigável: "Nome - Especialidade" (ou só o nome). */
export function formatProfissionalLabel(
  row: Pick<ProfissionalRow, "nome" | "especialidade">
): string {
  const nome = row.nome?.trim() || "—";
  const esp = row.especialidade?.trim();
  return esp ? `${nome} - ${esp}` : nome;
}
