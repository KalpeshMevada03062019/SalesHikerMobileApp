# Shrinks screenshots to small JPEGs for the defect tracker (called by update-workbooks.js).
# Input: a JSON file [{ "src": "<path>", "dst": "<path>.jpg" }, ...]. Each image is scaled so its longer side is at
# most -MaxSide pixels and saved as JPEG (quality -Quality). Prints JSON { "<dst>": [width, height], ... }.
param([Parameter(Mandatory)][string]$ListFile, [int]$MaxSide = 1000, [long]$Quality = 72)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, $Quality)
$out = @{}
foreach ($item in (Get-Content $ListFile -Raw | ConvertFrom-Json)) {
    $img = [System.Drawing.Image]::FromFile((Resolve-Path $item.src).Path)
    try {
        $scale = [Math]::Min(1.0, $MaxSide / [Math]::Max($img.Width, $img.Height))
        $w = [int][Math]::Round($img.Width * $scale); $h = [int][Math]::Round($img.Height * $scale)
        $bmp = New-Object System.Drawing.Bitmap $w, $h
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.Clear([System.Drawing.Color]::White)
        $g.DrawImage($img, 0, 0, $w, $h)
        New-Item -ItemType Directory -Force (Split-Path $item.dst) | Out-Null
        $bmp.Save($item.dst, $codec, $params)
        $g.Dispose(); $bmp.Dispose()
        $out[$item.dst] = @($w, $h)
    } finally { $img.Dispose() }
}
$out | ConvertTo-Json -Compress
