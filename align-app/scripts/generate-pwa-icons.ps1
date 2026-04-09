# One-off: solid PNGs for PWA manifest (theme #0f1419)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-PwaIcon {
    param([int]$Size, [string]$OutPath)
    $color = [System.Drawing.Color]::FromArgb(255, 15, 20, 25)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear($color)
    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$base = [System.IO.Path]::Combine($PSScriptRoot, "..", "public", "icons")
$base = [System.IO.Path]::GetFullPath($base)
New-PwaIcon -Size 192 -OutPath (Join-Path $base "icon-192.png")
New-PwaIcon -Size 512 -OutPath (Join-Path $base "icon-512.png")
Write-Host "Wrote icon-192.png and icon-512.png in public/icons/"
