# BLOCKSIDE — 10 Image-Generation Prompts (16:9 Banner Plates)

## How to use

1. Generate the **clean art plate** with the prompt below (no baked text).
2. Composite typography per the overlay spec — this guarantees crisp, readable branding (AI text rendering is unreliable).
3. If your model renders text well (gpt-image-1, Ideogram 3), append the **optional text line** listed under each prompt.

**Model cheatsheet**
- Midjourney: keep `--ar 16:9 --style raw` (add your current version flag).
- gpt-image-1 / DALL·E: paste the prompt, request landscape (1536×1024 / 1792×1024), crop to 1920×1080.
- SDXL / Flux: generate 1344×768, upscale to 1920×1080; add the negative prompt below.
- Reuse the same seed across prompts (where supported) for tighter visual consistency.

**Universal negative prompt (SD/Flux):**

```text
low-poly, primitive blocky graphics, floating or hovering vehicles, cyberpunk, neon wireframes, holographic UI, text, letters, watermark, signature, logo, cartoon, anime, oversaturated, plastic, blurry, deformed faces, extra limbs, fisheye
```

## Overlay spec (apply in post to every banner)

- Headline: Anton/Archivo Black, ALL CAPS, white, 96–140 px, lower-left (banners 1 & 10: lower-center-left), shadow 0/4/16 @60%.
- Subtitle (where used): Archivo/Inter ALL CAPS, `#FFC24B`, ≈40% size, +20% tracking.
- Wordmark: BLOCK white + SIDE gold gradient + coastal-blue keyline; bottom-left (banners 1 & 10: top-center).
- Badge: "IN DEVELOPMENT" pill, navy 80%, gold text, bottom-right.
- Scrim: lower-left gradient to `#05090F` @65% before placing text.

**Honesty rule:** all output is concept art. Always caption as "Concept art — BLOCKSIDE (in development)". Never imply gameplay.

---

## PROMPT 1 — Banner 1 plate (THE CITY IS YOURS)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality. High aerial establishing shot of an original fictional American coastal city at golden hour: a palm-lined boulevard curves from leafy foreground hills toward a glittering downtown of glass towers and art-deco high-rises; a wide crescent beach and calm ocean on the right catching the low sun; a small marina with boats; long shadows stretching across streets; a few cars driving with headlights on; layered buildings fading into soft warm haze; subtle lens bloom. Camera: high wide drone view, 24mm lens, slight downward tilt, skyline on the upper-right third. Warm golden-hour color grade, teal-blue shadows, deep navy tones, soft atmospheric haze, subtle film grain, high-detail environment, realistic materials, professional game marketing composition, 16:9 landscape, mood: iconic, hopeful, premium. Leave clean sky and negative space in the lower-left third for typography. --ar 16:9
```

- Overlay: headline **THE CITY IS YOURS.** + subtitle **A NEW OPEN WORLD IS TAKING SHAPE.** · wordmark top-center.
- Optional text line: `Add crisp, correctly spelled typography: headline "THE CITY IS YOURS." lower-center-left with subtitle "A NEW OPEN WORLD IS TAKING SHAPE." beneath it, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) top-center, "IN DEVELOPMENT" pill bottom-right.`

## PROMPT 2 — Banner 2 plate (EXPLORE THE CITY)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality. Ground-level view down a sunlit commercial avenue in an original fictional American coastal city: pastel art-deco storefronts with awnings, sidewalk cafés with a few seated people, palm trees in concrete planters, parked cars, a mid-distance crosswalk with pedestrians, and the city's tallest tower rising at the end of the street as the focal point; warm mid-morning light raking across facades; believable street furniture, clean sidewalks; gentle depth haze. Camera: 35mm lens, eye level, slight low angle, strong one-point perspective down the sidewalk. Warm golden color grade, teal-blue shadows, subtle film grain, high-detail textures, professional game marketing composition, 16:9 landscape, mood: inviting, walkable, alive. Leave clean negative space in the lower-left third for typography. --ar 16:9
```

- Overlay: headline **ONE CITY. ENDLESS POSSIBILITIES.** · wordmark bottom-left.
- Optional text line: `Add crisp, correctly spelled typography: headline "ONE CITY. ENDLESS POSSIBILITIES." lower-left, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) bottom-left beneath it, "IN DEVELOPMENT" pill bottom-right.`

