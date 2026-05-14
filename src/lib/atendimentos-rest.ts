/** Query PostgREST idêntica ao `.select()` do cliente (sem espaços extras). */
export const ATENDIMENTOS_LITE_REST_SELECT =
  "id,tenant_id,paciente_id,profissional_id,hora_marcada,status,prioridade,observacao,created_at,pacientes(nome),profissionais(id,nome)";
