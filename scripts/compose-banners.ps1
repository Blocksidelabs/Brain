# ============================================================================
# BLOCKSIDE banner compositor (Part A: setup, palette, drawing helpers)
# Renders the 10 final 1920x1080 PNG banners from the raw in-engine captures.
# Run with:  powershell -STA -File scripts\compose-banners.ps1 [-Quality medium]
# ============================================================================
param([string]$Quality = 'low')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName PresentationFramework

$root = Split-Path -Parent $PSScriptRoot
$capt = Join-Path (Join-Path $root 'banner-captures') $Quality
$out  = Join-Path $root 'Banners'
New-Item -ItemType Directory -Force -Path $out | Out-Null

# ---- official BLOCKSIDE palette -------------------------------------------
$script:DeepPurple = [System.Windows.Media.Color]::FromArgb(255, 0x10, 0x08, 0x20)
$script:DarkViolet = [System.Windows.Media.Color]::FromArgb(255, 0x1B, 0x0B, 0x2D)
$script:NeonPink   = [System.Windows.Media.Color]::FromArgb(255, 0xFF, 0x4C, 0xCF)
$script:Magenta    = [System.Windows.Media.Color]::FromArgb(255, 0xD9, 0x2B, 0x91)
$script:Sunset     = [System.Windows.Media.Color]::FromArgb(255, 0xFF, 0x71, 0x3D)
$script:Cyan       = [System.Windows.Media.Color]::FromArgb(255, 0x48, 0xDF, 0xFF)
$script:White      = [System.Windows.Media.Color]::FromArgb(255, 0xFF, 0xFF, 0xFF)
$script:PinkLight  = [System.Windows.Media.Color]::FromArgb(255, 0xFF, 0xB3, 0xE6)

function New-Solid([System.Windows.Media.Color]$c, [double]$alpha = 1.0) {
    return New-Object System.Windows.Media.SolidColorBrush(($c)) -Property @{ Opacity = $alpha }
}
function New-VGrad([System.Windows.Media.Color]$top, [System.Windows.Media.Color]$bottom) {
    $g = New-Object System.Windows.Media.LinearGradientBrush
    $g.StartPoint = [System.Windows.Point]::new(0, 0)
    $g.EndPoint   = [System.Windows.Point]::new(0, 1)
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($top, 0))) | Out-Null
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($bottom, 1))) | Out-Null
    return $g
}

function Load-Image([string]$path) {
    $img = New-Object System.Windows.Media.Imaging.BitmapImage
    $img.BeginInit()
    $img.UriSource = New-Object System.Uri($path)
    $img.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $img.EndInit()
    $img.Freeze()
    return $img
}
$script:LogoImg = Load-Image (Join-Path $root 'Logo\Blockside Logo.png')

# Typeface used everywhere (matches the bold menu typography)
$script:Face = New-Object System.Windows.Media.Typeface('Arial Black')

function Measure-Text([string]$text, [double]$size, [double]$tracking) {
    $ft = New-Object System.Windows.Media.FormattedText(
        $text, [System.Globalization.CultureInfo]::CurrentCulture,
        [System.Windows.FlowDirection]::LeftToRight, $script:Face, $size, 
        (New-Solid $script:White), 1.0)
    return ($ft.Width + $tracking * [Math]::Max(0, $text.Length - 1))
}

