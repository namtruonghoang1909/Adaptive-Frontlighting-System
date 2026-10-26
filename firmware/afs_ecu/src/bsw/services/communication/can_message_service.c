/* SPDX-License-Identifier: Apache-2.0 */
#include <afs/bsw/services/communication/can_message_service.h>

#include <afs/rte/afs_rte.h>

#include <errno.h>
#include <string.h>

#include <zephyr/sys/util.h>

#include <afs.h>

#define AFS_CAN_COUNTER_RESTART_TIMEOUT_MS 500
#define AFS_CAN_COUNTER_MAX_FORWARD_GAP 8U

enum input_counter_index {
	INPUT_COUNTER_SPEED,
	INPUT_COUNTER_STEERING,
	INPUT_COUNTER_DASHBOARD,
	INPUT_COUNTER_COUNT,
};

struct input_counter_state {
	bool initialized;
	uint8_t value;
	int64_t accepted_at_ms;
};

static struct input_counter_state input_counters[INPUT_COUNTER_COUNT];
static bool can_decode_fault_latched;
static bool last_clear_fault_request;

static void set_decode_fault(void)
{
	can_decode_fault_latched = true;
	afs_rte_write_can_decode_fault(true);
}

static void invalidate_input(uint16_t id, int64_t now_ms)
{
	switch (id) {
	case AFS_VEHICLE_SPEED_FRAME_ID: {
		const struct afs_rte_speed_input input = {
			.received_at_ms = now_ms,
		};

		afs_rte_write_speed(&input);
		break;
	}
	case AFS_VEHICLE_STEERING_FRAME_ID: {
		const struct afs_rte_steering_input input = {
			.received_at_ms = now_ms,
		};

		afs_rte_write_steering(&input);
		break;
	}
	case AFS_VEHICLE_OBJECT_FRAME_ID: {
		const struct afs_rte_object_grid_input input = {
			.received_at_ms = now_ms,
		};

		afs_rte_write_object_grid(&input);
		break;
	}
	case AFS_DASHBOARD_COMMAND_FRAME_ID: {
		const struct afs_rte_dashboard_input input = {
			.received_at_ms = now_ms,
		};

		afs_rte_write_dashboard(&input);
		last_clear_fault_request = false;
		break;
	}
	default:
		break;
	}
}

static void invalidate_all_inputs(int64_t now_ms)
{
	invalidate_input(AFS_VEHICLE_SPEED_FRAME_ID, now_ms);
	invalidate_input(AFS_VEHICLE_STEERING_FRAME_ID, now_ms);
	invalidate_input(AFS_VEHICLE_OBJECT_FRAME_ID, now_ms);
	invalidate_input(AFS_DASHBOARD_COMMAND_FRAME_ID, now_ms);
}

static bool counter_is_acceptable(enum input_counter_index index,
				  uint8_t value, int64_t now_ms)
{
	struct input_counter_state *state = &input_counters[index];
	uint8_t forward_delta;

	if (!state->initialized) {
		state->initialized = true;
		state->value = value;
		state->accepted_at_ms = now_ms;
		return true;
	}

	if (now_ms < state->accepted_at_ms) {
		return false;
	}

	if ((now_ms - state->accepted_at_ms) >= AFS_CAN_COUNTER_RESTART_TIMEOUT_MS) {
		state->value = value;
		state->accepted_at_ms = now_ms;
		return true;
	}

	forward_delta = (uint8_t)((value - state->value) & 0x0fU);
	if ((forward_delta == 0U) ||
	    (forward_delta > AFS_CAN_COUNTER_MAX_FORWARD_GAP)) {
		return false;
	}

	state->value = value;
	state->accepted_at_ms = now_ms;
	return true;
}

static bool legal_subsector_mask(uint8_t mask)
{
	return (mask == 0U) || (mask == 1U) || (mask == 3U) ||
	       (mask == 7U) || (mask == 15U);
}

static bool decode_vehicle_speed(const struct afs_can_frame *frame,
				 int64_t now_ms)
{
	struct afs_vehicle_speed_t signals = {0};
	struct afs_rte_speed_input input = {0};

	if ((frame->is_remote_frame != 0U) ||
	    (frame->dlc != AFS_VEHICLE_SPEED_LENGTH) ||
	    (afs_vehicle_speed_unpack(&signals, frame->data, frame->dlc) < 0) ||
	    (signals.speed_reserved_bits6_7 != 0U) ||
	    (signals.speed_reserved_byte3 != 0U) ||
	    (signals.speed_reserved_bytes4_to6 != 0U) ||
	    (signals.speed_reserved_byte7 != 0U) ||
	    ((signals.speed_valid != 0U) && (signals.speed_valid != 1U)) ||
	    ((signals.speed_saturated != 0U) &&
	     (signals.speed_saturated != 1U)) ||
	    ((signals.speed_valid != 0U) &&
	     (signals.speed_saturated != 0U)) ||
	    !counter_is_acceptable(INPUT_COUNTER_SPEED, signals.alive_counter,
			       now_ms)) {
		return false;
	}

	input.valid = signals.speed_valid != 0U;
	input.centi_meters_per_second = input.valid ?
		signals.longitudinal_speed_mps : 0;
	input.received_at_ms = now_ms;
	afs_rte_write_speed(&input);
	return true;
}

