/** Query PostgREST idêntica ao `.select()` do cliente (sem espaços extras). */
export const ATENDIMENTOS_LITE_REST_SELECT =
  "id,status,prioridade,hora_marcada,pacientes(nome),profissionais(nome),locais(nome)";
