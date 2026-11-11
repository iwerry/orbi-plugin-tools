# Presets .mogrt (Captions, Titles, Lower Thirds, Social Media, Counters)

Os `.mogrt` são gerados no **After Effects** por script e versionados em `assets/mogrt/<Categoria>/<Nome>.mogrt`.
O instalador copia tudo para `%APPDATA%\Adobe\Common\Motion Graphics Templates\Orbi`, que aparece no Premiere em
**Gráficos › Modelos locais › Orbi**, com uma pasta por categoria.

## Gerar

1. Uma vez: `node tools/ae-eval.mjs --install` (liga o painel **Orbi · Ponte Dev** na pasta CEP do usuário).
2. Abra o After Effects e **Janela › Extensões › Orbi · Ponte Dev**.
3. Gere:
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\mogrt\build.ps1                     # tudo
   powershell -ExecutionPolicy Bypass -File tools\mogrt\build.ps1 -Only "Counters"    # uma categoria ou um preset
   ```
   O script trabalha num projeto temporário (`%TEMP%\orbi-mogrt-build.aep`), não mexe no projeto aberto e não pede para salvar.
4. Revise as miniaturas: `tools\mogrt\contact-sheet.ps1 -Category "Titles\Cinematic" -Out folha.png`.
5. `3-gerar-instalador.bat` embute os presets no instalador.

O `build.ps1` também:
- troca a miniatura (`thumb.png`) por um quadro do meio da animação (o AE fotografa o quadro 0);
- libera no Premiere a troca de fonte, tamanho e estilos em todo campo de texto (`definition.json › fonteditinfo`).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `lib.jsx` | Biblioteca `M`: texto, animadores, formas que seguem o texto, controles, exportação |
| `pack-captions.jsx` | Captions/Basic e Captions/Dynamic |
| `pack-titles-cinematic.jsx` | Titles/Cinematic |
| `pack-titles-essential.jsx` | Titles/Essential, Titles/Scale e Lower Thirds |
| `pack-social-counters.jsx` | Social Media e Counters |
| `build.jsx` / `build.ps1` | Gera tudo e finaliza os arquivos |

## Regras do catálogo

- Nomes simples em inglês, sem "Orbi" no nome. Qualidade antes de quantidade: cada preset com animação própria.
- Controles em inglês (Text, Text Color, Accent Color, Position, Scale…). Animações por expressão sobre `value`,
  então Position/Scale continuam editáveis no Premiere.
- Regiões protegidas no início e no fim: a animação não estica quando o clipe muda de duração (exceto Credits Roll e Countdown, que acompanham a duração).
- Números editáveis vão como **texto** (camada oculta), porque os sliders do .mogrt no Premiere vão de 0 a 100.
- Fontes: Montserrat, Inter, Anton, Bebas Neue, Georgia, Arial (precisam existir na máquina; Adobe Fonts sincroniza).

## Armadilhas do ExtendScript (AE 26.5)

- Adicionar um efeito ou propriedade invalida as referências anteriores do mesmo grupo: busque de novo (`M.resolve`).
- `exportAsMotionGraphicsTemplate` recebe uma **pasta**, invalida a comp e, com projeto salvo e alterado, pergunta para salvar.
- `TextDocument.allCaps` é somente leitura: use `fontCapsOption`.
- Variáveis globais sobrevivem entre execuções no motor do AE (por isso o `build.ps1` sempre define `ORBI_ONLY`).