static bool decode_vehicle_steering(const struct afs_can_frame *frame,
				    int64_t now_ms)
{
	struct afs_vehicle_steering_t signals = {0};
	struct afs_rte_steering_input input = {0};

	if ((frame->is_remote_frame != 0U) ||
	    (frame->dlc != AFS_VEHICLE_STEERING_LENGTH) ||
	    (afs_vehicle_steering_unpack(&signals, frame->data, frame->dlc) < 0) ||
	    (signals.steering_reserved_bits6_7 != 0U) ||
	    (signals.steering_reserved_byte3 != 0U) ||
	    (signals.steering_reserved_bytes4_to6 != 0U) ||
	    (signals.steering_reserved_byte7 != 0U) ||
	    ((signals.steering_valid != 0U) &&
	     (signals.steering_valid != 1U)) ||
	    ((signals.steering_saturated != 0U) &&
	     (signals.steering_saturated != 1U)) ||
	    ((signals.steering_valid != 0U) &&
	     (signals.steering_saturated != 0U)) ||
	    !counter_is_acceptable(INPUT_COUNTER_STEERING,
			       signals.alive_counter, now_ms)) {
		return false;
	}

	input.valid = signals.steering_valid != 0U;
	input.deci_degrees = input.valid ? signals.steering_angle_deg : 0;
	input.received_at_ms = now_ms;
	afs_rte_write_steering(&input);
	return true;
}

static bool decode_vehicle_object(const struct afs_can_frame *frame,
				  int64_t now_ms)
{
	struct afs_vehicle_object_t signals = {0};
	struct afs_rte_object_grid_input input = {0};
	uint8_t occupied[AFS_RTE_SECTOR_COUNT];
	uint8_t masks[AFS_RTE_SECTOR_COUNT];

	if ((frame->is_remote_frame != 0U) ||
	    (frame->dlc != AFS_VEHICLE_OBJECT_LENGTH) ||
	    (afs_vehicle_object_unpack(&signals, frame->data, frame->dlc) < 0) ||
	    (signals.object_reserved_byte0 != 0U) ||
	    (signals.object_reserved_bits61_63 != 0U) ||
	    (signals.grid_valid > 1U) ||
	    (signals.perception_degraded > 1U) ||
	    (signals.object_list_overflow > 1U) ||
	    ((signals.grid_valid != 0U) &&
	     ((signals.perception_degraded != 0U) ||
	      (signals.object_list_overflow != 0U))) ||
	    ((signals.object_list_overflow != 0U) &&
	     (signals.perception_degraded == 0U))) {
		return false;
	}

	occupied[0] = signals.sector00_occupied;
	occupied[1] = signals.sector01_occupied;
	occupied[2] = signals.sector02_occupied;
	occupied[3] = signals.sector03_occupied;
	occupied[4] = signals.sector04_occupied;
	occupied[5] = signals.sector05_occupied;
	occupied[6] = signals.sector06_occupied;
	occupied[7] = signals.sector07_occupied;
	occupied[8] = signals.sector08_occupied;
	occupied[9] = signals.sector09_occupied;

	masks[0] = signals.sector00_subsector_mask;
	masks[1] = signals.sector01_subsector_mask;
	masks[2] = signals.sector02_subsector_mask;
	masks[3] = signals.sector03_subsector_mask;
	masks[4] = signals.sector04_subsector_mask;
	masks[5] = signals.sector05_subsector_mask;
	masks[6] = signals.sector06_subsector_mask;
	masks[7] = signals.sector07_subsector_mask;
	masks[8] = signals.sector08_subsector_mask;
	masks[9] = signals.sector09_subsector_mask;

	for (size_t i = 0U; i < AFS_RTE_SECTOR_COUNT; ++i) {
		if ((signals.grid_valid != 0U) &&
		    ((occupied[i] > 1U) || !legal_subsector_mask(masks[i]) ||
		     ((occupied[i] != 0U) != (masks[i] != 0U)))) {
			return false;
		}
	}

	input.valid = signals.grid_valid != 0U;
	input.perception_degraded = signals.perception_degraded != 0U;
	input.object_list_overflow = signals.object_list_overflow != 0U;
	input.received_at_ms = now_ms;
	if (input.valid) {
		memcpy(input.occupied, occupied, sizeof(occupied));
		memcpy(input.subsector_mask, masks, sizeof(masks));
	}

	afs_rte_write_object_grid(&input);
	return true;
}

