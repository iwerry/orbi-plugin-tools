# Roadmap — Orbi Plugin Tools

## Fase 1 — Fundação (esta entrega)
- [x] Monorepo + arquitetura
- [x] `orbi-engine`: decodificação de áudio (WAV/MP3/AAC/MP4/MOV via symphonia), detecção de silêncio, detecção de beats, plano de autocut, XML FCP (xmeml), parser de LUT .cube
- [x] Extensão **Autocut** (Premiere + AE)
- [x] Extensão **BeatMarker** (Premiere + AE)
- [x] Extensão **Margens** (Premiere + AE) com guias PNG geradas pelo motor
- [x] `orbi-installer` (.exe único) + build + GitHub Actions para Windows

## v0.2 — Orbi
- [x] Rebrand para **Orbi Plugin Tools** (`com.orbi.*`, `orbi-engine`, `Orbi-Plugin-Tools-Setup.exe`), com migração automática da v0.1
- [x] Orbi Design System com 3 temas (Escuro, Claro, Terminal), sincronizados entre os painéis
- [x] Assinatura: Draft Creative Studio Ltda · Creative Design & Software Development · Daniel Rodrigues

## Fase 2 — Edição
- [x] FastCut (tira respiros e pausas curtas) e HyperCut (jump cuts + zoom de corte alternado), como ritmos do Autocut
- [x] J-cut / L-cut (áudio alternando entre A1/A2 e A3/A4 no Premiere; camadas de áudio separadas no AE)
- [x] AutoSoundFX: sons sintetizados pelo próprio motor (whoosh, swish, pop, click, impacto e riser, 3 variações cada), com o pico alinhado nos cortes ou marcadores. Premiere: não sobrescreve áudio existente. AE: camadas de áudio.
- [ ] Adaptador UXP para Premiere (mesma lógica, novo HostBridge). **Sonda feita em 10/11/2026: vale migrar** (ver ARCHITECTURE.md › API UXP do Premiere)

## v0.3 — Legendas e LUTs (uso interno)
- [x] Instalador remove a versão anterior antes de instalar (0.2 → 0.3.x validado no Windows)
- [x] Legendas no After Effects: estilos (Clássico, Neon, Cinema) e animações (Pop, Bounce, Subir, Fade, Nenhuma), validado no AE 2026
- [x] Camadas de legenda no AE com o próprio texto como nome, em qualquer idioma (0.3.1)
- [x] Ponte CEP envia texto não-ASCII como `\uXXXX` (acentos, CJK, árabe, emojis chegam intactos)
- [x] LUT Library no AE: aplicar LUT pelo Cor de Lumetri (Look), em camadas selecionadas ou camada de ajuste, com intensidade (0.3.2)
- [x] LUTs da Adobe (AE/Premiere: Criativas, Clássicas, Técnicas; Photoshop: looks), "Adicionar LUTs…" e busca (0.3.3)
- [ ] LUT no Premiere (UXP: `createSetInputLUTIDAction` ou Lumetri via `VideoFilterFactory`)

## Fase 3 — Imagem e nativos
- [ ] `orbi-native`: efeito Orbi LUT (.aex/.prm) em Rust. **Opcional agora**: só se o Lumetri não bastar (ex.: aplicar LUT nova sem reiniciar o AE, preview próprio)
- [ ] Preview de LUT no painel (miniatura gerada pelo motor)
- [ ] Legendas dinâmicas no Premiere: `.mogrt` via `SequenceEditor.insertMogrtFromPath` (depende da migração UXP)
- [ ] Transcrição nativa do Premiere via UXP (`Transcript.transcribeClipProjectItem` + `exportToJSON`), sem SRT manual

## Fase 4 — IA plugável
- [ ] `orbi-mcp`: servidor MCP que expõe as operações do motor e do host
- [ ] Pacote `.mcpb` para Claude Desktop; conector para ChatGPT e outros clientes MCP
- [ ] Provedor Orbi AI (chat, imagem, áudio, vídeo, 3D)
- [ ] Transcrição offline opcional (whisper-rs) para o After Effects. No Premiere, a transcrição nativa via UXP pode dispensar o Whisper

## Distribuição
- [ ] Repositório GitHub privado (iwerry/orbi-plugin-tools ainda está público)
- [ ] Certificado de assinatura de código (Authenticode) para o .exe
- [ ] Assinatura das extensões (ZXPSignCmd), dispensando o PlayerDebugMode
- [ ] Licenciamento/login (módulo `auth` próprio, opcional)
- [ ] Build para macOS (.pkg) — o motor já é multiplataforma
