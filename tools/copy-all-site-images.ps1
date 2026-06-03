# Rebuild flat copies + manifest for optimization workflow.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$destRoot = "all-site-images"
if (Test-Path $destRoot) { Remove-Item $destRoot -Recurse -Force }
New-Item -ItemType Directory -Path $destRoot | Out-Null

$exts = @("*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.svg", "*.ico", "*.bmp", "*.avif")
$files = foreach ($e in $exts) { Get-ChildItem -Recurse -File -Filter $e -ErrorAction SilentlyContinue }
$files = $files | Where-Object {
  $rel = $_.FullName.Substring($Root.Length + 1)
  $rel -notmatch '^all-site-images\\'
} | Sort-Object FullName

$manifest = @()
foreach ($f in $files) {
  $rel = ($f.FullName.Substring($Root.Length + 1) -replace "\\", "/")
  $flat = ($rel -replace '[\\/:*?"<>|]', '__')
  Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $destRoot $flat) -Force
  $manifest += [PSCustomObject]@{
    sourcePath   = $rel
    copyFileName = $flat
    bytes        = $f.Length
    extension    = $f.Extension.ToLowerInvariant()
  }
}

$manifest | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $destRoot "manifest.json") -Encoding UTF8
$manifest | ConvertTo-Csv -NoTypeInformation | Set-Content (Join-Path $destRoot "manifest.csv") -Encoding UTF8
$total = ($files | Measure-Object -Property Length -Sum).Sum
Write-Host "Copied $($files.Count) files ($([math]::Round($total / 1MB, 2)) MB) -> $destRoot"
