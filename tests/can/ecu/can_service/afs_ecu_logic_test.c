/* SPDX-License-Identifier: Apache-2.0 */
#include <afs/application/afs_controller.h>
#include <afs/bsw/services/communication/can_rx_log.h>
#include <afs/bsw/services/communication/can_message_service.h>
#include <afs/rte/afs_rte.h>

#include <afs.h>

#include <errno.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define CHECK(condition) do { \
	if (!(condition)) { \
		fprintf(stderr, "%s:%d: %s failed\n", __FILE__, __LINE__, #condition); \
		return false; \
	} \
} while (0)

static struct afs_can_frame last_sent_frame;
static int32_t last_timeout_ms;
static unsigned int send_count;

int afs_can_bus_send(const struct afs_can_frame *frame, int32_t timeout_ms)
{
	last_sent_frame = *frame;
	last_timeout_ms = timeout_ms;
	send_count++;
	return 0;
}

static void reset_state(void)
{
	afs_rte_init();
	afs_can_message_service_init();
	memset(&last_sent_frame, 0, sizeof(last_sent_frame));
	last_timeout_ms = 0;
	send_count = 0;
}

static struct afs_can_frame speed_frame(uint8_t counter, int16_t raw_speed)
{
	struct afs_can_frame frame = {
		.id = AFS_VEHICLE_SPEED_FRAME_ID,
		.dlc = AFS_VEHICLE_SPEED_LENGTH,
	};

	frame.data[0] = (uint8_t)((counter & 0x0fU) | 0x10U);
	frame.data[1] = (uint8_t)raw_speed;
	frame.data[2] = (uint8_t)((uint16_t)raw_speed >> 8);
	return frame;
}

static struct afs_can_frame command_frame(uint8_t counter,
					   bool valid, bool clear_fault)
{
	struct afs_can_frame frame = {
		.id = AFS_DASHBOARD_COMMAND_FRAME_ID,
		.dlc = AFS_DASHBOARD_COMMAND_LENGTH,
	};

	frame.data[0] = (uint8_t)((counter & 0x0fU) |
				 (valid ? 0x10U : 0U) |
				 (clear_fault ? 0x20U : 0U));
	frame.data[1] = 0x07U; /* Power on, high beam with dimming. */
	frame.data[2] = (uint8_t)(frame.data[0] ^ frame.data[1]);
	return frame;
}

static struct afs_rte_inputs read_inputs(void)
{
	struct afs_rte_inputs inputs = {0};

	afs_rte_read_inputs(&inputs);
	return inputs;
}

static bool counter_policy(void)
{
	struct afs_can_frame frame;
	struct afs_rte_inputs inputs;

	reset_state();
	frame = speed_frame(15U, 1234);
	afs_can_message_service_process(&frame, 0);
	inputs = read_inputs();
	CHECK(inputs.speed.valid);
	CHECK(inputs.speed.centi_meters_per_second == 1234);

	afs_can_message_service_process(&frame, 20); /* Duplicate. */
	inputs = read_inputs();
	CHECK(!inputs.speed.valid);
	CHECK(inputs.can_decode_fault);

	frame = speed_frame(0U, 567);
	afs_can_message_service_process(&frame, 40); /* Counter wrap. */
	inputs = read_inputs();
	CHECK(inputs.speed.valid);
	CHECK(inputs.speed.centi_meters_per_second == 567);

	frame = speed_frame(9U, 999);
	afs_can_message_service_process(&frame, 60); /* Forward gap > 8. */
	CHECK(!read_inputs().speed.valid);

	frame = speed_frame(7U, 777);
	afs_can_message_service_process(&frame, 540); /* 500 ms since accepted. */
	inputs = read_inputs();
	CHECK(inputs.speed.valid);
	CHECK(inputs.speed.centi_meters_per_second == 777);
	return true;
}

static bool freshness_and_fallback(void)
{
	struct afs_rte_inputs inputs = {0};
	struct afs_rte_status status = {0};

	inputs.speed = (struct afs_rte_speed_input){.valid = true, .received_at_ms = 1000};
	inputs.steering = (struct afs_rte_steering_input){.valid = true, .received_at_ms = 1000};
	inputs.object_grid = (struct afs_rte_object_grid_input){.valid = true, .received_at_ms = 1000};
	inputs.dashboard = (struct afs_rte_dashboard_input){
		.valid = true, .headlight_power_on = true,
		.requested_mode = AFS_RTE_MODE_LOW_BEAM_SWIVEL, .received_at_ms = 1000,
	};
	afs_controller_update(&inputs, 1100, &status);
	CHECK(status.required_inputs_valid);
	CHECK(!status.speed_stale && !status.steering_stale);
	CHECK(status.safe_fallback);
	CHECK(status.executed_mode == AFS_RTE_EXECUTED_SAFE_DEFAULT);
	CHECK(status.beam_control_lost && status.servo_control_lost);

	afs_controller_update(&inputs, 1101, &status);
	CHECK(!status.required_inputs_valid);
	CHECK(status.speed_stale && status.steering_stale);

	inputs.dashboard.requested_mode = AFS_RTE_MODE_HIGH_BEAM_DIMMING;
	afs_controller_update(&inputs, 1250, &status);
	CHECK(status.required_inputs_valid == false); /* Command expired at 1201. */
	inputs.dashboard.received_at_ms = 1250;
	afs_controller_update(&inputs, 1250, &status);
	CHECK(status.required_inputs_valid);
	afs_controller_update(&inputs, 1251, &status);
	CHECK(!status.required_inputs_valid && status.object_stale);

	inputs.dashboard.headlight_power_on = false;
	afs_controller_update(&inputs, 1251, &status);
	CHECK(status.required_inputs_valid);
	CHECK(status.safe_fallback);
	return true;
}

