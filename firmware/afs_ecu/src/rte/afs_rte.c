/* SPDX-License-Identifier: Apache-2.0 */
#include <afs/rte/afs_rte.h>

#include <string.h>

static struct afs_rte_inputs rte_inputs;
static struct afs_rte_status rte_status;

void afs_rte_init(void)
{
	memset(&rte_inputs, 0, sizeof(rte_inputs));
	memset(&rte_status, 0, sizeof(rte_status));
}

void afs_rte_write_speed(const struct afs_rte_speed_input *input)
{
	if (input != NULL) {
		rte_inputs.speed = *input;
	}
}

void afs_rte_write_steering(const struct afs_rte_steering_input *input)
{
	if (input != NULL) {
		rte_inputs.steering = *input;
	}
}

void afs_rte_write_object_grid(const struct afs_rte_object_grid_input *input)
{
	if (input != NULL) {
		rte_inputs.object_grid = *input;
	}
}

void afs_rte_write_dashboard(const struct afs_rte_dashboard_input *input)
{
	if (input != NULL) {
		rte_inputs.dashboard = *input;
	}
}

void afs_rte_write_can_decode_fault(bool active)
{
	rte_inputs.can_decode_fault = active;
}

void afs_rte_read_inputs(struct afs_rte_inputs *inputs)
{
	if (inputs != NULL) {
		*inputs = rte_inputs;
	}
}

void afs_rte_write_status(const struct afs_rte_status *status)
{
	if (status != NULL) {
		rte_status = *status;
	}
}

void afs_rte_read_status(struct afs_rte_status *status)
{
	if (status != NULL) {
		*status = rte_status;
	}
}
