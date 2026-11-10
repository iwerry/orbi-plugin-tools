# Continuar — Orbi Plugin Tools (Plugins Premiere + After Effects)

**Draft Creative Studio Ltda · Creative Design & Software Development · Daniel Rodrigues**
Atualizado: 10/11/2026 (noite) · Projeto: `D:\WWW\PluginAdobe` · Versão instalada e no GitHub: **0.3.3**
Uso atual: somente equipe interna da Draft. Futuramente o Orbi será por assinatura.

---

## 1. Onde estamos

- **0.3.3 instalada no Windows** (por cima da 0.2 → 0.3.0 → 0.3.1 → 0.3.2; o instalador remove a anterior sozinho).
- **Validado no After Effects 2026 (26.5):**
  - Legendas: estilos (Clássico, Neon, Cinema) e animações (Pop, Bounce, Subir, Fade, Nenhuma).
  - Cada camada de legenda tem o próprio texto como nome, em qualquer idioma.
  - LUT Library: aplica LUT pelo Cor de Lumetri (Look) em camadas selecionadas ou numa camada de ajuste, com intensidade.
    Aba "Adobe" com as LUTs do AE/Premiere/Photoshop, "Adicionar LUTs…" e busca.
- **Sonda UXP do Premiere rodou** (Premiere 26.5.2, UXP 9.3). Resultado completo em `docs/ARCHITECTURE.md` › "API UXP do Premiere".
  Resumo: existe transcrição nativa (`Transcript`), inserção de `.mogrt` (`SequenceEditor.insertMogrtFromPath`),
  LUT de entrada do clipe (`createSetInputLUTIDAction`) e efeitos (`VideoFilterFactory`). **Vale migrar o Premiere para UXP.**
- **Git:** repositório `https://github.com/iwerry/orbi-plugin-tools` (branch `main`). **Ainda público.**

---

## 2. Decisões tomadas
- **Sem API de terceiros.** Só o que Premiere e After Effects expõem (ExtendScript/CEP hoje, UXP no Premiere).
- **LUT no AE pelo Lumetri (menu Look).** O efeito nativo próprio (.aex/.prm) ficou opcional.
- **Transcrição:** no Premiere, usar a nativa via UXP. Whisper só se precisar no After Effects.
- **Instaladores `.exe` ficam só em `out\`** (nunca apagar versões antigas, nunca enviar ao GitHub).
- **Licença proprietária** (`LICENSE`), no lugar da GPL criada com o repositório.
- **Assinatura de código e licenciamento:** adiados até haver distribuição externa.

---

## 3. Próximos passos (ordem sugerida)
1. **Sonda com projeto aberto** (opcional): abrir uma sequência com clipe em V1 e clicar em "Verificar API" no painel
   *Janela › Plug-ins UXP › Orbi Sonda UXP*. Lista os métodos de `Sequence` e os efeitos do clipe.
   O resultado fica em `%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\26\External\com.orbi.probe.captions\PluginData\orbi-sonda.txt`.
2. **Adaptador UXP do Premiere:** começar por um painel (ex.: Legendas com transcrição nativa + `.mogrt`), mantendo o CEP do AE.
3. **LUT no Premiere** via UXP.
4. **Deixar o repositório privado** no GitHub.
5. **Remover a sonda UXP** quando não for mais útil (Premiere fechado): `node tools/uxp-install.mjs remove com.orbi.probe.captions`,
   ou restaurar `%APPDATA%\Adobe\UXP\PluginsInfo\v1\premierepro.json.orbi-backup` e apagar
   `%APPDATA%\Adobe\UXP\Plugins\External\com.orbi.probe.captions_0.0.1`.

---

## 4. Como trabalhar (Claude Code)
- `cargo test -p orbi-engine` (16 testes) e `3-gerar-instalador.bat` → `out\Orbi-Plugin-Tools-Setup-<versão>.exe`.
  No terminal do agente, rodar com `__COMPAT_LAYER=RunAsInvoker` (o .exe pede administrador; isso só afeta o passo `--list`).
- Instalar: Premiere/AE fechados; `Start-Process -Verb RunAs` com `--silent` e saída num log em `logs\`.
- Teste isolado do instalador: `--root <pasta>` (sem registro nem processos).
- Subir versão: `VERSION`, `Cargo.toml`, `orbi.json` de cada extensão e `extensions/shared/js/orbi-bridge.js`.
- **Testar ExtendScript no AE sem o usuário digitar:** um painel CEP mínimo com `.debug` (porta própria), ligado por junction
  em `%APPDATA%\Adobe\CEP\extensions`, e um script Node que manda `Runtime.evaluate` → `__adobe_cep__.evalScript` pelo DevTools.
- **Plugin UXP sem UXP Developer Tool:** ver `docs/ARCHITECTURE.md` › "Como carregar um plugin UXP".
- Não commitar sem pedido explícito.

---

## 5. Limitações conhecidas
- Autocut no Premiere remonta só V1 + A1/A2. Para preservar efeitos e outras faixas, use "Só marcadores".
- No XML, o estéreo volta como A1 (L) + A2 (R).
- Extensões sem assinatura: o instalador grava `PlayerDebugMode=1` e o Windows mostra o SmartScreen.
- Legendas no Premiere entram por SRT (sem animação) até a migração para UXP.
- LUT nova no AE só aparece no Lumetri depois de reiniciar o AE uma vez.
- LUT no Premiere: por enquanto só lista e valida.

---

## 6. Histórico
- **0.3.3 (10/11/2026):** LUTs da Adobe, "Adicionar LUTs…", busca.
- **0.3.2 (10/11/2026):** aplicar LUT no AE pelo Lumetri.
- **0.3.1 (10/11/2026):** camadas de legenda com o texto como nome; texto em qualquer idioma na ponte CEP.
- **0.3.0 (10/11/2026):** instalador remove a versão anterior; estilos e animações de legenda no AE; base da LUT Library; sonda UXP.
- **0.2.0 (06/11/2026):** FDCS Studio Tools vira Orbi Plugin Tools; Orbi Design System; FastCut, HyperCut, J/L-cut, AutoSoundFX, legendas.
- **0.1.0 (FDCS Studio Tools):** Autocut, BeatMarker e Margens.

### Ponto de atenção
"Final Draft" também é o nome de um software de roteiro conhecido. Vale checar o risco de marca com um advogado antes do lançamento comercial.
