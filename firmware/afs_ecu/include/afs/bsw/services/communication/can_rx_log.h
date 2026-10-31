/* SPDX-License-Identifier: Apache-2.0 */
#ifndef AFS_BSW_SERVICES_COMMUNICATION_CAN_RX_LOG_H_
#define AFS_BSW_SERVICES_COMMUNICATION_CAN_RX_LOG_H_

#include <afs/bsw/ecu_abstraction/can_bus.h>

#include <stddef.h>

#define AFS_CAN_RX_LOG_BUFFER_SIZE 64U

/* Format one received frame for the temporary RTT bench log. Returns the
 * formatted character count, or a negative errno value on invalid input or
 * insufficient output space.
 */
int afs_can_rx_log_format(const struct afs_can_frame *frame, char *buffer,
			  size_t buffer_size);

#endif /* AFS_BSW_SERVICES_COMMUNICATION_CAN_RX_LOG_H_ */
