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
| Premiere: CEP x UXP | UXP é o futuro, e o CEP está depreciado, mas ainda roda. A sonda (10/11/2026, Premiere 26.5.2, UXP 9.3) mostrou API suficiente para migrar (ver abaixo). | Hoje em CEP. Próximo passo: adaptador UXP do Premiere. |
| After Effects: UXP | Beta no AE 27. Em produção (AE 26.5), ainda é CEP. | CEP no AE. |
| Lumetri / LUT | No AE, o ExtendScript não aponta arquivo de LUT para nenhum efeito nativo (ver "LUT no After Effects"). | A LUT Library usa o **menu Look do Cor de Lumetri**. O efeito nativo próprio (`Orbi LUT`, .aex/.prm) virou opcional. |
| Assinatura | Sem assinatura, as extensões precisam de PlayerDebugMode=1. | Uso interno: o instalador grava PlayerDebugMode. Na distribuição: assinar extensões (ZXPSignCmd) e o .exe (Authenticode). |

## API UXP do Premiere (sonda de 10/11/2026)

Medido com `tools/probe-uxp-premiere` no Premiere 26.5.2 (módulo `premierepro`, 71 classes).

| Assunto | API | Uso no Orbi |
|---|---|---|
| Transcrição | `Transcript.transcribeClipProjectItem`, `exportToJSON`, `importFromJSON`, `createImportTextSegmentsAction`, `querySupportedLanguages`, `hasTranscript` | Transcrição nativa do Premiere, offline e sem terceiros: legenda sem SRT manual. |
| Legendas | `CaptionTrack` só lê (itens, nome, mudo); não cria legendas | Legenda nativa continua por SRT; a animação vai por `.mogrt`. |
| Gráficos | `SequenceEditor.insertMogrtFromPath`, `insertMogrtFromLibrary`, `getInstalledMogrtPath` | Legendas animadas no Premiere. |
| Cor / LUT | `ClipProjectItem.createSetInputLUTIDAction`, `getInputLUTID`, `getEmbeddedLUTID`; `VideoFilterFactory`, `Component.getParam` | LUT no Premiere (LUT de entrada do clipe ou Lumetri como efeito). A confirmar. |
| Edição | `SequenceEditor` (inserir, sobrescrever, remover, clonar), `TrackItem.createSet*Action`, `Markers`, `CompoundAction`, transições | Portar Autocut, BeatMarker, Margens e AutoSoundFX. |

Toda alteração é uma *Action* executada em lote (`CompoundAction`), o que dá um único desfazer.

**Como carregar um plugin UXP sem o UXP Developer Tool** (o UDT tem bug conhecido com o Premiere 26): copiar a pasta para
`%APPDATA%\Adobe\UXP\Plugins\External\<id>_<versão>` e registrar em `%APPDATA%\Adobe\UXP\PluginsInfo\v1\premierepro.json`
(é o que o Creative Cloud faz). `node tools/uxp-install.mjs install <pasta>` / `remove <id>` faz isso com o Premiere fechado
e guarda um backup `premierepro.json.orbi-backup`. O painel aparece em **Janela › Plug-ins UXP**. Os dados do plugin ficam em
`%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\26\External\<id>\PluginData`.

## LUT no After Effects (medido no AE 26.5)

- **Aplicar LUT de cor** (`ADBE Apply Color LUT2`) abre um seletor de arquivo ao ser aplicado; o caminho não é scriptável.
- **LUT Transform** (`ADBE LUT Transform`) não pode ser adicionado por script (`canAddProperty` = false).
- **Cor de Lumetri** (`ADBE Lumetri`): o menu **Look** (`ADBE Lumetri-0025`) é numérico. Ele tem 4 itens fixos
  ("Nenhum", "Procurar..." e separadores) seguidos de todas as LUTs das pastas
  `<AE>\Support Files\Lumetri\LUTs\Creative` e `%APPDATA%\Adobe\Common\LUTs\Creative`, em ordem alfabética (sem diferenciar maiúsculas).
- O menu é montado quando o AE abre: LUT copiada para a pasta do usuário só aparece depois de reiniciar o AE.
- Escolher a posição de "Procurar..." por script abre o seletor de arquivo. Por isso `host/aftereffects.jsx` confere se
  o total do menu bate com o calculado e recusa se não bater.
- Intensidade: `ADBE Lumetri-0026`. Os campos `LUTAsset`/`LookAsset` são internos (não aceitam valor por script).

## Camadas

```
┌──────────────────────────────── Painel (HTML/CSS/JS) ───────────────────────────────┐
│  UI compartilhada (orbi-ui.css)  ·  lógica pura (cut-plan, mapeamento de tempo)      │
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
| Auto J/L-Cut · FastCut · HyperCut | (dentro do Autocut) | ✔ | ✔ | `autocut` |
| BeatMarker | com.orbi.beatmarker | ✔ marcadores na sequência | ✔ marcadores na camada/comp | `beats` |
| Margens (safe areas) | com.orbi.margens | ✔ overlay PNG gerado | ✔ camada guia | `guides` |
| AutoSoundFX | com.orbi.soundfx | ✔ | ✔ | `sfx-pack` |
| LUT Library | com.orbi.luts | lista e valida (aplicar depende do UXP) | ✔ Lumetri Look, LUTs da Adobe e próprias | `luts` (valida .cube) |
| Legendas dinâmicas | com.orbi.captions | ✔ faixa de legendas por SRT (animação: .mogrt via UXP) | ✔ texto animado, estilos, camada com o texto como nome | `captions` (SRT→blocos) |
| EditLink (IA) | com.orbi.editlink | fase 4 | fase 4 | `orbi-mcp` |

## Legendas sem IA

A transcrição precisa de reconhecimento de fala. Para o v1 continuar sem IA externa, a legenda parte de fontes que você já tem:
1. a transcrição nativa do Premiere (hoje: Speech to Text → exporta SRT; com UXP: `Transcript.transcribeClipProjectItem` direto pelo painel);
2. um SRT/VTT existente;
3. (opcional, offline) Whisper local via `whisper-rs` no motor. Roda na máquina, sem nuvem e sem provedor.

O que é nosso de verdade é o **estilo dinâmico** (palavra por palavra, destaque, pop, karaokê): o motor divide o texto em palavras com tempo, e o host gera as camadas de texto animadas (AE) ou os MOGRTs (Premiere).
