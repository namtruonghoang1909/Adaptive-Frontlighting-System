# Hardware Datasheets and References

This folder keeps the component documents identified by the current hardware
plan. A silicon datasheet describes the chip; it does not confirm the pinout,
voltage routing, or protection on an unspecified breakout board.

## Downloaded Documents

| File | Component / use | Revision and source |
|---|---|---|
| [STM32F407VE datasheet, Rev. 8 (2016)](stm32f407ve-datasheet-rev-8-2016.pdf) | STM32F407VET6 MCU on the STM32F4VE board | ST-authored datasheet, Doc ID 022152 Rev. 8, September 2016. Retrieved from [a GitHub mirror](https://github.com/kpi-keoa/glsk_stm32_toolchain/blob/master/documentation/STM32F407_Datasheet_%28DS8626%29.pdf). ST's [current official datasheet](https://www.st.com/resource/en/datasheet/stm32f407ve.pdf) is DS8626 Rev. 12 (March 2026); use that version when checking final electrical limits. |
| [MCP2551 datasheet, Rev. G](mcp2551-datasheet-rev-g.pdf) | CAN physical-layer transceiver | Official [Microchip document DS20001667G](https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/20001667G.pdf). The datasheet says MCP2551 is not recommended for new designs and points to MCP2561. This is retained because MCP2551 is the part currently named in the hardware plan. |
| [PCA9685 datasheet, Rev. 4](pca9685-datasheet.pdf) | I2C PWM controller used by the servo-driver board | Official [NXP product data sheet](https://www.nxp.com/docs/en/data-sheet/PCA9685.pdf), 16 April 2015. |
| [MAX7219/MAX7221 datasheet, Rev. 6](max7219-max7221-datasheet-rev-6.pdf) | Matrix LED driver ICs | Official [Analog Devices datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX7219-MAX7221.pdf), 4 August 2021. The local copy was retrieved from [this mirror](https://docs.ampnuts.ru/maximintegrated.com.datasheet/MAX7219-MAX7221.pdf); its SHA-256 is `7585bd4469c4355ea7e7d7193710605f2ab96afa14491c377420d057f9c8d5eb`. |
| [STM32F4VE V2.0 reference schematic](stm32-f4ve-v2-reference-schematic.pdf) | Board-level orientation only | [STM32-base community mirror](https://stm32-base.org/assets/pdf/boards/original-schematic-STM32F407VET6-STM32_F4VE_V2.0.pdf). It is marked V2.0 and is **not verified** against the user's board marked `STM32F4VE ver 36C SN:2024C`; do not treat its header routing as confirmed. |

The STM32 and MAX7219 files are copies from mirrors because their vendor PDF
hosts reset the download connection in this environment. The original vendor
links above are included so the source and newer revisions remain discoverable.

## Still Needed Once the Exact Hardware Is Identified

The project notes do not specify the following product models, so there is no
reliable model-specific document to download yet:

- The exact STM32F4VE board revision schematic matching `ver 36C`.
- The MCP2551 module schematic or part number, including its supply and logic
  level implementation.
- The PCA9685 breakout-board schematic, especially power-rail and I2C pull-up
  routing.
- The two MAX7219 matrix-module model, LED matrix ratings, and module schematic.
- The left and right feedback-servo model datasheets, including pinout, feedback
  range, supply range, and stall current.
- The USB-to-CAN adapter model and Linux driver / SocketCAN manual.
- The external power-supply and logic-translator models.
- The ST-Link model-specific manual.

When those models are known, add their manufacturer PDFs here and record the
revision, source URL, and any board-level caveats in this index. See the
[hardware overview](../hardware.md) and [wiring draft](../wiring-draft.md) for
the current component list and unapproved candidate wiring.
