(() => {
  "use strict";

  const nets = [
    {
      id: "usb", label: "USB host links", color: "#9bb1a8", state: "Model TBD",
      summary: "The Linux host connects separately to the SocketCAN adapter and ST-Link probe.",
      from: "Linux laptop · USB-A ports",
      to: "USB-to-CAN adapter; ST-Link USB connector",
      note: "The adapter and ST-Link models are not identified. The illustration shows generic connectors.",
    },
    {
      id: "can-h", label: "CANH", color: "#e8b55e", state: "Candidate",
      summary: "CAN high runs as one conductor from the USB-CAN adapter to the transceiver bus pin.",
      from: "USB-CAN adapter · CANH",
      to: "MCP2551 module · CANH",
      note: "Confirm adapter terminal labels and module connector orientation. Keep CANH and CANL as a twisted pair where practical.",
    },
    {
      id: "can-l", label: "CANL", color: "#6db6d2", state: "Candidate",
      summary: "CAN low runs beside CANH from the adapter to the transceiver bus pin.",
      from: "USB-CAN adapter · CANL",
      to: "MCP2551 module · CANL",
      note: "Confirm adapter terminal labels and module connector orientation. Avoid swapping CANH and CANL.",
    },
    {
      id: "termination", label: "CAN termination", color: "#f3ce75", state: "Check first",
      summary: "A linear CAN bus needs one 120 Ω termination at each physical end.",
      from: "USB-CAN bus end · 120 Ω",
      to: "ECU bus end · 120 Ω",
      note: "The drawing marks both ends. Check switches or fitted resistors first so the bus has exactly two end terminators, not extra ones.",
    },
    {
      id: "swdio", label: "SWDIO · PA13", color: "#c2a2e3", state: "Pin fixed · header TBD",
      summary: "The MCU's SWD data pin connects to the matching debug-probe pin.",
      from: "STM32F407VET6 · PA13 / SWDIO",
      to: "ST-Link · SWDIO",
      note: "Verify the board debug header pin order and connector orientation before connecting.",
    },
    {
      id: "swclk", label: "SWCLK · PA14", color: "#c2a2e3", state: "Pin fixed · header TBD",
      summary: "The MCU's SWD clock pin connects to the matching debug-probe pin.",
      from: "STM32F407VET6 · PA14 / SWCLK",
      to: "ST-Link · SWCLK",
      note: "Verify the board debug header pin order and connector orientation before connecting.",
    },
    {
      id: "nrst", label: "NRST · optional", color: "#c2a2e3", state: "Optional",
      summary: "An optional reset lead allows the debug probe to control MCU reset.",
      from: "STM32F407VET6 · NRST",
      to: "ST-Link · NRST",
      note: "The wiring draft treats this lead as optional. Confirm that the specific ST-Link supports it.",
    },
    {
      id: "can-tx", label: "CAN2 TX · PB13", color: "#e29c76", state: "Interface TBD",
      summary: "CAN2 transmit leaves the MCU and reaches the transceiver TXD input through the logic-level interface under review.",
      from: "STM32F407VET6 · PB13 / CAN2_TX",
      to: "MCP2551 module · TXD",
      note: "MCP2551 supply and MCU logic levels need checking. The buffer/translator circuit is not selected; this drawing does not approve a direct connection.",
    },
    {
      id: "can-rx", label: "CAN2 RX · PB12", color: "#e29c76", state: "Interface TBD",
      summary: "The transceiver RXD output returns to the MCU CAN2 receive pin through the logic-level interface under review.",
      from: "MCP2551 module · RXD",
      to: "STM32F407VET6 · PB12 / CAN2_RX",
      note: "Check RXD high voltage at the selected transceiver supply against the MCU input limits. Do not wire directly until this is resolved.",
    },
    {
      id: "i2c-scl", label: "I2C1 SCL · PB8", color: "#87cfaa", state: "Candidate",
      summary: "I2C1 clock connects the MCU to the PCA9685 breakout.",
      from: "STM32F407VET6 · PB8 / I2C1_SCL",
      to: "PCA9685 breakout · SCL",
      note: "Candidate pin route. Confirm it is exposed on the exact board and that I2C pull-ups go to 3.3 V.",
    },
    {
      id: "i2c-sda", label: "I2C1 SDA · PB9", color: "#87cfaa", state: "Candidate",
      summary: "I2C1 data connects the MCU to the PCA9685 breakout.",
      from: "STM32F407VET6 · PB9 / I2C1_SDA",
      to: "PCA9685 breakout · SDA",
      note: "Candidate pin route. Confirm it is exposed on the exact board and that I2C pull-ups go to 3.3 V.",
    },
    {
      id: "pwm-left", label: "PWM0 · left servo", color: "#bf9cdf", state: "Candidate",
      summary: "The first PCA9685 PWM output provides the left swivel servo command.",
      from: "PCA9685 breakout · PWM0",
      to: "Left feedback servo · command input",
      note: "The servo's actual signal wire and connector pinout are unknown. Confirm its control voltage, frequency, and connector orientation.",
    },
    {
      id: "pwm-right", label: "PWM1 · right servo", color: "#bf9cdf", state: "Candidate",
      summary: "The second PCA9685 PWM output provides the right swivel servo command.",
      from: "PCA9685 breakout · PWM1",
      to: "Right feedback servo · command input",
      note: "The servo's actual signal wire and connector pinout are unknown. Confirm its control voltage, frequency, and connector orientation.",
    },
    {
      id: "servo-feedback-left", label: "PA1 · left feedback", color: "#eb96a5", state: "Candidate · voltage check",
      summary: "The left servo's position feedback returns directly to an MCU ADC input.",
      from: "Left feedback servo · analog feedback",
      to: "STM32F407VET6 · PA1 / ADC123_IN1",
      note: "Confirm the exact servo pinout and make sure its feedback voltage stays within the STM32 ADC input range.",
    },
    {
      id: "servo-feedback-right", label: "PA4 · right feedback", color: "#eb96a5", state: "Candidate · voltage check",
      summary: "The right servo's position feedback returns directly to a second MCU ADC input.",
      from: "Right feedback servo · analog feedback",
      to: "STM32F407VET6 · PA4 / ADC12_IN4",
      note: "Confirm the exact servo pinout and make sure its feedback voltage stays within the STM32 ADC input range.",
    },
    {
      id: "spi-clock", label: "SPI2 SCK · PB10", color: "#77c9c5", state: "Direct · bench validation",
      summary: "SPI clock connects directly from the STM32 to both MAX7219 CLK inputs.",
      from: "STM32F407VET6 · PB10 / SPI2_SCK",
      to: "Both MAX7219 modules · CLK",
      note: "At V+ = 5 V, the MAX7219 datasheet specifies VIH ≥ 3.5 V. The STM32's 3.3 V output is below that guaranteed threshold; direct wiring is the selected bench test and must be checked for reliable operation.",
    },
    {
      id: "spi-mosi", label: "SPI2 MOSI · PC3", color: "#7dadf0", state: "Direct · bench validation",
      summary: "SPI data connects directly from the STM32 to both MAX7219 DIN inputs; MISO is unused.",
      from: "STM32F407VET6 · PC3 / SPI2_MOSI",
      to: "Both MAX7219 modules · DIN",
      note: "At V+ = 5 V, the MAX7219 datasheet specifies VIH ≥ 3.5 V. The STM32's 3.3 V output is below that guaranteed threshold; direct wiring is the selected bench test and must be checked for reliable operation.",
    },
    {
      id: "matrix-load-left", label: "PD10 · left LOAD", color: "#bbab76", state: "Direct · bench validation",
      summary: "A dedicated GPIO LOAD line lets firmware latch updates to the left matrix independently.",
      from: "STM32F407VET6 · PD10 / GPIO",
      to: "Left MAX7219 module · LOAD/CS",
      note: "Candidate GPIO assignment. Its 3.3 V high is below the MAX7219's specified 3.5 V minimum at 5 V, so direct operation needs bench validation. A LOAD rising edge latches the last 16 bits; modules often label LOAD as CS.",
    },
    {
      id: "matrix-load-right", label: "PD11 · right LOAD", color: "#bbab76", state: "Direct · bench validation",
      summary: "A dedicated GPIO LOAD line lets firmware latch updates to the right matrix independently.",
      from: "STM32F407VET6 · PD11 / GPIO",
      to: "Right MAX7219 module · LOAD/CS",
      note: "Candidate GPIO assignment. Its 3.3 V high is below the MAX7219's specified 3.5 V minimum at 5 V, so direct operation needs bench validation. A LOAD rising edge latches the last 16 bits; modules often label LOAD as CS.",
    },
    {
      id: "3v3", label: "3.3 V logic rail", color: "#d5967f", state: "Board output TBD",
      summary: "The candidate 3.3 V logic rail powers PCA9685 logic and provides ST-Link voltage reference.",
      from: "STM32F4VE board · 3.3 V output (if exposed)",
      to: "PCA9685 · VDD; ST-Link · VTref",
      note: "VTref is a voltage reference, not a supply input. Confirm board power routing and module pull-ups before using the 3.3 V header.",
    },
    {
      id: "servo-power", label: "Servo rail · 5–6 V", color: "#eb8c6e", state: "Supply TBD",
      summary: "A separate supply powers the servo rail through the PCA9685 V+ terminal.",
      from: "Regulated servo supply · voltage/current TBD",
      to: "PCA9685 · V+; left and right servo · V+",
      note: "Choose the supply from the exact servo specifications. Do not power servo motors from the MCU board.",
    },
    {
      id: "led-power", label: "Board rail · 5 V matrix power", color: "#efbf67", state: "USB-C capacity check",
      summary: "The board's USB-C-fed 5 V rail powers both matrix modules directly.",
      from: "STM32F4VE board · 5 V header / USB-C rail",
      to: "Both MAX7219 modules · VCC",
      note: "This draft uses the board rail, not a separate matrix supply. Verify the USB-C source and board/header current path can support the MCU board plus both modules. Use a separate 5 V source if that capacity is insufficient.",
    },
    {
      id: "can-power", label: "CAN module · 5 V", color: "#da876c", state: "Module check",
      summary: "The transceiver breakout needs the supply specified by its exact module circuit.",
      from: "Regulated 5 V logic supply",
      to: "MCP2551 module · VDD",
      note: "MCP2551 silicon uses a 5 V supply. Confirm whether the breakout adds regulation, protection, or level shifting.",
    },
    {
      id: "ground", label: "Common ground", color: "#bdc6b8", state: "Isolation check",
      summary: "Logic, transceiver, actuator, and LED supplies need a compatible reference. The adapter may be isolated.",
      from: "MCU GND; supply returns; module GND pins",
      to: "PCA9685, servos, MCP2551, both matrix modules, logic interfaces, ST-Link",
      note: "Do not bond the USB-CAN adapter ground until its isolation design is known. Use the actual breakout ground pins, not the illustrative drawing dimensions.",
    },
  ];

  const netList = document.getElementById("netList");
  const connectionRows = document.getElementById("connectionRows");
  const netDetail = document.getElementById("netDetail");
  const clearButton = document.getElementById("clearNet");
  const diagram = document.getElementById("wiringDiagram");

  function makeNetButton(net) {
    const button = document.createElement("button");
    button.className = "net-option";
    button.type = "button";
    button.dataset.net = net.id;
    button.setAttribute("aria-pressed", "false");
    button.style.setProperty("--net-color", net.color);
    const swatch = document.createElement("span");
    swatch.className = "net-swatch";
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = net.label;
    button.append(swatch, label);
    button.addEventListener("click", () => selectNet(net.id));
    return button;
  }

  function makeRow(net) {
    const row = document.createElement("tr");
    row.className = "connection-row";
    row.dataset.net = net.id;
    const values = [net.label, net.from, net.to, net.note, net.state];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 0 || index === 1 || index === 2) {
        const code = document.createElement("code");
        code.textContent = value;
        cell.append(code);
      } else if (index === 4) {
        const chip = document.createElement("span");
        chip.className = `state-chip${/TBD|check|voltage|candidate|isolation|supply/i.test(value) ? " provisional" : ""}`;
        chip.textContent = value;
        cell.append(chip);
      } else {
        cell.textContent = value;
      }
      row.append(cell);
    });
    row.addEventListener("click", () => selectNet(net.id));
    return row;
  }

  function selectNet(id) {
    const active = nets.find((net) => net.id === id) ?? null;
    diagram.classList.toggle("net-selected", Boolean(active));

    diagram.querySelectorAll(".wire[data-net]").forEach((wire) => {
      const isActive = wire.dataset.net === id;
      wire.classList.toggle("active", Boolean(active && isActive));
      wire.classList.toggle("dimmed", Boolean(active && !isActive));
      wire.setAttribute("aria-pressed", String(Boolean(active && isActive)));
      if (!wire.hasAttribute("tabindex")) wire.setAttribute("tabindex", "0");
      if (!wire.hasAttribute("role")) wire.setAttribute("role", "button");
    });

    diagram.querySelectorAll(".hardware-pin[data-net]").forEach((pin) => {
      const isActive = pin.dataset.net === id;
      pin.classList.toggle("active", Boolean(active && isActive));
      pin.classList.toggle("dimmed", Boolean(active && !isActive));
    });

    netList.querySelectorAll(".net-option").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.net === id));
    });
    connectionRows.querySelectorAll(".connection-row").forEach((row) => {
      row.classList.toggle("active", Boolean(active && row.dataset.net === id));
      row.classList.toggle("dimmed", Boolean(active && row.dataset.net !== id));
    });

    netDetail.textContent = active
      ? `${active.summary} From ${active.from}. To ${active.to}. ${active.note} State: ${active.state}.`
      : "Showing the complete wiring map. Choose a net to inspect its endpoints and notes.";
  }

  nets.forEach((net) => {
    netList.append(makeNetButton(net));
    connectionRows.append(makeRow(net));
  });

  diagram.querySelectorAll(".wire[data-net]").forEach((wire) => {
    const net = nets.find((entry) => entry.id === wire.dataset.net);
    if (net) wire.setAttribute("aria-label", `${net.label}: ${net.summary}`);
    wire.addEventListener("click", () => selectNet(wire.dataset.net));
    wire.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectNet(wire.dataset.net);
      }
    });
  });

  clearButton.addEventListener("click", () => selectNet(null));
  selectNet(null);
})();
