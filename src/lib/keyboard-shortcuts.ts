export type ShortcutEntry = {
  keys: string;
  action: string;
  group: string;
};

export const KEYBOARD_SHORTCUTS: ShortcutEntry[] = [
  { group: "Chamada", keys: "Alt + C", action: "Chamar paciente selecionado" },
  { group: "Chamada", keys: "Alt + R", action: "Rechamar" },
  { group: "Chamada", keys: "Alt + F", action: "Finalizar atendimento" },
  { group: "Chamada", keys: "Alt + X", action: "Limpar seleção / dados" },
  { group: "Fluxo", keys: "Alt + N", action: "Novo registro" },
  { group: "Fluxo", keys: "Alt + V", action: "Alternar Lista / Kanban" },
  { group: "Fluxo", keys: "Alt + K", action: "Abrir configurações" },
  { group: "Cadastros", keys: "Alt + 1", action: "Cadastro de equipe (profissionais)" },
  { group: "Cadastros", keys: "Alt + 2", action: "Cadastro de locais" },
  { group: "Cadastros", keys: "Alt + 3", action: "Cadastro de serviços" },
];
