/* SPDX-License-Identifier: Apache-2.0 */
#ifndef AFS_BSW_SERVICES_COMMUNICATION_CAN_MESSAGE_SERVICE_H_
#define AFS_BSW_SERVICES_COMMUNICATION_CAN_MESSAGE_SERVICE_H_

#include <afs/bsw/ecu_abstraction/can_bus.h>

#include <stdint.h>

void afs_can_message_service_init(void);
void afs_can_message_service_process(const struct afs_can_frame *frame,
				    int64_t now_ms);
void afs_can_message_service_note_rx_overrun(int64_t now_ms);
int afs_can_message_service_send_status(uint8_t alive_counter,
					int32_t timeout_ms);

#endif /* AFS_BSW_SERVICES_COMMUNICATION_CAN_MESSAGE_SERVICE_H_ */
