/* SPDX-License-Identifier: Apache-2.0 */
#include <afs/bsw/ecu_abstraction/board_led.h>

#include <errno.h>

#include <zephyr/devicetree.h>
#include <zephyr/drivers/gpio.h>

#if !DT_NODE_EXISTS(DT_ALIAS(led0))
#error "The selected board must define the led0 devicetree alias"
#endif

static const struct gpio_dt_spec board_led = GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);

int afs_board_led_init(void)
{
	if (!gpio_is_ready_dt(&board_led)) {
		return -ENODEV;
	}

	return gpio_pin_configure_dt(&board_led, GPIO_OUTPUT_INACTIVE);
}

int afs_board_led_toggle(void)
{
	return gpio_pin_toggle_dt(&board_led);
}
