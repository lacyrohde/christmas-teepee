# Print profile: example build

The settings used for the MakerWorld print profile. `teepee_tree_connectors_X2D.3mf` in this folder is the ready-made Bambu Studio project (X2D, all 4 plates, per-object settings); open it, slice, and publish.

**Build:** 6 legs × 96¼", 60" base corner to corner, crosspiece at 40", 9 ft ceiling, 38.6 mm sockets. Leg lean 16.79°. See `params.json`.

## Printer and filament

- Printer: Bambu Lab X2D (0.4 mm nozzle, Textured PEI plate) (any printer with a bed of 256 × 256 mm or more fits these plates)
- Nozzle: 0.4 mm
- Filament: standard PETG (built with Polymaker PETG, Dark Green). The 3MF uses the "Bambu PETG Basic @BBL X2D 0.4 nozzle" preset; swap in your own PETG preset if you have one. About 1.2 kg in all

## Process settings (Bambu Studio)

Start from **0.20mm Standard** and change:

| Setting | Value | Where |
|---|---|---|
| Wall generator | Arachne | Quality |
| Wall loops | 4 | Strength |
| Top shell layers | 4 | Strength |
| Bottom shell layers | 4 | Strength |
| Sparse infill density | 20% | Strength |
| Sparse infill pattern | Gyroid | Strength |
| Enable support | Off on every plate | Support |
| Brim | Outer brim, 10 mm, star post only | Others |

Per-part overrides (already set on each object in the 3MF):

| Part | Change | Why |
|---|---|---|
| Base corners, doorway corners | 15% infill | Light loads; the screws hold the base pieces |
| Star post | 10 mm brim, outer wall 80 mm/s | Tall and narrow: less shake near the thin top |

Keep every part in its exported orientation.

## Plates

| Plate | Parts | Notes |
|---|---|---|
| 1 | `top_hub` ×1, `star_post` ×1 | Hub upside down, no supports. Brim on the post. |
| 2 | `base_corner_2arm` ×2 | Flat. 45° roofs with a short flat ridge over the arm sockets, no supports. |
| 3 | `base_corner_2arm` ×2 | Same as plate 2. |
| 4 | `doorway_corner_left`, `doorway_corner_right`, `crosspiece_sleeve_left_leg`, `crosspiece_sleeve_right_leg` | No supports. |
| Optional | `fit_test_*` from `examples/fit-test-rings/` | Print first if your wood may not be 38.6 mm. |

Fill in from Bambu Studio after slicing:

| Plate | Time | Filament |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |

## Hardware

- 12 × #8 × 1¼" wood screws
- Disco ball mount (optional): ¼"-20 × 1" forged eye bolt and a ¼"-20 nylon lock nut (captured in a slot in the hub; no washer)