static bool frame_validation(void)
{
	struct afs_can_frame frame;
	struct afs_rte_inputs inputs;
	struct afs_vehicle_object_t object = {
		.grid_valid = 1U, .sector00_occupied = 1U,
		.sector00_subsector_mask = 15U,
	};

	reset_state();
	frame = (struct afs_can_frame){.id = AFS_VEHICLE_STEERING_FRAME_ID,
					   .dlc = AFS_VEHICLE_STEERING_LENGTH};
	frame.data[0] = 0x13U; /* Counter 3, SteeringValid. */
	frame.data[1] = 0xe7U; /* -2.5 degrees in deci-degrees. */
	frame.data[2] = 0xffU;
	afs_can_message_service_process(&frame, 20);
	inputs = read_inputs();
	CHECK(inputs.steering.valid && inputs.steering.deci_degrees == -25);
	frame.is_remote_frame = 1U;
	afs_can_message_service_process(&frame, 40);
	CHECK(!read_inputs().steering.valid);

	frame = (struct afs_can_frame){.id = AFS_VEHICLE_OBJECT_FRAME_ID,
					   .dlc = AFS_VEHICLE_OBJECT_LENGTH};
	CHECK(afs_vehicle_object_pack(frame.data, &object, sizeof(frame.data)) == 8);
	afs_can_message_service_process(&frame, 100);
	inputs = read_inputs();
	CHECK(inputs.object_grid.valid);
	CHECK(inputs.object_grid.subsector_mask[0] == 15U);

	object.sector00_subsector_mask = 5U; /* Not a cumulative mask. */
	CHECK(afs_vehicle_object_pack(frame.data, &object, sizeof(frame.data)) == 8);
	afs_can_message_service_process(&frame, 120);
	inputs = read_inputs();
	CHECK(!inputs.object_grid.valid && inputs.can_decode_fault);

	frame = command_frame(1U, true, true);
	frame.data[2] ^= 1U; /* Bad checksum. */
	afs_can_message_service_process(&frame, 140);
	CHECK(!read_inputs().dashboard.valid);
	frame.data[2] ^= 1U;
	afs_can_message_service_process(&frame, 160); /* Rising clear-fault pulse. */
	inputs = read_inputs();
	CHECK(inputs.dashboard.valid);
	CHECK(inputs.dashboard.requested_mode == AFS_RTE_MODE_HIGH_BEAM_DIMMING);
	CHECK(!inputs.can_decode_fault);

	afs_can_message_service_note_rx_overrun(180);
	inputs = read_inputs();
	CHECK(!inputs.speed.valid && !inputs.steering.valid);
	CHECK(!inputs.object_grid.valid && !inputs.dashboard.valid);
	CHECK(inputs.can_decode_fault);
	return true;
}

static bool command_lease_and_clear_fault_edge(void)
{
	struct afs_can_frame frame;
	struct afs_rte_inputs inputs;

	reset_state();
	frame = command_frame(0U, true, false);
	afs_can_message_service_process(&frame, 100);
	CHECK(read_inputs().dashboard.valid);

	frame = command_frame(1U, false, false);
	afs_can_message_service_process(&frame, 150);
	CHECK(!read_inputs().dashboard.valid); /* Invalid does not renew the lease. */

	frame = command_frame(2U, true, false);
	afs_can_message_service_process(&frame, 200);
	CHECK(read_inputs().dashboard.valid);

	frame = speed_frame(0U, 100);
	frame.data[0] |= 0x40U; /* Reserved bit. */
	afs_can_message_service_process(&frame, 220);
	CHECK(read_inputs().can_decode_fault);

	frame = command_frame(3U, true, true);
	afs_can_message_service_process(&frame, 250);
	CHECK(!read_inputs().can_decode_fault);

	frame = speed_frame(1U, 100);
	frame.data[0] |= 0x40U;
	afs_can_message_service_process(&frame, 270);
	CHECK(read_inputs().can_decode_fault);
	frame = command_frame(4U, true, true);
	afs_can_message_service_process(&frame, 300);
	inputs = read_inputs();
	CHECK(inputs.can_decode_fault); /* Held request is not a second pulse. */
	CHECK(inputs.dashboard.valid);

	frame = command_frame(5U, true, false);
	afs_can_message_service_process(&frame, 350);
	frame = command_frame(6U, true, true);
	afs_can_message_service_process(&frame, 400);
	CHECK(!read_inputs().can_decode_fault);
	return true;
}

