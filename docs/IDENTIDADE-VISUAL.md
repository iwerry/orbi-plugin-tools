# Identidade visual: Orbi Design System nos painéis

Fonte: pacote **Orbi Design System** (Adaptive Soft UI). Implementado em `extensions/shared/css/orbi-ui.css`.

## Três ambientes de luz
| Token | Escuro | Claro | Terminal |
|---|---|---|---|
| Fundo `--neo-bg` | #121416 | #e8eeea | #060908 |
| Campos `--neo-bg-deep` | #0b0d0f | #dfe7e2 | #020403 |
| Cards `--neo-surface-solid` | #202326 | #edf2ef | #0d1812 |
| Texto `--neo-text` | #f0f2ef | #27332c | #dff8e8 |
| Ação `--neo-accent` | #bce64a | #bce64a (texto #4a6a2a) | #58f28b |

Trocar o tema só troca tokens: nada muda de tamanho ou de lugar.
- **Escuro:** grafite com relevo suave.
- **Claro:** neumórfico, com sombras em par.
- **Terminal:** monoespaçado e bordas neon finas no lugar do relevo.

## Regras aplicadas
- Uma só cor de ação: Orbit Lime (verde fósforo no Terminal).
- Fontes: Manrope (títulos) + DM Sans (texto). No Terminal, tudo monoespaçado.
- Cantos: 8 px (campos), 12 px (botões e controles segmentados), 14 px (cards) e pílula (chips).
- Controles de 34 px. Nenhum texto abaixo de 11 px.
- Ícones Lucide inline (`orbi-icons.js`).
- Sem `color-mix()`: o Chromium do CEP é antigo, então as misturas com o acento estão pré-calculadas por tema.

## Cabeçalho e créditos (injetados por `orbi-ui.js`)
- **Cabeçalho:** símbolo Orbi + "Orbi Plugin Tools" + nome do painel + indicador do app + seletor de tema.
- **Rodapé:** logo DRAFT (branco ou grafite, conforme o tema) e a assinatura
  **Draft Creative Studio Ltda · Creative Design & Software Development · Daniel Rodrigues**.
- **Sincronização do tema:** arquivo `%APPDATA%\Orbi Plugin Tools\settings.json` + evento CEP `com.orbi.themeChanged`.