/** Draws spaced, glowing ALL-CAPS text. haloColor draws the neon glow. */
function Draw-GlowText([System.Windows.Media.DrawingContext]$dc, [string]$text,
    [double]$x, [double]$y, [double]$size, [double]$tracking,
    [System.Windows.Media.Brush]$fill, [System.Windows.Media.Color]$haloColor,
    [double]$haloWidth, [System.Windows.Media.Brush]$haloBrush) {

    $pen = if ($haloWidth -gt 0) { New-Object System.Windows.Media.Pen($haloBrush, $haloWidth) } else { $null }
    $cursor = $x
    foreach ($ch in $text.ToCharArray()) {
        if ($ch -ne ' ') {
            $ft = New-Object System.Windows.Media.FormattedText(
                [string]$ch, [System.Globalization.CultureInfo]::CurrentCulture,
                [System.Windows.FlowDirection]::LeftToRight, $script:Face, $size,
                (New-Solid $script:White), 1.0)
            $geo = $ft.BuildGeometry([System.Windows.Point]::new(0, 0))
            $dc.PushTransform(New-Object System.Windows.Media.TranslateTransform($cursor, $y))
            if ($pen) { $dc.DrawGeometry($null, $pen, $geo) }
            $dc.DrawGeometry($fill, $null, $geo)
            $dc.Pop()
        }
            $cursor += $ft.Width + $tracking
        } else {
            $cursor += $size * 0.34 + $tracking
        }
    }
}

# ---- layered drawing helpers -------------------------------------------------

function New-RRect([double]$x, [double]$y, [double]$w, [double]$h, [double]$r) {
    $geo = New-Object System.Windows.Media.RectangleGeometry
    $geo.Rect = New-Object System.Windows.Rect($x, $y, $w, $h)
    $geo.RadiusX = $r
    $geo.RadiusY = $r
    return $geo
}

function New-HGrad([double]$a0, [double]$a1) {
    # horizontal alpha gradient (left -> right), used as the banner-06 blend mask
    $g = New-Object System.Windows.Media.LinearGradientBrush
    $g.StartPoint = [System.Windows.Point]::new(0, 0)
    $g.EndPoint = [System.Windows.Point]::new(1, 0)
    $c0 = [System.Windows.Media.Color]::FromArgb([byte][int](255 * $a0), 255, 255, 255)
    $c1 = [System.Windows.Media.Color]::FromArgb([byte][int](255 * $a1), 255, 255, 255)
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($c0, 0))) | Out-Null
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($c1, 1))) | Out-Null
    return $g
}

function Draw-ScrimBottom($dc) {
    $c0 = [System.Windows.Media.Color]::FromArgb(0, 0x1B, 0x0B, 0x2D)
    $c1 = [System.Windows.Media.Color]::FromArgb(232, 0x1B, 0x0B, 0x2D)
    $g = New-Object System.Windows.Media.LinearGradientBrush
    $g.StartPoint = [System.Windows.Point]::new(0, 0)
    $g.EndPoint = [System.Windows.Point]::new(0, 1)
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($c0, 0.50))) | Out-Null
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($c1, 1.0))) | Out-Null
    $dc.DrawRectangle($g, $null, (New-Object System.Windows.Rect(0, 470, 1920, 610)))
}

function Draw-ScrimTop($dc, [double]$maxAlpha) {
    $c1 = [System.Windows.Media.Color]::FromArgb([byte][int](255 * $maxAlpha), 0x10, 0x08, 0x20)
    $c0 = [System.Windows.Media.Color]::FromArgb(0, 0x10, 0x08, 0x20)
    $g = New-Object System.Windows.Media.LinearGradientBrush
    $g.StartPoint = [System.Windows.Point]::new(0, 0)
    $g.EndPoint = [System.Windows.Point]::new(0, 1)
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($c1, 0))) | Out-Null
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($c0, 0.32))) | Out-Null
    $dc.DrawRectangle($g, $null, (New-Object System.Windows.Rect(0, 0, 1920, 360)))
}

function Draw-Vignette($dc) {
    $edge = [System.Windows.Media.Color]::FromArgb(110, 0x10, 0x08, 0x20)
    $mid = [System.Windows.Media.Color]::FromArgb(0, 0x10, 0x08, 0x20)
    $g = New-Object System.Windows.Media.RadialGradientBrush
    $g.Center = [System.Windows.Point]::new(0.5, 0.42)
    $g.RadiusX = 0.95
    $g.RadiusY = 0.95
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($mid, 0))) | Out-Null
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($mid, 0.66))) | Out-Null
    $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop($edge, 1))) | Out-Null
    $dc.DrawRectangle($g, $null, (New-Object System.Windows.Rect(0, 0, 1920, 1080)))
}