## PROMPT 3 — Banner 3 plate (LIVE YOUR OWN STORY)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality. Third-person over-the-shoulder shot of an original video game character — early twenties, athletic build, open coral shirt over a white tee, rolled-up denim jeans, white sneakers, short dark hair (fully original design, not based on any existing franchise character) — standing on the right third of a city sidewalk in a fictional coastal city, relaxed confident posture, looking across a busy two-lane street toward market stalls, string lights and pastel storefronts; warm morning sunlight, soft bounce light off the pavement; blurred pedestrians in the background, sharp mid-ground detail. Camera: 50mm lens at chest height just behind the character's right shoulder, shallow depth of field with focus on the street scene ahead. Warm grade, teal-blue shadows, subtle film grain, professional game marketing composition, 16:9 landscape, mood: personal, curious, free. Leave clean negative space lower-left for typography. --ar 16:9
```

- Overlay: headline **YOUR WORLD. YOUR STORY.** · wordmark bottom-left.
- Optional text line: `Add crisp, correctly spelled typography: headline "YOUR WORLD. YOUR STORY." lower-left, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) bottom-left beneath it, "IN DEVELOPMENT" pill bottom-right.`

## PROMPT 4 — Banner 4 plate (GET BEHIND THE WHEEL)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality. Low tracking shot of an original-design modern sports coupe — sleek two-door proportions, sunset-orange metallic paint, dark alloy wheels, no real-world brand badges — driving along a palm-lined coastal boulevard at golden hour, glittering ocean and beach guardrail to the left; background palm trees and skyline softly motion-blurred to imply speed while the car stays tack-sharp; realistic reflections of the sunset sky and palms gliding across the paintwork; detailed tires and rims; faint heat shimmer over the asphalt. Camera: low front three-quarter angle, 35mm lens, near asphalt height, car on the right third. Warm golden-hour grade, teal-blue shadows, subtle film grain, professional game marketing composition, 16:9 landscape, mood: speed, style, freedom. Leave clean sky and negative space in the lower-left third for typography. --ar 16:9
```

- Overlay: headline **FIND YOUR RIDE. OWN THE ROAD.** · wordmark bottom-left.
- Optional text line: `Add crisp, correctly spelled typography: headline "FIND YOUR RIDE. OWN THE ROAD." lower-left, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) bottom-left beneath it, "IN DEVELOPMENT" pill bottom-right.`

---

## PROMPT 5 — Banner 5 plate (A LIVING CITY)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality. Elevated three-quarter view of a busy signalized intersection in a fictional American coastal city in late afternoon: believable mixed traffic — sedans, hatchbacks, a yellow cab, a city bus — stopped at a red light with realistic spacing and turn signals; pedestrians crossing at the zebra stripes in natural poses; a corner café with a striped awning, street trees, traffic lights and crosswalk signs; sunlit facades with fire escapes and awnings; gentle warm haze. Camera: 28mm lens from a second-floor balcony vantage across the intersection, slight downward angle. Warm golden-hour grade, teal-blue shadows, subtle film grain, high-detail environment, professional game marketing composition, 16:9 landscape, mood: systemic, alive, believable. Leave clean negative space in the lower-left third for typography. --ar 16:9
```

- Overlay: headline **THE CITY NEVER STANDS STILL.** · wordmark bottom-left.
- Optional text line: `Add crisp, correctly spelled typography: headline "THE CITY NEVER STANDS STILL." lower-left, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) bottom-left beneath it, "IN DEVELOPMENT" pill bottom-right.`

## PROMPT 6 — Banner 6 plate (EVERY HOUR CHANGES THE CITY)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality. One continuous panoramic skyline of a fictional American coastal city in which the light transitions across the frame from left to right: the left side bathed in soft pink dawn over a marina and empty beach; the center in bright clear noon light over downtown towers; the right side in deep blue night with warm lit windows, street lamps and headlight streaks on the boulevard; sky, shadows and color temperature shifting smoothly and believably from left to right like a time-lapse frozen mid-sweep. Camera: elevated wide panorama, 24mm lens, level horizon, city filling the middle band of the frame. Golden-to-navy cinematic grade, teal-blue shadows, subtle film grain, atmospheric depth, professional game marketing composition, 16:9 landscape, mood: time as a character, wonder. Leave clean negative space in the lower-left third for typography. --ar 16:9
```

- Overlay: headline **EVERY HOUR TELLS A DIFFERENT STORY.** · wordmark bottom-left.
- Optional text line: `Add crisp, correctly spelled typography: headline "EVERY HOUR TELLS A DIFFERENT STORY." lower-left, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) bottom-left beneath it, "IN DEVELOPMENT" pill bottom-right.`

