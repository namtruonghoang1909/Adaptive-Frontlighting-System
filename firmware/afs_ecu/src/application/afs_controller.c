/* SPDX-License-Identifier: Apache-2.0 */
#include <afs/application/afs_controller.h>

#include <string.h>

#define AFS_SPEED_TIMEOUT_MS 100
#define AFS_STEERING_TIMEOUT_MS 100
#define AFS_OBJECT_GRID_TIMEOUT_MS 250
#define AFS_DASHBOARD_TIMEOUT_MS 200

static bool input_is_fresh(bool valid, int64_t received_at_ms,
			   int64_t now_ms, int64_t timeout_ms)
{
	return valid && (received_at_ms <= now_ms) &&
	       ((now_ms - received_at_ms) <= timeout_ms);
}

static bool requested_inputs_are_fresh(const struct afs_rte_inputs *inputs,
				       bool dashboard_fresh,
				       bool speed_fresh,
				       bool steering_fresh,
				       bool object_grid_fresh)
{
	if (!dashboard_fresh) {
		return false;
	}

	if (!inputs->dashboard.headlight_power_on) {
		return true;
	}

	switch (inputs->dashboard.requested_mode) {
	case AFS_RTE_MODE_LOW_BEAM_NO_SWIVEL:
	case AFS_RTE_MODE_HIGH_BEAM_NO_DIMMING:
		return true;
	case AFS_RTE_MODE_LOW_BEAM_SWIVEL:
		return speed_fresh && steering_fresh;
	case AFS_RTE_MODE_HIGH_BEAM_DIMMING:
		return object_grid_fresh;
	default:
		return false;
	}
}

void afs_controller_update(const struct afs_rte_inputs *inputs,
			   int64_t now_ms,
			   struct afs_rte_status *status)
{
	bool speed_fresh;
	bool steering_fresh;
	bool object_grid_fresh;
	bool dashboard_fresh;

	if ((inputs == NULL) || (status == NULL)) {
		return;
	}

	memset(status, 0, sizeof(*status));
	speed_fresh = input_is_fresh(inputs->speed.valid,
				     inputs->speed.received_at_ms, now_ms,
				     AFS_SPEED_TIMEOUT_MS);
	steering_fresh = input_is_fresh(inputs->steering.valid,
					inputs->steering.received_at_ms, now_ms,
					AFS_STEERING_TIMEOUT_MS);
	object_grid_fresh = input_is_fresh(inputs->object_grid.valid,
					   inputs->object_grid.received_at_ms,
					   now_ms, AFS_OBJECT_GRID_TIMEOUT_MS);
	dashboard_fresh = input_is_fresh(inputs->dashboard.valid,
					 inputs->dashboard.received_at_ms, now_ms,
					 AFS_DASHBOARD_TIMEOUT_MS);

	status->speed_stale = !speed_fresh;
	status->steering_stale = !steering_fresh;
	status->object_stale = !object_grid_fresh;
	status->dashboard_stale = !dashboard_fresh;
	status->required_inputs_valid = requested_inputs_are_fresh(
		inputs, dashboard_fresh, speed_fresh, steering_fresh,
		object_grid_fresh);

	/* The beam and servo drivers are not implemented in this CAN milestone.
	 * Report the conservative requested fallback and make the unavailable
	 * output paths explicit instead of claiming an output was applied.
	 */
	status->safe_fallback = true;
	status->executed_mode = AFS_RTE_EXECUTED_SAFE_DEFAULT;
	status->health_state = AFS_RTE_HEALTH_SAFE_FALLBACK;
	status->servo_control_lost = true;
	status->beam_control_lost = true;
	status->can_decode_fault = inputs->can_decode_fault;
	status->fault_present = status->steering_stale || status->speed_stale ||
		status->object_stale || status->dashboard_stale ||
		status->servo_control_lost || status->servo_mismatch ||
		status->beam_control_lost || status->can_decode_fault;
}
