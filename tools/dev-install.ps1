# Orbi Plugin Tools — instalação de DESENVOLVIMENTO (sem admin).
# Liga as extensões de dist/ na pasta CEP do usuário via junction, então
# basta recarregar o painel depois de cada `node tools/build.mjs --dev`.
#   powershell -ExecutionPolicy Bypass -File tools\dev-install.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '» Compilando o motor (Rust)…'
cargo build -p orbi-engine --release
Write-Host '» Montando extensões (modo dev)…'
node tools/build.mjs --dev

foreach ($v in 9..14) {
  New-Item -Path "HKCU:\Software\Adobe\CSXS.$v" -Force | Out-Null
  Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.$v" -Name PlayerDebugMode -Value '1'
}
Write-Host '✓ PlayerDebugMode=1 (CSXS.9–14)'

$cep = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
New-Item -ItemType Directory -Force $cep | Out-Null
Get-ChildItem (Join-Path $root 'dist\extensions') -Directory | ForEach-Object {
  $link = Join-Path $cep $_.Name
  if (Test-Path $link) { cmd /c rmdir "$link" | Out-Null }
  cmd /c mklink /J "$link" "$($_.FullName)" | Out-Null
  Write-Host "✓ $($_.Name) → $link"
}
Write-Host ''
Write-Host 'Pronto. Reinicie o Premiere/After Effects: Janela › Extensões (legado) › Orbi · …'
Write-Host 'DevTools: abra no Chrome http://localhost:8800 (Autocut), 8810 (BeatMarker), 8820 (Margens), 8830 (AutoSoundFX).'