# ---- logo lockups ------------------------------------------------------------

function Draw-LogoTile($dc, [double]$x, [double]$y, [double]$tile) {
    $r = $tile * 0.24
    $halo = New-Solid $script:NeonPink 0.30
    $dc.DrawRoundedRectangle($halo, $null, (New-RRect ($x - 9) ($y - 9) ($tile + 18) ($tile + 18) ($r + 9)), $r + 9, $r + 9)
    $dc.PushClip((New-RRect $x $y $tile $tile $r))
    $dc.DrawImage($script:LogoImg, (New-Object System.Windows.Rect($x, $y, $tile, $tile)))
    $dc.Pop()
    $border = New-Object System.Windows.Media.Pen((New-Solid $script:Cyan 0.55), 2)
    $dc.DrawRoundedRectangle($null, $border, (New-RRect $x $y $tile $tile $r), $r, $r)
}

function Draw-LogoCorner($dc) {
    Draw-LogoTile $dc 72 60 92
    $fill = New-VGrad $script:PinkLight $script:NeonPink
    $halo = New-Solid $script:NeonPink 0.50
    Draw-GlowText $dc 'BLOCKSIDE' 190 76 42 10 $fill $halo 6
}

function Draw-LogoHero($dc) {
    $tile = 186
    $x = (1920 - $tile) / 2
    Draw-LogoTile $dc $x 92 $tile
    $fill = New-VGrad $script:PinkLight $script:NeonPink
    $halo = New-Solid $script:NeonPink 0.55
    $w = Measure-Text 'BLOCKSIDE' 72 22
    Draw-GlowText $dc 'BLOCKSIDE' ((1920 - $w) / 2) (92 + $tile + 16) 72 22 $fill $halo 9
}

# ---- badge --------------------------------------------------------------------

function Draw-Badge($dc) {
    $text = 'IN DEVELOPMENT - PHASE 1'
    $size = 21
    $tw = Measure-Text $text $size 3
    $w = $tw + 48
    $h = 44
    $x = 1920 - 96 - $w
    $y = 1080 - 96 - $h
    $bg = New-Solid $script:DeepPurple 0.72
    $pen = New-Object System.Windows.Media.Pen((New-Solid $script:Magenta 0.60), 1.5)
    $dc.DrawRoundedRectangle($bg, $pen, (New-RRect $x $y $w $h 21), 21, 21)
    $fill = New-Solid $script:Cyan 0.92
    Draw-GlowText $dc $text ($x + 24) ($y + 9) $size 3 $fill (New-Solid $script:Cyan 0.25) 3
}

# ---- banner specifications ---------------------------------------------------

function Fit-Size([string]$text, [double]$size, [double]$max) {
    while ((Measure-Text $text $size 5) -gt $max -and $size -gt 44) { $size -= 2 }
    return $size
}

function Draw-HeadlineBlock($dc, $spec) {
    $baseY = 984.0
    $x = 96.0
    $yS = $baseY
    if ($spec.sub) {
        $subSize = 30
        $yS = $baseY - $subSize * 0.80
        Draw-GlowText $dc $spec.sub $x $yS $subSize 8 (New-Solid $script:Cyan 0.95) (New-Solid $script:Cyan 0.35) 3
    }
    $halo = New-Solid $script:NeonPink 0.55
    $fill = New-Solid $script:White 1.0
    $fill2 = New-Solid $script:Sunset 1.0
    if ($spec.headlineLines) {
        $lh = $spec.hSize * 0.80
        $yL2 = $yS - 16 - $lh
        $yL1 = $yL2 - 14 - $lh
        Draw-GlowText $dc $spec.headlineLines[0] $x $yL1 $spec.hSize 5 $fill $halo 8
        Draw-GlowText $dc $spec.headlineLines[1] $x $yL2 $spec.hSize 5 $fill2 $halo 8
    } else {
        $hs = Fit-Size $spec.headline $spec.hSize 1560
        $yH = $yS - 20 - $hs * 0.80
        Draw-GlowText $dc $spec.headline $x $yH $hs 5 $fill $halo 8
    }
}