## PROMPT 7 — Banner 7 plate (WEATHER CHANGES EVERYTHING)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality. Low, road-level shot of a rain-soaked street at dusk in a fictional American coastal city: wet asphalt acting as a mirror reflecting red traffic lights, white headlights and warm storefront glow; a taxi approaching through light drizzle with headlights on; fog softening the far end of the block; a few pedestrians with umbrellas on glistening sidewalks; hanging streetlights haloed in mist; puddle reflections and fine rain streaks visible in the headlight beams; cool blue-gray base grade with warm pools of amber light. Camera: 35mm lens near the road surface, shallow depth of field, bokeh light highlights, centered street vanishing point. Moody cinematic grade, subtle film grain, professional game marketing composition, 16:9 landscape, mood: cinematic, tactile, atmospheric. Leave clean negative space in the lower-left third for typography. --ar 16:9
```

- Overlay: headline **FEEL EVERY CHANGE.** · wordmark bottom-left.
- Optional text line: `Add crisp, correctly spelled typography: headline "FEEL EVERY CHANGE." lower-left, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) bottom-left beneath it, "IN DEVELOPMENT" pill bottom-right.`

---

## PROMPT 8 — Banner 8 plate (WHAT'S COMING NEXT?)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality. Blue-hour overlook scene: an original-design muscle coupe — deep navy paint, no real-world badges — parked at a scenic coastal turnoff, headlights aimed along a winding cliffside highway that descends toward a glittering downtown skyline across the bay; deep navy sky with the first stars, warm city glow reflecting on dark water; guardrail, coastal brush and rocks in the foreground; a sense of a journey about to begin. Camera: 24mm lens from just behind and slightly above the car, the city and highway curve centered in the upper two-thirds of the frame. Deep navy and warm amber cinematic grade, soft haze, subtle film grain, professional game marketing composition, 16:9 landscape, mood: anticipation, momentum, the road ahead. Leave clean negative space in the lower-left third for typography. --ar 16:9
```

- Overlay: headline **WE'RE JUST GETTING STARTED.** + subtitle **VEHICLES • AI CITY LIFE • MISSIONS • PERFORMANCE** · wordmark bottom-left.
- Optional text line: `Add crisp, correctly spelled typography: headline "WE'RE JUST GETTING STARTED." lower-left with small gold subtitle "VEHICLES • AI CITY LIFE • MISSIONS • PERFORMANCE" beneath it, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) bottom-left beneath that, "IN DEVELOPMENT" pill bottom-right.`

## PROMPT 9 — Banner 9 plate (BUILT FOR OPEN-WORLD FREEDOM)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality. Epic high aerial panorama of a fictional American coastal city in crisp late-afternoon light: a crescent beach with tiny lifelike figures, a palm-lined beachfront promenade with pastel art-deco hotels, an elevated coastal highway curving along the shore with light believable traffic, sailboats on turquoise water, and the downtown skyline rising behind; layered depth receding to a clear horizon; believable human and building scale throughout. Camera: very high wide aerial, 21mm lens, level horizon, beach sweeping along the lower third. Warm sunlight, teal-blue shadows, subtle film grain, professional game marketing composition, 16:9 landscape, mood: scale, openness, freedom. Leave clean negative space in the lower-left third for typography. --ar 16:9
```

- Overlay: two-line lockup, lower-left: **INSPIRED BY THE OPEN-WORLD GENRE.** (white) / **BUILT AS OUR OWN WORLD.** (gold) · wordmark bottom-left beneath.
- Optional text line: `Add crisp, correctly spelled typography: two-line lower-left lockup — "INSPIRED BY THE OPEN-WORLD GENRE." in white and "BUILT AS OUR OWN WORLD." in gold, both bold condensed all-caps sans-serif, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) beneath them, "IN DEVELOPMENT" pill bottom-right.`

## PROMPT 10 — Banner 10 plate (THE FUTURE OF BLOCKSIDE)

```text
Cinematic AAA video game promotional key art, photorealistic modern game-engine render quality — the hero frame of the campaign. Panoramic view of a fictional American coastal city at the exact moment day turns to night: the sun touching the ocean horizon on the left with a gold-to-navy sky gradient overhead; a grand oceanfront boulevard with early-evening traffic and the first headlight streaks; an original art-deco landmark tower silhouetted against the sunset; city lights igniting building by building; palm trees and beach silhouettes framing the edges; maximum environmental detail, soft haze layers, reflections beginning to glow on the asphalt. Camera: elevated cinematic wide shot, 35mm lens, classic key-art composition with the skyline on the upper-right third. Warm sunset-orange and deep navy cinematic grade, subtle film grain, professional game marketing composition, 16:9 landscape, mood: iconic, emotional, finale. Leave clean negative space in the lower-center-left for typography. --ar 16:9
```

- Overlay: headline **THE CITY IS YOURS.** + subtitle **FOLLOW THE JOURNEY.** · wordmark top-center.
- Optional text line: `Add crisp, correctly spelled typography: headline "THE CITY IS YOURS." large lower-center-left with subtitle "FOLLOW THE JOURNEY." in smaller gold letters beneath it, wordmark "BLOCKSIDE" (BLOCK white / SIDE gold) top-center, "IN DEVELOPMENT" pill bottom-right.`

---

**End of prompts.** 10 plates → composite typography per the overlay spec → export 1920×1080 finals into `banners/`.



