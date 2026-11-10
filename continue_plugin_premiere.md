# Continuar — Orbi Plugin Tools (Plugins Premiere + After Effects)

**Draft Creative Studio Ltda · Creative Design & Software Development · Daniel Rodrigues**
Última sessão: 06/11/2026 (tarde) · Projeto: `D:\WWW\PluginAdobe` · Versão **0.2.0**

> **Novidade da 0.2 (06/11, tarde):** o FDCS Studio Tools virou **Orbi Plugin Tools**, com o mesmo Orbi Design System do app Orbi (3 temas: Escuro, Claro e Terminal). Também entraram **FastCut**, **HyperCut** (zoom de corte alternado) e **J-cut / L-cut** no Autocut, e o painel novo **AutoSoundFX**: sons sintetizados pelo próprio motor (whoosh, swish, pop, click, impacto e riser), com o pico alinhado nos cortes ou marcadores. Tudo compila e passa nos testes (13 testes do motor). O visual foi validado em navegador: 4 painéis × 3 temas × 4 larguras, sem sobreposição.
>
> **Próximo passo imediato:** dar duplo clique em `1-compilar-e-instalar-dev.bat` e testar no Premiere e no AE.
> - Seletor de tema nos 3 painéis.
> - HyperCut: nova sequência com zoom de 115% alternado.
> - J-cut: áudio em A3/A4.
> - AE: camadas ✂ e ♪.
> - AutoSoundFX: inserir whoosh nos cortes da sequência HyperCut (vai para a A4, sem sobrescrever).
> - Legendas dinâmicas (novo painel): SRT/VTT → blocos de 1 a 6 palavras. Premiere: faixa de legendas. AE: camadas de texto com "pop" e destaque lime alternado. 15 testes do motor.
>
> **Gerar o .exe 0.2.0:** duplo clique em `3-gerar-instalador.bat` → `out\Orbi-Plugin-Tools-Setup-0.2.0.exe` (5 painéis). Antes de instalar, apague as junctions `com.orbi.*` de `%APPDATA%\Adobe\CEP\extensions` se tiver rodado o modo dev.
>
> Depois, gerar o instalador com `3-gerar-instalador.bat` (sai `out\Orbi-Plugin-Tools-Setup-0.2.0.exe`). Ele remove sozinho restos da v0.1.
>
> IDs agora são `com.orbi.*`, o motor é `orbi-engine.exe` e o programa instala em `C:\Program Files\Orbi Plugin Tools`.

---

## Histórico: v0.1 (FDCS Studio Tools), mantido como referência
## 1. Onde estamos

**Fase 1 concluída e validada no Windows 11 com Premiere Pro 2026 e After Effects 2026.**

- Escrevemos tudo do zero, sem copiar código de terceiros. A análise do instalador concorrente (Brainstorm 1.6.0, feito em Inno Setup) serviu só para entender a estrutura.
- Funciona **sem IA**. Fica para a fase 4 a IA plugável via MCP: Claude, ChatGPT e o sistema de IA da FDCS.
- O instalador `out\FDCS-Studio-Setup-0.1.0.exe` **foi executado e funcionou**: os painéis carregam da instalação oficial.
- Os atalhos de desenvolvimento em `%APPDATA%\Adobe\CEP\extensions` foram apagados (o modo dev está desligado).

### Plugins prontos

| Plugin | Premiere 2026 | After Effects 2026 |
|---|---|---|
| **Autocut** (remove silêncios) | ✔ nova sequência via XML (não destrutiva) · ✔ modo marcadores | ✔ divide camadas e fecha buracos, em sincronia · marcadores ainda não testados |
| **BeatMarker** | ainda não testado no app (o motor está ✔) | ✔ 128,3 BPM, 43 marcadores |
| **Margens** (Reels/Shorts/TikTok) | ✔ PNG na faixa mais alta, travada | ✔ camada-guia (não sai no render) |

---

## 2. Arquitetura (resumo)

```
Painel HTML/JS (CEP) ──► host .jsx (ExtendScript: Premiere / AE)
        │
        └──► fd-engine.exe (Rust, CLI JSON): áudio, silêncio, beats, XML FCP, LUT .cube, guias
fd-installer (Rust): .exe único com extensões + motor embutidos
```

