# System in Action 3D artwork

`bench-3d-matrix.png` is the current static, photorealistic 3D render of the
intended hardware arrangement. The System in Action page composites the existing
MetaDrive frame onto its laptop display. The source screenshot is
`simulation_runner/assets/screenshots/main_index_24_step_906_1788674762.5795348.png`.

The render shows a laptop, USB-CAN adapter, orange and blue CAN H/CAN L wires
passing through a shared breadboard, a CAN transceiver and STM32 ECU, and one
8×8 MAX7219 LED matrix module per headlight. The lower four rows provide the
low-beam base; the upper four add high beam. Some upper pixels are off on the
left matrix to illustrate an ADB mask. The scene is a fixed example of the
target system; it has no runtime feed. The previous `bench-3d.png` artwork is
retained as historical artwork and is no longer used by the page.

The artwork was created with the built-in `image_gen` tool by editing the prior
bench render. Final edit prompt:

```text
Edit the existing photorealistic 3D tabletop prototype render. Preserve the laptop and its proportions, USB-CAN adapter, shared CAN breadboard and orange/blue wiring, STM32 board, plain table, camera angle, lighting, and composition. Replace the two PCA9685 beam controllers and the two seven-LED breadboards with exactly two compact 8×8 MAX7219 LED matrix modules, one left and one right, each connected to the STM32 by visible SPI wiring. Each matrix must visibly contain an 8 by 8 grid of individual small warm-white LEDs. On both matrices, the lower four rows glow to represent the low-beam base. The upper four rows glow to represent high beam. On the LEFT matrix, switch off a small block of upper pixels toward the left side to illustrate an ADB shadow; keep all lower rows lit. On the RIGHT matrix, keep all 64 pixels lit. Keep realistic electronics scale and subtle glow. No text, labels, extra lamps, tools, decorations, automotive lamp housings, or road diorama. Wide 16:9 landscape, elevated three-quarter camera angle, warm neutral studio light and real cast shadows.
```
