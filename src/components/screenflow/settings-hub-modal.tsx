"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { HeartPulse, MapPin, Stethoscope, Tv } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { CrudEntityModal } from "@/components/screenflow/crud-entity-modal";

type SettingsHubModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  onDataChanged?: () => void;
};

const sections = [
  { id: "profissionais" as const, label: "Equipe médica", icon: Stethoscope, table: "profissionais" },
  { id: "locais" as const, label: "Locais (salas)", icon: MapPin, table: "locais" },
  { id: "especialidades" as const, label: "Especialidades", icon: HeartPulse, table: "especialidades" },
  { id: "tvs" as const, label: "TVs", icon: Tv, table: "tvs" },
];

export function SettingsHubModal({ open, onClose, supabase, onDataChanged }: SettingsHubModalProps) {
  const [crud, setCrud] = useState<null | (typeof sections)[number]>(null);

  return (
    <>
      <Modal open={open && !crud} title="Configurações" onClose={onClose} widthClassName="max-w-md">
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Cadastros de apoio. Requer tabelas e políticas RLS no Supabase.
        </p>
        <div className="grid gap-2">
          {sections.map((section) => {
            const { id, label, icon: Icon, table } = section;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCrud(section)}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <Icon className="size-5 shrink-0 text-zinc-500" strokeWidth={1.75} aria-hidden />
                {label}
                <span className="ml-auto font-mono text-[10px] font-normal text-zinc-400">{table}</span>
              </button>
            );
          })}
        </div>
      </Modal>

      {crud && (
        <CrudEntityModal
          open
          supabase={supabase}
          title={crud.label}
          table={crud.table}
          onClose={() => setCrud(null)}
          onSaved={onDataChanged}
        />
      )}
    </>
  );
}