$specs = @(
    @{ file='01-blockside-introduction.png';     raw='raw-01-introduction.png';  logo='hero';   headline='THE CITY IS YOURS.'; sub='A NEW OPEN WORLD IS TAKING SHAPE.'; hSize=112 },
    @{ file='02-explore-the-city.png';           raw='raw-02-explore.png';       logo='corner'; headline='ONE CITY. ENDLESS POSSIBILITIES.'; hSize=84 },
    @{ file='03-live-your-own-story.png';        raw='raw-03-story.png';         logo='corner'; headline='YOUR WORLD. YOUR STORY.'; hSize=100 },
    @{ file='04-get-behind-the-wheel.png';       raw='raw-04-wheel-driving.png'; logo='corner'; headline='FIND YOUR RIDE. OWN THE ROAD.'; hSize=84 },
    @{ file='05-a-living-city.png';              raw='raw-05-living-city.png';   logo='corner'; headline='THE CITY NEVER STANDS STILL.'; hSize=84 },
    @{ file='06-every-hour-changes.png';         raw=@('raw-06a-morning.png','raw-06b-night.png'); blend=$true; logo='corner'; headline='EVERY HOUR TELLS A DIFFERENT STORY.'; hSize=78 },
    @{ file='07-weather-changes-everything.png'; raw='raw-07-rain.png';          logo='corner'; headline='FEEL EVERY CHANGE.'; hSize=104 },
    @{ file='08-whats-coming-next.png';          raw='raw-08-next.png';          logo='corner'; headline="WE'RE JUST GETTING STARTED."; sub='MORE TO EXPLORE. MORE TO EXPERIENCE.'; hSize=92 },
    @{ file='09-open-world-freedom.png';         raw='raw-09-freedom.png';       logo='corner'; headlineLines=@('INSPIRED BY THE OPEN-WORLD GENRE.','BUILT AS OUR OWN WORLD.'); hSize=60 },
    @{ file='10-the-future-of-blockside.png';    raw='raw-10-future.png';        logo='hero';   headline='THE CITY IS YOURS.'; sub='FOLLOW THE JOURNEY.'; hSize=112 }
)

# ---- render loop --------------------------------------------------------------

foreach ($s in $specs) {
    $visual = New-Object System.Windows.Media.DrawingVisual
    $dc = $visual.RenderOpen()

    if ($s.blend) {
        $imgA = Load-Image (Join-Path $capt $s.raw[0])
        $imgB = Load-Image (Join-Path $capt $s.raw[1])
        $full = New-Object System.Windows.Rect(0, 0, 1920, 1080)
        $dc.DrawImage($imgA, $full)
        $dc.PushOpacityMask((New-HGrad 0.0 1.0), $full)
        $dc.DrawImage($imgB, $full)
        $dc.Pop()
    } else {
        $img = Load-Image (Join-Path $capt $s.raw)
        $dc.DrawImage($img, (New-Object System.Windows.Rect(0, 0, 1920, 1080)))
    }

    Draw-ScrimBottom $dc
    Draw-Vignette $dc
    if ($s.logo -eq 'hero') { Draw-ScrimTop $dc 0.55; Draw-LogoHero $dc }
    else { Draw-ScrimTop $dc 0.38; Draw-LogoCorner $dc }
    Draw-HeadlineBlock $dc $s
    Draw-Badge $dc
    $dc.Close()

    $rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(1920, 1080, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
    $rtb.Render($visual)
    $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
    $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb)) | Out-Null
    $fs = [System.IO.File]::Open((Join-Path $out $s.file), [System.IO.FileMode]::Create)
    $enc.Save($fs)
    $fs.Dispose()
    Write-Output ("saved " + $s.file)
}

Write-Output 'ALL 10 BANNERS RENDERED'


