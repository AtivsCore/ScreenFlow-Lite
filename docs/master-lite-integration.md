# Integração Master (Pro/Ecru) ↔ ScreenFlow Lite

**Onde editar:** repositório do **Painel Master / ScreenFlow Pro** (ex.: `screenflow-ecru`), **não** este repositório Lite.

Este arquivo descreve rotas, redirecionamento e SQL para o agente ou dev implementar no **projeto Pro**.

---

## Constantes de domínio (fonte única da verdade)

Criar algo como `src/lib/screenflow-public-urls.ts` (ajuste o caminho ao padrão do Pro):

```ts
/** URL pública do app Pro (Ecru) */
export const SCREENFLOW_PRO_BASE_URL = (
  process.env.NEXT_PUBLIC_SCREENFLOW_PRO_URL ?? "https://screenflow-ecru.vercel.app"
).replace(/\/+$/, "");

/** URL pública do ScreenFlow Lite */
export const SCREENFLOW_LITE_BASE_URL = (
  process.env.NEXT_PUBLIC_SCREENFLOW_LITE_URL ?? "https://screen-flow-lite.vercel.app"
).replace(/\/+$/, "");

/** Domínio da TV / kit: Lite vs Pro conforme `tenant.plano`. */
export function getTenantPublicBaseUrl(plano: string | null | undefined): string {
  const p = (plano ?? "").toLowerCase().trim();
  return p === "lite" ? SCREENFLOW_LITE_BASE_URL : SCREENFLOW_PRO_BASE_URL;
}

/** Mesmo padrão de path do Pro: `/{slug}` (slug da clínica / tenant). */
export function getTenantPublicUrl(plano: string | null | undefined, slug: string): string {
  const base = getTenantPublicBaseUrl(plano);
  const s = slug.replace(/^\/+/, "").replace(/\/+$/, "");
  return `${base}/${s}`;
}
```

No **Vercel (projeto Pro)** defina:

- `NEXT_PUBLIC_SCREENFLOW_PRO_URL` = `https://screenflow-ecru.vercel.app`
- `NEXT_PUBLIC_SCREENFLOW_LITE_URL` = `https://screen-flow-lite.vercel.app`

Assim não há URL hardcoded em build errado entre ambientes.

---

## 1. Formulário `/master/tenants/novo`

**Rota esperada (App Router):** `src/app/master/tenants/novo/page.tsx`  
(se a pasta for `clinicas` ou `app/(master)/...`, mantenha o mesmo padrão relativo).

**Tarefas:**

1. Localizar o `<select>` do **Plano** (valores atuais tipo básico / pro / enterprise).
2. Adicionar:

   ```html
   <option value="lite">Plano — Lite</option>
   ```

3. No estado do formulário (React), garantir que o tipo do campo `plano` aceite `'lite'`:

   - Se usar union type: incluir `'lite'`.
   - Se usar Zod: `z.enum([..., 'lite'])` ou equivalente.
4. No `insert`/`update` Supabase para `tenants` (ou `clinicas`), enviar `plano: 'lite'` sem cast que exclua o valor.

---

## 2. Kit, link da TV e `.exe`

**Localização:** buscar no Pro por strings como `Baixar`, `kit`, `installer`, `exe`, `screenflow-ecru`, montagem de URL com `slug` ou `tenant`.

**Substituir** construções do tipo:

```ts
const url = `${process.env.NEXT_PUBLIC_APP_URL}/${slug}`;
```

por:

```ts
import { getTenantPublicUrl } from "@/lib/screenflow-public-urls";

const url = getTenantPublicUrl(tenant.plano, tenant.slug);
```

Regras:

- Se `tenant.plano === 'lite'` (comparação **case-insensitive** recomendada), base = `SCREENFLOW_LITE_BASE_URL`.
- Caso contrário, base = `SCREENFLOW_PRO_BASE_URL`.
- **Path após o domínio** permanece `/{slug}` (igual ao Pro).

Qualquer botão **“Baixar Kit”** no painel do cliente (que hoje aponta ao domínio Pro) deve usar a **mesma função** `getTenantPublicUrl(tenant.plano, slug)` para o link aberto no navegador ou no gerador do instalador.

---

## 3. Tabela `/master` (lista de clientes)

**Rota típica:** `src/app/master/page.tsx` ou `src/app/master/tenants/page.tsx`.

Na coluna **Plano:**

- Se `plano === 'lite'` (normalizar com `.toLowerCase()`), renderizar uma badge discreta, por exemplo:

  ```tsx
  <span className="rounded-md border border-zinc-600 bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-200">
    Lite
  </span>
  ```

- Manter badges existentes para Básico / Pro / Enterprise.

---

## 4. Banco de dados (Supabase / Postgres)

### 4.1 Coluna `plano` é `text`

Nenhum `ALTER TYPE`. Apenas garantir que o app envia `'lite'` e, se existir **CHECK**, atualizar conforme abaixo.

### 4.2 CHECK constraint em `tenants` (ou `clinicas`)

Inspecionar:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.tenants'::regclass;
-- trocar 'tenants' pelo nome real da tabela
```

Se houver `CHECK (plano IN (...))`, incluir `'lite'`:

```sql
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS nome_do_constraint;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_plano_check
  CHECK (plano IN ('basico', 'pro', 'enterprise', 'lite'));
-- Ajuste os valores literais aos que o Pro já usa (ex.: 'basico' vs 'basic').
```

### 4.3 Coluna é tipo ENUM Postgres

Listar o tipo:

```sql
SELECT column_name, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'plano';
```

Adicionar valor ao enum (sintaxe depende da versão):

```sql
ALTER TYPE nome_do_enum ADD VALUE IF NOT EXISTS 'lite';
```

Em versões sem `IF NOT EXISTS` para enum, usar:

```sql
ALTER TYPE nome_do_enum ADD VALUE 'lite';
```

**Ordem:** rodar o SQL no Supabase **antes** de liberar o deploy que envia `plano = 'lite'`.

---

## 5. Por que não está neste repositório?

O **ScreenFlow Lite** (este repo) é apenas o app de fila em `src/app/page.tsx`.  
Não contém `/master/*`, formulário de tenant nem gerador de kit. Toda a lógica acima deve ser aplicada no **repositório do Master/Pro**.

---

## 6. Checklist rápido (Pro)

- [ ] Opção Lite no select de `/master/tenants/novo`
- [ ] Tipos Zod/TS incluem `'lite'`
- [ ] `getTenantPublicBaseUrl` / `getTenantPublicUrl` usados em TV + kit + links públicos
- [ ] Variáveis `NEXT_PUBLIC_SCREENFLOW_*_URL` na Vercel (Pro)
- [ ] Badge Lite na listagem `/master`
- [ ] ENUM/CHECK no Postgres atualizado para `'lite'`
