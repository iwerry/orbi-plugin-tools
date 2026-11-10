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
- [ ] Adaptador UXP para Premiere (mesma lógica, novo HostBridge)

## Fase 3 — Imagem e nativos
- [ ] `orbi-native`: efeito Orbi LUT (.aex/.prm) em Rust
- [ ] LUT Library: navegador, preview e aplicação (Orbi LUT → Color Mode → Lumetri como fallback)
- [ ] Legendas dinâmicas: estilos palavra a palavra (AE: camadas de texto animadas; Premiere: MOGRT)

## Fase 4 — IA plugável
- [ ] `orbi-mcp`: servidor MCP que expõe as operações do motor e do host
- [ ] Pacote `.mcpb` para Claude Desktop; conector para ChatGPT e outros clientes MCP
- [ ] Provedor Orbi AI (chat, imagem, áudio, vídeo, 3D)
- [ ] Transcrição offline opcional (whisper-rs)

## Distribuição
- [ ] Certificado de assinatura de código (Authenticode) para o .exe
- [ ] Assinatura das extensões (ZXPSignCmd), dispensando o PlayerDebugMode
- [ ] Licenciamento/login (módulo `auth` próprio, opcional)
- [ ] Build para macOS (.pkg) — o motor já é multiplataforma
