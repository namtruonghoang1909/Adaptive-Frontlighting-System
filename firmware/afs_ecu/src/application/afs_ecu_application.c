/* SPDX-License-Identifier: Apache-2.0 */
#include <afs/application/afs_controller.h>
#include <afs/application/afs_ecu_application.h>
#include <afs/bsw/ecu_abstraction/board_led.h>
#include <afs/bsw/ecu_abstraction/can_bus.h>
#include <afs/bsw/services/communication/can_message_service.h>
#include <afs/rte/afs_rte.h>

#include <errno.h>
#include <stdint.h>

#include <zephyr/kernel.h>
#include <zephyr/sys/printk.h>

#define AFS_STATUS_PERIOD_MS 50
#define AFS_STATUS_TX_TIMEOUT_MS 5
#define AFS_LED_HEARTBEAT_PERIOD_MS 500
#define AFS_RX_POLL_MAX_MS 10
#define AFS_ERROR_LOG_INTERVAL_MS 1000

static int32_t next_wait_ms(int64_t now_ms, int64_t next_status_ms,
			    int64_t next_led_ms)
{
	int64_t wait_ms = MIN(next_status_ms, next_led_ms) - now_ms;

	if (wait_ms <= 0) {
		return 0;
	}
	if (wait_ms > AFS_RX_POLL_MAX_MS) {
		wait_ms = AFS_RX_POLL_MAX_MS;
	}

	return (int32_t)wait_ms;
}

int afs_ecu_application_run(void)
{
	struct afs_can_frame rx_frame;
	struct afs_rte_inputs inputs;
	struct afs_rte_status status;
	int64_t now_ms;
	int64_t next_status_ms;
	int64_t next_led_ms;
	int64_t last_tx_error_log_ms = -AFS_ERROR_LOG_INTERVAL_MS;
	uint8_t status_alive_counter = 0U;
	uint32_t previous_rx_overruns = 0U;
	int err;

	afs_rte_init();
	afs_can_message_service_init();

	err = afs_board_led_init();
	if (err != 0) {
		printk("AFS: board LED unavailable (%d)\n", err);
	}

	err = afs_can_bus_init();
	if (err != 0) {
		printk("AFS: failed to start CAN controller (%d)\n", err);
		return err;
	}

	printk("AFS: CAN communication started at 500 kbit/s\n");
	printk("AFS: reporting Safe_Default until beam and servo drivers are available\n");

	now_ms = k_uptime_get();
	next_status_ms = now_ms;
	next_led_ms = now_ms + AFS_LED_HEARTBEAT_PERIOD_MS;

	while (true) {
		now_ms = k_uptime_get();

		if (now_ms >= next_status_ms) {
			afs_rte_read_inputs(&inputs);
			afs_controller_update(&inputs, now_ms, &status);
			afs_rte_write_status(&status);

			err = afs_can_message_service_send_status(
				status_alive_counter, AFS_STATUS_TX_TIMEOUT_MS);
			status_alive_counter = (uint8_t)((status_alive_counter + 1U) & 0x0fU);
			if ((err != 0) &&
			    ((now_ms - last_tx_error_log_ms) >=
			     AFS_ERROR_LOG_INTERVAL_MS)) {
				printk("AFS: 0x500 status transmit failed (%d)\n", err);
				last_tx_error_log_ms = now_ms;
			}

			do {
				next_status_ms += AFS_STATUS_PERIOD_MS;
			} while (next_status_ms <= now_ms);
		}

		if (now_ms >= next_led_ms) {
			err = afs_board_led_toggle();
			if (err != 0) {
				printk("AFS: board LED toggle failed (%d)\n", err);
			}
			next_led_ms = now_ms + AFS_LED_HEARTBEAT_PERIOD_MS;
		}

		if (afs_can_bus_rx_overruns() != previous_rx_overruns) {
			previous_rx_overruns = afs_can_bus_rx_overruns();
			afs_can_bus_discard_queued_rx();
			afs_can_message_service_note_rx_overrun(k_uptime_get());
			printk("AFS: CAN receive queue overrun (%u total)\n",
			       previous_rx_overruns);
		}

		err = afs_can_bus_receive(&rx_frame,
					  next_wait_ms(now_ms, next_status_ms,
						       next_led_ms));
		if (err == 0) {
			afs_can_message_service_process(&rx_frame, k_uptime_get());
		} else if (err != -EAGAIN) {
			printk("AFS: CAN receive failed (%d)\n", err);
		}
	}
}
