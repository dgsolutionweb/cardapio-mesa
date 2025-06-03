# Cardápio Digital para Restaurantes

Sistema de pedidos em mesas via QR Code, feito com Next.js e Supabase.

## Funcionalidades
- Cliente escaneia QR Code na mesa e acessa o cardápio
- Faz o pedido diretamente pelo celular
- Pedidos vão para a tela da cozinha
- Impressão automática da comanda (opcional)

## Estrutura de Telas
- `/menu?table=XX` — Cardápio para o cliente
- `/kitchen` — Painel da cozinha
- `/admin` — Gerenciamento do cardápio

## Como rodar
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure as variáveis de ambiente (`.env.local`)
3. Rode o projeto:
   ```bash
   npm run dev
   ```

## Stack
- Next.js
- Supabase
- Material UI (UI)
- qrcode.react (geração de QR Code)
