# Orbi Plugin Tools

Plugins para **Adobe Premiere Pro** e **After Effects**, com motor nativo em **Rust**.
**Draft Creative Studio Ltda** · Desenvolvido por **Daniel Rodrigues** · Unidade DRAFT Studio

> Primeiro objetivo: tudo funciona **sem IA**. A IA (Claude, ChatGPT, sistema ORBI…) entra depois via MCP, de forma plugável.

## Visual: Orbi Design System
Os painéis seguem o **Orbi Design System** (Adaptive Soft UI) e têm 3 temas: **Escuro**, **Claro** e **Terminal**. O seletor fica no cabeçalho de cada painel, e a escolha vale para todos os painéis (`%APPDATA%\Orbi Plugin Tools\settings.json`). Fontes Manrope + DM Sans, ícones Lucide e uma só cor de ação (Orbit Lime; verde fósforo no Terminal).

## O que já funciona (v0.2)

| Plugin | Premiere | After Effects |
|---|---|---|
| **Autocut**: remove silêncios. Ritmos Natural, **FastCut** e **HyperCut** (zoom de corte alternado); **J-cut / L-cut** opcional | Cria uma nova sequência sem os silêncios (XML, não destrutivo) ou só marca os silêncios | Divide as camadas e fecha os buracos, mantendo várias camadas em sincronia; ou só marca |
| **BeatMarker**: marcadores no ritmo | Marcadores na sequência (todos os beats, 1 a cada 2, tempos fortes…) | Marcadores na camada ou na composição |
| **AutoSoundFX**: efeitos sonoros próprios (sintetizados) nos cortes ou marcadores, com o pico alinhado | Faixa de áudio escolhida, sem sobrescrever áudio | Camadas de áudio |
| **Margens**: safe areas Reels/Shorts/TikTok | PNG na resolução da sequência, na faixa mais alta | Camada-guia (não sai no render) |

## Estrutura

```
crates/orbi-engine     motor Rust (CLI JSON): áudio, silêncio, beats, XML FCP, LUT .cube, guias
crates/orbi-installer  instalador .exe único (extensões + motor embutidos)
extensions/shared    código comum dos painéis: ponte CEP própria, cliente do motor, UI, fontes, logo
extensions/com.orbi.*  um painel por plugin (index.html, js/main.js, host/premiere.jsx, host/aftereffects.jsx)
tools/build.mjs      gera manifests e monta dist/
tools/dev-install.ps1  instalação de desenvolvimento (sem admin, com DevTools)
docs/                arquitetura, roadmap, identidade visual
```

## Atalhos (duplo clique no Explorer)

| Script | O que faz | Log |
|---|---|---|
| `0-diagnostico.bat` | Verifica Rust, Node, Visual Studio, pastas CEP e PlayerDebugMode | `logs\diagnostico.txt` |
| `1-compilar-e-instalar-dev.bat` | Testa e compila o motor e liga os painéis no Premiere/AE (modo dev) | `logs\build.txt` |
| `2-teste-motor.bat` | Roda o motor com a mídia de `test-media` | `logs\motor.txt` |
| `3-gerar-instalador.bat` | Gera `out\Orbi-Plugin-Tools-Setup-<versão>.exe` | `logs\instalador.txt` |

> Use **ou** o modo dev **ou** o instalador na mesma máquina. Os dois juntos duplicam os painéis (mesmos IDs). Para passar do dev para o instalador, apague as junctions `com.orbi.*` em `%APPDATA%\Adobe\CEP\extensions`.

## Validação (06/11/2026 · Windows 11 · Premiere Pro 2026 · After Effects 2026)

| Teste | Premiere 2026 | After Effects 2026 |
|---|---|---|
| Painéis aparecem em Janela › Extensões | ✔ | ✔ |
| Autocut: análise (3 cortes · 3,6 s) | ✔ | ✔ |
| Autocut: aplicar | ✔ nova sequência via XML | ✔ 2 trechos, original desativada |
| Autocut: só marcadores | ✔ 3 marcadores | — |
| BeatMarker (128,3 BPM · 43 marcadores) | (motor ✔) | ✔ marcadores na camada |
| Margens | ✔ Reels na V3 travada | ✔ TikTok como camada-guia |
| Motor: 9 testes unitários no Windows (MSVC) | ✔ | |

Observação: no Premiere, o áudio estéreo volta da nova sequência como A1 (L) + A2 (R). É assim que o XML FCP representa estéreo.

## Pré-requisitos (Windows)

- Rust: https://rustup.rs (toolchain `stable-x86_64-pc-windows-msvc`, com o Visual Studio Build Tools)
- Node.js 18+

## Desenvolvimento

```powershell
powershell -ExecutionPolicy Bypass -File tools\dev-install.ps1
```
Depois, reinicie o Premiere/AE e abra **Janela › Extensões (legado) › Orbi · …**.
Para depurar, abra no Chrome `http://localhost:8800` (Autocut), `8810` (BeatMarker), `8820` (Margens) ou `8830` (AutoSoundFX).
A cada mudança, rode `node tools/build.mjs --dev` e recarregue o painel.

## Gerar o instalador

```powershell
cargo build -p orbi-engine --release
node tools/build.mjs
cargo build -p orbi-installer --release
# → target\release\Orbi-Plugin-Tools-Setup.exe
```
Ou faça push no GitHub: o workflow `.github/workflows/build-windows.yml` gera o `.exe` sozinho.

Opções do instalador: `--uninstall`, `--silent`, `--no-debug-mode`, `--list`, `--root <pasta>` (teste).

## Testes

```bash
cargo test -p orbi-engine        # silêncio, beats (click 120 BPM), XML, LUT, guias
orbi-engine autocut pedido.json  # ver docs/ARCHITECTURE.md para o formato
```

## Notas

- **Assinatura:** enquanto as extensões não forem assinadas, o instalador grava `PlayerDebugMode=1` (CSXS.9–14). Com certificado próprio, use `--no-debug-mode`.
- **Autocut no Premiere** remonta V1 + A1/A2 a partir da faixa analisada (fluxo de vídeo falado). Efeitos e outras faixas não entram na nova sequência. Para preservar a timeline original, use o modo **Só marcadores**.
- **After Effects 2026:** há relatos de painéis CEP que não aparecem em algumas instalações. Se acontecer, confira a pasta de extensões e o `PlayerDebugMode` antes de qualquer outra coisa.
- Fonte **Plus Jakarta Sans** embutida sob a licença SIL OFL 1.1 (`extensions/shared/fonts`).
