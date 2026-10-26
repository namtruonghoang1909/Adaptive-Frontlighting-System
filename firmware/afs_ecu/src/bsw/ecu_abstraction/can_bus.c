/* SPDX-License-Identifier: Apache-2.0 */
#include <afs/bsw/ecu_abstraction/can_bus.h>

#include <errno.h>
#include <string.h>

#include <zephyr/device.h>
#include <zephyr/devicetree.h>
#include <zephyr/drivers/can.h>
#include <zephyr/kernel.h>
#include <zephyr/sys/atomic.h>
#include <zephyr/sys/util.h>

#define AFS_CAN_BUS_RX_QUEUE_DEPTH 32U

#if !DT_NODE_EXISTS(DT_CHOSEN(zephyr_canbus))
#error "The selected board must define zephyr,canbus"
#endif

static const struct device *const can_device =
	DEVICE_DT_GET(DT_CHOSEN(zephyr_canbus));

K_MSGQ_DEFINE(can_rx_queue, sizeof(struct can_frame), AFS_CAN_BUS_RX_QUEUE_DEPTH, 4);

static const struct can_filter standard_frame_filter = {
	.flags = 0U,
	.id = 0U,
	.mask = 0U,
};

static atomic_t rx_overrun_count;
static int rx_filter_id = -1;
static bool initialized;

static void can_bus_rx_callback(const struct device *dev, struct can_frame *frame,
				void *user_data)
{
	int err;

	ARG_UNUSED(dev);
	ARG_UNUSED(user_data);

	err = k_msgq_put(&can_rx_queue, frame, K_NO_WAIT);
	if (err != 0) {
		atomic_inc(&rx_overrun_count);
	}
}

int afs_can_bus_init(void)
{
	int err;

	if (initialized) {
		return -EALREADY;
	}

	if (!device_is_ready(can_device)) {
		return -ENODEV;
	}

	/* The CAN message service validates and ignores standard IDs it does not
	 * own. Keeping filtering at the standard-ID level avoids duplicating the
	 * DBC's message list in this hardware-facing adapter.
	 */
	rx_filter_id = can_add_rx_filter(can_device, can_bus_rx_callback, NULL,
					 &standard_frame_filter);
	if (rx_filter_id < 0) {
		return rx_filter_id;
	}

	err = can_start(can_device);
	if (err != 0) {
		can_remove_rx_filter(can_device, rx_filter_id);
		rx_filter_id = -1;
		return err;
	}

	initialized = true;
	return 0;
}

int afs_can_bus_receive(struct afs_can_frame *frame, int32_t timeout_ms)
{
	struct can_frame native_frame;
	int err;

	if ((frame == NULL) || (timeout_ms < 0)) {
		return -EINVAL;
	}
	if (!initialized) {
		return -ENETDOWN;
	}

	err = k_msgq_get(&can_rx_queue, &native_frame, K_MSEC(timeout_ms));
	if (err != 0) {
		return err;
	}

	frame->id = (uint16_t)native_frame.id;
	frame->dlc = native_frame.dlc;
	memcpy(frame->data, native_frame.data, sizeof(frame->data));
	frame->is_remote_frame = (native_frame.flags & CAN_FRAME_RTR) != 0U;

	return 0;
}

void afs_can_bus_discard_queued_rx(void)
{
	k_msgq_purge(&can_rx_queue);
}

int afs_can_bus_send(const struct afs_can_frame *frame, int32_t timeout_ms)
{
	struct can_frame native_frame = {0};

	if ((frame == NULL) || (frame->id > CAN_STD_ID_MASK) ||
	    (frame->dlc > AFS_CAN_BUS_MAX_DLEN) || (timeout_ms < 0)) {
		return -EINVAL;
	}
	if (!initialized) {
		return -ENETDOWN;
	}

	native_frame.id = frame->id;
	native_frame.dlc = frame->dlc;
	if (frame->is_remote_frame != 0U) {
		native_frame.flags |= CAN_FRAME_RTR;
	} else {
		memcpy(native_frame.data, frame->data, frame->dlc);
	}

	return can_send(can_device, &native_frame, K_MSEC(timeout_ms), NULL, NULL);
}

uint32_t afs_can_bus_rx_overruns(void)
{
	return (uint32_t)atomic_get(&rx_overrun_count);
}
