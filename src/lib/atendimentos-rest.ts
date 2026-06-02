/** Query PostgREST idêntica ao `.select()` do cliente (sem join em serviços — evita erro de schema cache). */
export const ATENDIMENTOS_LITE_REST_SELECT = `id,tenant_id,paciente_id,profissional_id,local_id,especialidade_id,tv_id,hora_marcada,status,prioridade,classificacao_prioridade,observacao,cadastro_valores,excluir_do_fechamento,created_at,pacientes(nome),profissionais(id,nome,especialidade),locais(id,nome)`;

export type ServicoRow = { id: string; nome: string | null };

export function buildServicoLookup(rows: ServicoRow[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const r of rows) map.set(r.id, r.nome);
  return map;
}
