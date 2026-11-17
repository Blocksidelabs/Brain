# BLOCKSIDE Banner Pipeline

Produces the 10 official X promotional banners (1920x1080 PNG) from **real
in-engine captures** of the game build — no faked or AI-substituted imagery.

## Files

| Path | Purpose |
|---|---|
| `scripts/capture-banners.mjs` | Playwright driver: boots the built game, sets hour/weather/camera via the `__BLOCKSIDE_DEBUG__` hook, saves raw 1920x1080 frames to `banner-captures/<quality>/` |
| `scripts/compose-banners.ps1` | Compositor: official logo tile + neon wordmark, headlines/subtitles, brand scrim + vignette, "IN DEVELOPMENT - PHASE 1" badge; exports final PNGs to `Banners/` |
| `Banners/` | Final campaign PNGs (exact X filenames) |
| `banner-captures/` | Raw engine frames (keep for re-compositing) |

## Additive debug hook (production-safe)

`BlocksideGame.ts` test hook gained four capture-only methods next to the
existing `debugSetHour` / `debugTeleport`:

- `debugSetWeather(w)` / `debugGetWeather()` — pin weather, read transition state
- `debugPhotoMode(on)` / `debugCameraPose(...)` — freeze the camera rig and place
  it directly (banner framing); gameplay never uses photo mode

`CameraManager` gained a `photoMode` flag that early-returns from `update()`
when enabled. All default behavior is unchanged.

## Usage

```powershell
# 1) build + serve
npm run build
npm run preview -- --port 4173 --strictPort   # keep running

# 2) capture (from blockside/)
$env:QUALITY='medium'; node scripts/capture-banners.mjs
#   ONLY=sunny | ONLY=rain to re-run one weather group

# 3) composite
powershell -STA -File scripts/compose-banners.ps1 -Quality medium
```

## Honesty

Raw frames are genuine engine renders of the real city (three.js build).
Published captions must say "in-development footage" — never "gameplay footage"
of a finished game, and never present composites as screenshots of anything
other than the current BLOCKSIDE build.