static bool status_encoding(void)
{
	struct afs_rte_status status = {
		.required_inputs_valid = true,
		.fault_present = true,
		.safe_fallback = true,
		.executed_mode = AFS_RTE_EXECUTED_SAFE_DEFAULT,
		.health_state = AFS_RTE_HEALTH_SAFE_FALLBACK,
		.object_stale = true,
		.beam_control_lost = true,
		.can_decode_fault = true,
		.applied_dim_sector_mask = 0x0123U,
	};
	struct afs_afs_status_t decoded = {0};
	uint8_t checksum = 0U;

	reset_state();
	afs_rte_write_status(&status);
	CHECK(afs_can_message_service_send_status(18U, 7) == 0);
	CHECK(send_count == 1U && last_timeout_ms == 7);
	CHECK(last_sent_frame.id == AFS_AFS_STATUS_FRAME_ID);
	CHECK(last_sent_frame.dlc == AFS_AFS_STATUS_LENGTH);
	CHECK(afs_afs_status_unpack(&decoded, last_sent_frame.data,
				    sizeof(last_sent_frame.data)) == 0);
	CHECK(decoded.alive_counter == 2U);
	CHECK(decoded.required_inputs_valid == 1U);
	CHECK(decoded.executed_mode == AFS_RTE_EXECUTED_SAFE_DEFAULT);
	CHECK(decoded.object_stale == 1U);
	CHECK(decoded.beam_control_lost == 1U);
	CHECK(decoded.can_decode_fault == 1U);
	CHECK(decoded.applied_dim_sector_mask == 0x0123U);
	for (unsigned int i = 0U; i < 7U; ++i) {
		checksum ^= last_sent_frame.data[i];
	}
	CHECK(last_sent_frame.data[7] == checksum);
	return true;
}

static bool rx_log_format(void)
{
	struct afs_can_frame frame = {
		.id = AFS_VEHICLE_SPEED_FRAME_ID,
		.dlc = 3U,
		.data = {0x12U, 0x34U, 0xABU},
	};
	char line[AFS_CAN_RX_LOG_BUFFER_SIZE];
	const char *expected = "AFS: CAN RX 0x100 dlc=3 data=12 34 AB";

	CHECK(afs_can_rx_log_format(&frame, line, sizeof(line)) ==
	      (int)strlen(expected));
	CHECK(strcmp(line, expected) == 0);

	frame.is_remote_frame = 1U;
	expected = "AFS: CAN RX 0x100 dlc=3 RTR";
	CHECK(afs_can_rx_log_format(&frame, line, sizeof(line)) ==
	      (int)strlen(expected));
	CHECK(strcmp(line, expected) == 0);

	CHECK(afs_can_rx_log_format(&frame, line, 8U) == -ENOSPC);
	frame.id = 0x800U;
	CHECK(afs_can_rx_log_format(&frame, line, sizeof(line)) == -EINVAL);
	frame.id = AFS_VEHICLE_SPEED_FRAME_ID;
	frame.dlc = AFS_CAN_BUS_MAX_DLEN + 1U;
	CHECK(afs_can_rx_log_format(&frame, line, sizeof(line)) == -EINVAL);
	CHECK(afs_can_rx_log_format(NULL, line, sizeof(line)) == -EINVAL);
	return true;
}

int main(int argc, char **argv)
{
	struct {
		const char *name;
		bool (*run)(void);
	} cases[] = {
		{"counter_policy", counter_policy},
		{"freshness_and_fallback", freshness_and_fallback},
		{"frame_validation", frame_validation},
		{"command_lease_and_clear_fault_edge", command_lease_and_clear_fault_edge},
		{"status_encoding", status_encoding},
		{"rx_log_format", rx_log_format},
	};

	if (argc != 2) {
		fprintf(stderr, "Usage: %s CASE_NAME\n", argv[0]);
		return 2;
	}
	for (size_t i = 0U; i < sizeof(cases) / sizeof(cases[0]); ++i) {
		if (strcmp(argv[1], cases[i].name) == 0) {
			return cases[i].run() ? 0 : 1;
		}
	}
	fprintf(stderr, "Unknown test case: %s\n", argv[1]);
	return 2;
}
