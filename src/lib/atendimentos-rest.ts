import { SERVICES_TABLE } from "@/lib/db-tables";

/** Query PostgREST idêntica ao `.select()` do cliente (sem espaços extras). */
export const ATENDIMENTOS_LITE_REST_SELECT = `id,tenant_id,paciente_id,profissional_id,local_id,especialidade_id,tv_id,hora_marcada,status,prioridade,observacao,excluir_do_fechamento,created_at,pacientes(nome),profissionais(id,nome),locais(id,nome),${SERVICES_TABLE}(id,nome)`;
