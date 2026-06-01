# ScreenFlow Lite — Desktop (Electron)

Cliente Windows que abre o login web do Lite em janela nativa.

## Login

O app carrega fixo:

`https://screen-flow-lite.vercel.app/login`

(constante `LOGIN_URL` em `desktop-app/main.js`)

## Build do instalador

```bash
cd desktop-app
npm install
npm run dist
```

O instalador sai em `desktop-app/dist/ScreenFlow_Setup.exe`.

Copie para `public/downloads/ScreenFlow_Setup.exe` no projeto Next.js e faça deploy — o painel admin usa esse arquivo no **Baixar Kit de Entrega**.

## Desenvolvimento

```bash
cd desktop-app
npm install
npm start
```
