/* SPDX-License-Identifier: Apache-2.0 */
#ifndef AFS_BSW_ECU_ABSTRACTION_CAN_BUS_H_
#define AFS_BSW_ECU_ABSTRACTION_CAN_BUS_H_

#include <stdint.h>

#define AFS_CAN_BUS_MAX_DLEN 8U

struct afs_can_frame {
	uint16_t id;
	uint8_t dlc;
	uint8_t data[AFS_CAN_BUS_MAX_DLEN];
	uint8_t is_remote_frame;
};

/* Initialize the chosen Zephyr CAN controller, add the standard-ID RX filter,
 * and start the controller in normal mode. The selected controller and its
 * pins are described by the board's Devicetree.
 */
int afs_can_bus_init(void);

/* Receive the next matching frame. timeout_ms must be nonnegative. Returns
 * zero on success or a negative errno value, including -EAGAIN on timeout.
 */
int afs_can_bus_receive(struct afs_can_frame *frame, int32_t timeout_ms);

/* Discard any queued frames after detecting RX queue loss so delayed payloads
 * cannot be mistaken for current inputs.
 */
void afs_can_bus_discard_queued_rx(void);

/* Queue a standard CAN data or remote frame for transmission. timeout_ms must
 * be nonnegative. Returns zero on success or a negative errno value.
 */
int afs_can_bus_send(const struct afs_can_frame *frame, int32_t timeout_ms);

/* Number of received frames dropped because the software RX queue was full. */
uint32_t afs_can_bus_rx_overruns(void);

#endif /* AFS_BSW_ECU_ABSTRACTION_CAN_BUS_H_ */
