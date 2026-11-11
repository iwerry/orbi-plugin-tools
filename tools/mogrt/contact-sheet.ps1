# Folha de contato com as miniaturas dos .mogrt de uma categoria (para revisar rápido).
#   powershell -File tools\mogrt\contact-sheet.ps1 -Category "Titles\Cinematic" -Out sheet.png
param([Parameter(Mandatory)] [string]$Category, [Parameter(Mandatory)] [string]$Out, [int]$Cols = 3)
Add-Type -AssemblyName System.Drawing, System.IO.Compression.FileSystem
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$files = Get-ChildItem (Join-Path $root "assets\mogrt\$Category") -Filter *.mogrt | Sort-Object Name
$w = 640; $h = 360; $lab = 28
$rows = [math]::Ceiling($files.Count / $Cols)
$bmp = New-Object Drawing.Bitmap ($w * $Cols), (($h + $lab) * $rows)
$g = [Drawing.Graphics]::FromImage($bmp)
$g.Clear([Drawing.Color]::FromArgb(20, 20, 22))
$font = New-Object Drawing.Font 'Segoe UI', 13
$i = 0
foreach ($f in $files) {
  $z = [IO.Compression.ZipFile]::OpenRead($f.FullName)
  $s = ($z.Entries | Where-Object FullName -eq 'thumb.png').Open()
  $img = [Drawing.Image]::FromStream($s)
  $x = ($i % $Cols) * $w; $y = [math]::Floor($i / $Cols) * ($h + $lab)
  $g.DrawImage($img, $x, $y, $w, $h)
  $g.DrawString($f.BaseName, $font, [Drawing.Brushes]::White, $x + 8, $y + $h + 3)
  $img.Dispose(); $s.Dispose(); $z.Dispose(); $i++
}
$bmp.Save($Out, [Drawing.Imaging.ImageFormat]::Png)
"folha: $Out ($($files.Count) presets)"