static bool decode_dashboard_command(const struct afs_can_frame *frame,
				     int64_t now_ms)
{
	struct afs_dashboard_command_t signals = {0};
	struct afs_rte_dashboard_input input = {0};
	uint8_t checksum;

	if ((frame->is_remote_frame != 0U) ||
	    (frame->dlc != AFS_DASHBOARD_COMMAND_LENGTH) ||
	    (afs_dashboard_command_unpack(&signals, frame->data, frame->dlc) < 0)) {
		return false;
	}

	checksum = (uint8_t)(frame->data[0] ^ frame->data[1]);
	if ((signals.checksum != checksum) ||
	    (signals.command_reserved_bits6_7 != 0U) ||
	    (signals.command_reserved_bits12_15 != 0U) ||
	    (signals.command_valid > 1U) ||
	    (signals.clear_fault_request > 1U) ||
	    (signals.requested_headlight_power > 1U) ||
	    (signals.requested_headlight_mode > AFS_RTE_MODE_HIGH_BEAM_DIMMING) ||
	    !counter_is_acceptable(INPUT_COUNTER_DASHBOARD, signals.alive_counter,
			       now_ms)) {
		return false;
	}

	if (signals.command_valid == 0U) {
		/* Invalid commands do not renew the dashboard command lease. */
		last_clear_fault_request = false;
		afs_rte_write_dashboard(&input);
		return true;
	}

	if ((signals.clear_fault_request != 0U) &&
	    !last_clear_fault_request) {
		can_decode_fault_latched = false;
		afs_rte_write_can_decode_fault(false);
	}
	last_clear_fault_request = signals.clear_fault_request != 0U;

	input.valid = true;
	input.headlight_power_on = signals.requested_headlight_power != 0U;
	input.requested_mode = signals.requested_headlight_mode;
	input.clear_fault_request = signals.clear_fault_request != 0U;
	input.received_at_ms = now_ms;
	afs_rte_write_dashboard(&input);
	return true;
}

void afs_can_message_service_init(void)
{
	memset(input_counters, 0, sizeof(input_counters));
	can_decode_fault_latched = false;
	last_clear_fault_request = false;
	afs_rte_write_can_decode_fault(false);
}

void afs_can_message_service_process(const struct afs_can_frame *frame,
				    int64_t now_ms)
{
	bool accepted = true;

	if ((frame == NULL) || (now_ms < 0)) {
		if (now_ms >= 0) {
			invalidate_all_inputs(now_ms);
		}
		set_decode_fault();
		return;
	}

	switch (frame->id) {
	case AFS_VEHICLE_SPEED_FRAME_ID:
		accepted = decode_vehicle_speed(frame, now_ms);
		break;
	case AFS_VEHICLE_STEERING_FRAME_ID:
		accepted = decode_vehicle_steering(frame, now_ms);
		break;
	case AFS_VEHICLE_OBJECT_FRAME_ID:
		accepted = decode_vehicle_object(frame, now_ms);
		break;
	case AFS_DASHBOARD_COMMAND_FRAME_ID:
		accepted = decode_dashboard_command(frame, now_ms);
		break;
	default:
		/* The bus filter accepts standard frames so this service can remain
		 * independent of the set of IDs used by the rest of the vehicle.
		 */
		return;
	}

	if (!accepted) {
		invalidate_input(frame->id, now_ms);
		set_decode_fault();
	}
}

void afs_can_message_service_note_rx_overrun(int64_t now_ms)
{
	if (now_ms >= 0) {
		invalidate_all_inputs(now_ms);
	}
	set_decode_fault();
}

int afs_can_message_service_send_status(uint8_t alive_counter,
					int32_t timeout_ms)
{
	struct afs_rte_status status = {0};
	struct afs_afs_status_t signals = {0};
	struct afs_can_frame frame = {
		.id = AFS_AFS_STATUS_FRAME_ID,
		.dlc = AFS_AFS_STATUS_LENGTH,
	};
	uint8_t checksum = 0U;
	int err;

	afs_rte_read_status(&status);

	signals.alive_counter = (uint8_t)(alive_counter & 0x0fU);
	signals.required_inputs_valid = status.required_inputs_valid;
	signals.fault_present = status.fault_present;
	signals.safe_fallback = status.safe_fallback;
	signals.executed_mode = status.executed_mode;
	signals.health_state = status.health_state;
	signals.steering_stale = status.steering_stale;
	signals.speed_stale = status.speed_stale;
	signals.object_stale = status.object_stale;
	signals.dashboard_stale = status.dashboard_stale;
	signals.servo_control_lost = status.servo_control_lost;
	signals.servo_mismatch = status.servo_mismatch;
	signals.beam_control_lost = status.beam_control_lost;
	signals.can_decode_fault = status.can_decode_fault;
	signals.left_servo_feedback_deg = status.left_servo_feedback_half_degrees;
	signals.right_servo_feedback_deg = status.right_servo_feedback_half_degrees;
	signals.applied_dim_sector_mask = status.applied_dim_sector_mask;

	err = afs_afs_status_pack(frame.data, &signals, sizeof(frame.data));
	if (err != AFS_AFS_STATUS_LENGTH) {
		return (err < 0) ? err : -EINVAL;
	}

	for (size_t i = 0U; i < AFS_AFS_STATUS_LENGTH - 1U; ++i) {
		checksum ^= frame.data[i];
	}
	signals.checksum = checksum;

	err = afs_afs_status_pack(frame.data, &signals, sizeof(frame.data));
	if (err != AFS_AFS_STATUS_LENGTH) {
		return (err < 0) ? err : -EINVAL;
	}

	return afs_can_bus_send(&frame, timeout_ms);
}
