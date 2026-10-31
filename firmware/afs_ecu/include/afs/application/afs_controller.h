/* SPDX-License-Identifier: Apache-2.0 */
#ifndef AFS_APPLICATION_AFS_CONTROLLER_H_
#define AFS_APPLICATION_AFS_CONTROLLER_H_

#include <afs/rte/afs_rte.h>

void afs_controller_update(const struct afs_rte_inputs *inputs,
			   int64_t now_ms,
			   struct afs_rte_status *status);

#endif /* AFS_APPLICATION_AFS_CONTROLLER_H_ */
