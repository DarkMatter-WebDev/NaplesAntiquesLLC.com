param(
  [Parameter(Mandatory = $true)]
  [ValidateSet(1, 2, 3)]
  [int]$Group,
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$folder = switch ($Group) {
  1 { "optimized-output/group1-branding" }
  2 { "optimized-output/group2-pages" }
  3 { "optimized-output/group3-shop" }
}

$srcDir = Join-Path $Root $folder
if (-not (Test-Path $srcDir)) {
  throw "Missing folder: $folder — run XnConvert and save outputs there first."
}

$files = Get-ChildItem -LiteralPath $srcDir -File
if ($files.Count -eq 0) { throw "No files in $folder" }

$backupRoot = Join-Path $Root "optimized-output/backups/group$Group"
$deployed = 0

foreach ($f in $files) {
  $name = $f.Name
  # group3: assets__images__shop__foo.png -> assets/images/shop/foo.png
  # group2: gold.webp -> assets/images/pages/gold.webp (flat name = basename only)
  $target = $null
  if ($name -match '^assets__images__') {
    $target = ($name -replace '^assets__images__', 'assets/images/' -replace '__', '/')
  } elseif ($Group -eq 3) {
    $target = "assets/images/shop/$name"
  } elseif ($Group -eq 2) {
    $target = "assets/images/pages/$name"
  } elseif ($Group -eq 1) {
    $target = "assets/images/branding/$name"
  } else {
    Write-Warning "Skip (unknown naming): $name"
    continue
  }

  $dest = Join-Path $Root ($target -replace '/', '\')
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) {
    Write-Warning "Skip (no target dir): $target"
    continue
  }

  $backup = Join-Path $backupRoot $target
  $backupDir = Split-Path $backup -Parent
  if (-not $WhatIf) {
    if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }
    if (Test-Path $dest) { Copy-Item -LiteralPath $dest -Destination $backup -Force }
    Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
  }
  Write-Host "$(if ($WhatIf) { '[WhatIf] ' })${name} -> $target"
  $deployed++
}

Write-Host "Done. $deployed file(s)$(if ($WhatIf) { ' (dry run)' }). Backups: optimized-output/backups/group$Group"