- **CEP** nos dois apps hoje. O UXP do Premiere fica para a fase 2/3, e o UXP do AE ainda está em beta.
- **Lumetri está saindo** (Color Mode). A LUT Library vai usar um efeito nativo próprio (.aex/.prm em Rust).
- **Identidade visual DRAFT 2026** aplicada: Deep Navy `#0A0F1E`, Electric Cyan `#00F0FF`, Cool Gray `#8E9AAF`, Acid Green `#00FF41`, fonte Plus Jakarta Sans, bordas de 0,7 px, loader Δ e logo nos créditos.
- IDs: `com.fdcs.*`. Instala em `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\` + `C:\Program Files\FDCS Studio\`.

### Estrutura de pastas
```
crates/fd-engine        motor Rust (9 testes)
crates/fd-installer     instalador/desinstalador
extensions/shared       ponte CEP própria, cliente do motor, UI, CSS, fontes, logo, JSX comum
extensions/com.fdcs.autocut | beatmarker | margens
tools/build.mjs         gera manifests e dist/
tools/dev-install.ps1   modo desenvolvimento
docs/                   ARCHITECTURE, ROADMAP, IDENTIDADE-VISUAL
assets/brand/           logos (branco/escuro, transparentes)
test-media/             vídeo vertical com pausas + música de 128 BPM
.github/workflows/      build automático do .exe no GitHub
```

### Atalhos (duplo clique, cada um grava log em `logs\`)
| Script | Função |
|---|---|
| `0-diagnostico.bat` | Confere Rust, Node, VS, CEP e PlayerDebugMode |
| `1-compilar-e-instalar-dev.bat` | Compila e liga os painéis em modo dev (**não usar junto com o instalador**) |
| `2-teste-motor.bat` | Testa o motor com a mídia de teste |
| `3-gerar-instalador.bat` | Gera `out\FDCS-Studio-Setup-<versão>.exe` |
| `4-verificar-instalacao.bat` | Confere a instalação oficial (pastas, motor, registro) |

Ambiente do Daniel: Rust 1.99 (MSVC) · Visual Studio 2026 Community · Node 26 · Premiere/AE/AME 2026.

---

## 3. Pendências imediatas
- [ ] Rodar `4-verificar-instalacao.bat` e testar o **desinstalador** (Aplicativos instalados › FDCS Studio Tools).
- [ ] Testar o **BeatMarker no Premiere** (selecionar o clipe de música › Detectar e marcar).
- [ ] Testar o **modo marcadores do Autocut no AE**.
- [ ] Usar com material real e anotar ajustes (sensibilidade, margens, cortes estranhos).
- [ ] Apagar o `fdcs-studio-tools-src.tgz` que ficou na pasta (sobra da entrega).

### Limitações conhecidas
- Autocut no Premiere remonta só V1 + A1/A2. Para preservar efeitos e outras faixas, use "Só marcadores".
- No XML, o estéreo volta como A1 (L) + A2 (R).
- Extensões ainda **sem assinatura**: o instalador grava `PlayerDebugMode=1` e o Windows mostra o SmartScreen.

---

## 4. Próximos passos (roadmap)

**Fase 2 — Edição**
- Auto J/L-Cut · FastCut (respiros e pausas curtas) · HyperCut (jump cuts agressivos)
- AutoSoundFX (transientes + biblioteca de SFX licenciada)
- Adaptador UXP para o Premiere

**Fase 3 — Imagem e nativos**
- `fd-native`: efeito FDCS LUT (.aex/.prm) em Rust
- LUT Library (preview + aplicação; FDCS LUT → Color Mode → Lumetri como fallback)
- Legendas dinâmicas estilo CapCut/Resolve (palavra a palavra; AE com texto animado, Premiere com MOGRT)

**Fase 4 — IA plugável**
- `fd-mcp` (servidor MCP) + pacote `.mcpb` para Claude Desktop, conector para ChatGPT e outros
- Integração com o sistema de IA da FDCS (chat, imagem, áudio, vídeo, 3D)
- Transcrição offline opcional (whisper-rs)

**Distribuição**
- Certificado Authenticode (.exe) + assinatura das extensões (ZXPSignCmd) → `--no-debug-mode`
- Licenciamento/login próprio · build para macOS

### Ponto de atenção
"Final Draft" também é o nome de um software de roteiro conhecido. Vale checar o risco de marca com um advogado antes do lançamento comercial.

---

## 5. Como retomar
Diga ao Claude: **"Vamos continuar o Orbi Plugin Tools — leia o continue_plugin_premiere.md"**.
Ele tem acesso à pasta `D:\WWW\PluginAdobe`, aos documentos do projeto (arquitetura e roadmap) e, com sua permissão, ao Premiere e ao AE para testar.
