# System in Action visitor tab

## Objective and current scope

Create a visitor-facing **System in Action** tab in the static System
Visualization tool. Show the target prototype as a detailed 3D tabletop render. The 2026-10-10 revision replaces the first animated story with
one fixed example matching the user's actual LED bench. Retain the page's overall visual style and its rendered scene plus explanation layout.

The illustration is explanatory material. It requires no running simulator,
socket, CAN interface, MCU, or live data feed.

## Physical arrangement

Arrange the hardware from left to right:

1. **Laptop:** MetaDrive on its screen. The Python runner and C++ bridge are
   separate processes on this same computer, connected by the implemented
   runner-to-bridge local socket. Use the repository screenshot showing a
   white car ahead and to the left of the red ego car.
2. **USB-CAN controller:** immediately to the laptop's right, connected by USB.
   Its output exposes CAN H and CAN L.
3. **Shared CAN breadboard:** the controller's CAN H/CAN L pair enters this
   board. A second CAN H/CAN L pair leaves the same board for the ECU's CAN
   transceiver. Use orange and blue wires so visitors can follow both lines.
4. **STM32 ECU:** on the right of the CAN breadboard. It receives the
   observations and chooses the matrix pixel patterns.
5. **Two MAX7219 modules:** connected to the STM32 over SPI, one for each
   headlight. Each module has an 8×8 LED grid.
6. **Beam rows:** the lower four rows of each matrix stay on as low beam; the
   upper four rows add high beam. A small upper-pixel mask on the left matrix
   illustrates adaptive beam control.

The table and background are plain. Exclude workshop tools, screwdrivers,
decorations, full automotive lamp housings, road models, and servo motion
from this first illustration.

## Fixed scene and LED state

- The screen shows the real MetaDrive screenshot at
  `simulation_runner/assets/screenshots/main_index_24_step_906_1788674762.5795348.png`.
- The white car ahead-left corresponds to a small block of switched-off pixels
  in the upper four rows of the left matrix.
- The lower four rows remain on as low beam on both matrices. The right matrix
  shows the complete high-beam pattern.
- Keep the 8×8 pixel grids visible and avoid excessive glow.
- Describe this as a fixed example of the intended response. It does not
  define the final calibrated vehicle-to-LED mapping.

## Page behavior

- Keep the existing Code graph and shared top navigation.
- Use a local static 3D render and the original MetaDrive screenshot placed on
  its laptop screen with an HTML/SVG overlay. Remove the story timeline, playback
  controls, progress indicator, traveling pulses, and dynamic highlights.
- Keep the entire physical chain visible in the desktop scene. On phones, show
  a complete overview above a horizontally scrollable detailed view.
- Keep the explanation card beside the image on desktop and below it on
  narrow screens. State the left/right LED counts and explain CAN wire colors.
- Add a static six-part connection guide below the scene.
- Provide image descriptions, readable text, keyboard-accessible navigation,
  and a page that works unchanged without JavaScript or with reduced motion.

## Files

| Path | Change |
|---|---|
| `tools/system_visualization/system-in-action/index.html` | Static bench image, LED explanation, connection guide. |
| `tools/system_visualization/system-in-action/system-in-action.css` | Static layout and responsive styling. |
| `tools/system_visualization/system-in-action/assets/workbench.png` | Remove the outdated headlamp picture. |
| `tools/system_visualization/system-in-action/assets/bench-3d-matrix.png` | Render the static 3D tabletop hardware scene with two matrix headlights. |
| `tools/system_visualization/system-in-action/assets/README.md` | Record the final artwork components and screenshot source. |
| `tools/system_visualization/system-in-action.mjs` | Remove the playback controller. |
| `tools/system_visualization/system-in-action-story.mjs` | Remove the timeline model. |
| `tools/system_visualization/system-in-action.test.mjs` | Remove tests for the removed animation. |
| `tools/system_visualization/code-graph/code-index.js` | Regenerate the source inventory. |
| `tools/system_visualization/README.md`, `tools/README.md`, `README.md`, `docs/tools/tools.md`, `docs/architecture/overview.md` | Explain the static visitor view and actual LED prototype. |
| `agents/working-context.md`, `agents/prompt-tracking.md` | Record the revised scope and verification. |

## Tests and acceptance

1. Confirm two distinct 8×8 matrices. Verify the lower four rows stay lit and
   that the left matrix has an upper-pixel mask while the right matrix remains
   fully lit.
2. Confirm the laptop screen contains the white vehicle ahead-left and the
   red ego vehicle. Inspect the rendered asset and the composited screenshot in the page.
3. Follow the visible USB connection and both CAN wire pairs through the same
   breadboard to the ECU. Check the two PCA-to-LED connections and plain table.
4. Verify that the visitor page loads no scripts and has no animation or
   runtime requests. Its content must remain complete with JavaScript disabled.
5. Review desktop and phone-width browser screenshots; check text, labels,
   image fit, and absence of horizontal page overflow.
6. Verify both navigation links and local assets. Check the existing Code
   graph still loads and its selection/functionality controls work.
7. Regenerate and validate the source inventory. Review the curated graph and
   functionality paths; keep planned socket, CAN, and firmware behavior out of
   the implemented graph. Run relevant syntax, Markdown, and whitespace checks.

The revision is complete when a visitor can identify the physical components
and understand the pictured vehicle-to-LED relationship in a single static view.
