# Orbi Plugin Tools — Arquitetura

**Empresa:** Draft Creative Studio Ltda (Creative Design & Software Development) · **Desenvolvedor:** Daniel Rodrigues
**Prefixo de IDs:** `com.orbi.*` · **Produto:** Orbi Plugin Tools (mesmo design system do app Orbi)

## Princípios

1. **Funciona sem IA.** Todo plugin resolve a tarefa sozinho, com algoritmos locais (DSP no motor Rust).
2. **IA plugável depois.** A camada de IA é um *adaptador* opcional (MCP / HTTP) que qualquer provedor pode ocupar:
   ChatGPT, Claude, o sistema próprio da Orbi ou outros. Nenhum plugin importa um provedor diretamente.
3. **Um núcleo, vários hosts.** A lógica fica num lugar só; Premiere e After Effects são adaptadores finos.
4. **À prova de mudança da Adobe.** CEP hoje, UXP amanhã, sem reescrever a lógica.

## Estado da plataforma Adobe (nov/2026)

| Tema | Situação | Decisão |
|---|---|---|
| Premiere: CEP x UXP | UXP é o futuro, e o CEP está depreciado, mas ainda roda. | Começamos em CEP (Premiere e AE com o mesmo código). O adaptador UXP do Premiere fica para a fase 2. |
| After Effects: UXP | Beta privado/público no AE 27 beta. Em produção, ainda é CEP. | CEP no AE. |
| Lumetri | O Color Mode substitui o painel Lumetri. O efeito Lumetri continua só por compatibilidade, e a Adobe recomenda não misturar os dois. | A LUT Library **não depende do Lumetri**: aplica a LUT com um efeito nativo próprio (`Orbi LUT`, .aex/.prm em Rust), que funciona no Premiere e no AE com qualquer sistema de cor. O Lumetri fica como fallback. |
| Assinatura | O instalador concorrente usa PlayerDebugMode=1 porque não assina. | Vamos **assinar os ZXP/extensões** (certificado próprio via ZXPSignCmd) e o .exe (Authenticode). O PlayerDebugMode fica só no modo `--dev`. |

## Camadas

```
┌──────────────────────────────── Painel (HTML/CSS/JS) ───────────────────────────────┐
│  UI compartilhada (fdcs-ui.css)  ·  lógica pura (cut-plan, mapeamento de tempo)      │
│                           │                                  │                       │
│                  HostBridge (CEP hoje / UXP depois)     EngineClient (Node child)    │
└───────────────────────────┼──────────────────────────────────┼───────────────────────┘
                            ▼                                  ▼
        host/premiere.jsx · host/aftereffects.jsx      orbi-engine.exe (Rust)
        (ExtendScript: lê timeline, aplica cortes,      decodifica áudio/vídeo, silêncio,
         marcadores, importa XML)                       beats, transientes, LUT, XML FCP,
                                                        legendas (SRT/ASS), …
                                                               │
                                                     (fase 4) orbi-mcp: servidor MCP
                                                     que expõe as mesmas operações
                                                     para Claude / ChatGPT / Orbi AI
```

- **orbi-engine** (Rust, CLI com saída JSON): toda a matemática pesada e testável. Os painéis chamam o motor via `child_process` (CEP com `--enable-nodejs`).
- **Hosts .jsx**: só falam com o app (ler clipes, cortar, marcar). Não tem algoritmo lá dentro.
- **orbi-installer** (Rust): um único .exe com as extensões e o motor embutidos. Fecha Premiere/AE, instala, registra o desinstalador e se atualiza.
- **orbi-native** (fase 3, Rust via crates `after-effects`/`premiere`): efeitos nativos `.aex`/`.prm`, como o Orbi LUT e o renderizador de legendas animadas.

## Mapa dos plugins

| Plugin | ID | Premiere | AE | Motor |
|---|---|---|---|---|
| Autocut (silêncio) | com.orbi.autocut | ✔ nova sequência via XML + modo marcadores | ✔ divide camadas | `silence`, `autocut` |
| Auto J/L-Cut · FastCut · HyperCut | com.orbi.jcut | ✔ | ✔ | `jcut`, `pace` |
| BeatMarker | com.orbi.beatmarker | ✔ marcadores na sequência | ✔ marcadores na camada/comp | `beats` |
| Margens (safe areas) | com.orbi.margens | ✔ overlay PNG gerado | ✔ camada guia | `guides` |
| AutoSoundFX | com.orbi.soundfx | ✔ | ✔ | `transients`, biblioteca SFX |
| LUT Library | com.orbi.lutlibrary | ✔ efeito Orbi LUT (Lumetri como fallback) | ✔ | `lut` (parse/preview) |
| Legendas dinâmicas | com.orbi.captions | ✔ MOGRT/captions | ✔ texto animado | `captions` (SRT→palavras, estilos) |
| EditLink (IA) | com.orbi.editlink | fase 4 | fase 4 | `orbi-mcp` |

## Legendas sem IA

A transcrição precisa de reconhecimento de fala. Para o v1 continuar sem IA externa, a legenda parte de fontes que você já tem:
1. a transcrição nativa do Premiere (Speech to Text → exporta SRT);
2. um SRT/VTT existente;
3. (opcional, offline) Whisper local via `whisper-rs` no motor. Roda na máquina, sem nuvem e sem provedor.

O que é nosso de verdade é o **estilo dinâmico** (palavra por palavra, destaque, pop, karaokê): o motor divide o texto em palavras com tempo, e o host gera as camadas de texto animadas (AE) ou os MOGRTs (Premiere).
