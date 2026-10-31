/* SPDX-License-Identifier: Apache-2.0 */
#include <afs/bsw/services/communication/can_rx_log.h>

#include <errno.h>
#include <stdio.h>

int afs_can_rx_log_format(const struct afs_can_frame *frame, char *buffer,
			  size_t buffer_size)
{
	int written;
	size_t used;

	if ((buffer != NULL) && (buffer_size > 0U)) {
		buffer[0] = '\0';
	}
	if ((frame == NULL) || (buffer == NULL) || (buffer_size == 0U) ||
	    (frame->id > 0x7ffU) || (frame->dlc > AFS_CAN_BUS_MAX_DLEN)) {
		return -EINVAL;
	}

	written = snprintf(buffer, buffer_size, "AFS: CAN RX 0x%03X dlc=%u",
			   (unsigned int)frame->id, (unsigned int)frame->dlc);
	if ((written < 0) || ((size_t)written >= buffer_size)) {
		buffer[0] = '\0';
		return -ENOSPC;
	}
	used = (size_t)written;

	if (frame->is_remote_frame != 0U) {
		written = snprintf(buffer + used, buffer_size - used, " RTR");
		if ((written < 0) || ((size_t)written >= buffer_size - used)) {
			buffer[0] = '\0';
			return -ENOSPC;
		}
		used += (size_t)written;
	} else {
		written = snprintf(buffer + used, buffer_size - used, " data=");
		if ((written < 0) || ((size_t)written >= buffer_size - used)) {
			buffer[0] = '\0';
			return -ENOSPC;
		}
		used += (size_t)written;

		for (size_t i = 0U; i < frame->dlc; ++i) {
			written = snprintf(buffer + used, buffer_size - used,
					   "%s%02X", (i == 0U) ? "" : " ",
					   (unsigned int)frame->data[i]);
			if ((written < 0) || ((size_t)written >= buffer_size - used)) {
				buffer[0] = '\0';
				return -ENOSPC;
			}
			used += (size_t)written;
		}
	}

	return (int)used;
}
