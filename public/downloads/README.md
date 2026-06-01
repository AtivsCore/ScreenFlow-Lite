# Instalador do Kit de Entrega

Coloque aqui o arquivo **`ScreenFlow_Setup.exe`** gerado pelo build do Electron:

```bash
cd desktop-app
npm install
npm run dist
```

Copie o `.exe` de `desktop-app/dist/` para esta pasta (`public/downloads/ScreenFlow_Setup.exe`) e faça deploy na Vercel.

O painel admin (`/admin/clientes-lite`) monta o ZIP do kit com:

- `ScreenFlow_Setup.exe`
- `CREDENCIAIS_DE_ACESSO.txt` (link de login Lite via `NEXT_PUBLIC_SCREENFLOW_LITE_URL`)
