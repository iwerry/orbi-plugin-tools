# Gera os .mogrt do catálogo pelo After Effects e troca as miniaturas.
#   powershell -ExecutionPolicy Bypass -File tools\mogrt\build.ps1 [-Only "Caption Pop"]
# Requisitos: After Effects aberto com o painel "Orbi · Ponte Dev" (node tools/ae-eval.mjs --install).
# Orbi Plugin Tools · Draft Creative Studio Ltda
param([string]$Only = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$thumbs = Join-Path $env:TEMP 'orbi-mogrt-thumbs'
if (Test-Path $thumbs) { Remove-Item -Recurse -Force $thumbs }

$jsx = Join-Path $env:TEMP 'orbi-mogrt-build.jsx'
# Sempre define ORBI_ONLY: variáveis globais sobrevivem entre execuções no ExtendScript do AE.
$head = "var ORBI_ONLY = '" + $Only.Replace("'", "\'") + "';`n"
$head + (Get-Content (Join-Path $PSScriptRoot 'build.jsx') -Raw -Encoding UTF8) | Set-Content $jsx -Encoding utf8
node (Join-Path $root 'tools\ae-eval.mjs') $jsx

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

# Libera no Premiere: fonte personalizada, tamanho da fonte e estilos falsos em todo campo de texto
# (o AE não expõe essas opções por script; ficam em definition.json › fonteditinfo).
$f = 0
Get-ChildItem (Join-Path $root 'assets\mogrt') -Recurse -Filter *.mogrt | ForEach-Object {
  $zip = [IO.Compression.ZipFile]::Open($_.FullName, 'Update')
  try {
    $e = $zip.GetEntry('definition.json')
    $r = New-Object IO.StreamReader($e.Open()); $j = $r.ReadToEnd(); $r.Close()
    $new = $j -replace '"capPropFontEdit":false', '"capPropFontEdit":true' -replace '"capPropFontSizeEdit":false', '"capPropFontSizeEdit":true' -replace '"capPropFontFauxStyleEdit":false', '"capPropFontFauxStyleEdit":true'
    if ($new -ne $j) {
      $e.Delete()
      $w = New-Object IO.StreamWriter(($zip.CreateEntry('definition.json')).Open(), (New-Object Text.UTF8Encoding $false)); $w.Write($new); $w.Close()
      $f++
    }
  } finally { $zip.Dispose() }
}
"fonte/tamanho/estilos liberados em: $f"

# Troca thumb.png dentro de cada .mogrt pela miniatura do meio da animação.
$n = 0
Get-ChildItem $thumbs -Recurse -Filter *.png -ErrorAction SilentlyContinue | ForEach-Object {
  # Caminho relativo (categorias podem ter subpastas: Titles\Cinematic)
  $rel = $_.FullName.Substring($thumbs.Length + 1)
  $mogrt = Join-Path $root ('assets\mogrt\' + [IO.Path]::ChangeExtension($rel, '.mogrt'))
  if (-not (Test-Path -LiteralPath $mogrt)) { return }
  $zip = [IO.Compression.ZipFile]::Open($mogrt, 'Update')
  try {
    $old = $zip.GetEntry('thumb.png'); if ($old) { $old.Delete() }
    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, 'thumb.png')
    $n++
  } finally { $zip.Dispose() }
}
"miniaturas trocadas: $n"
