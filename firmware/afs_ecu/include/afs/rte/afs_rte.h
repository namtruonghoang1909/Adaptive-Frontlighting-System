/* SPDX-License-Identifier: Apache-2.0 */
#ifndef AFS_RTE_AFS_RTE_H_
#define AFS_RTE_AFS_RTE_H_

#include <stdbool.h>
#include <stdint.h>

#define AFS_RTE_SECTOR_COUNT 10U

enum afs_rte_dashboard_mode {
	AFS_RTE_MODE_LOW_BEAM_NO_SWIVEL = 0U,
	AFS_RTE_MODE_LOW_BEAM_SWIVEL = 1U,
	AFS_RTE_MODE_HIGH_BEAM_NO_DIMMING = 2U,
	AFS_RTE_MODE_HIGH_BEAM_DIMMING = 3U,
};

enum afs_rte_executed_mode {
	AFS_RTE_EXECUTED_OFF = 0U,
	AFS_RTE_EXECUTED_SAFE_DEFAULT = 1U,
	AFS_RTE_EXECUTED_LOW_BEAM_NO_SWIVEL = 2U,
	AFS_RTE_EXECUTED_LOW_BEAM_SWIVEL = 3U,
	AFS_RTE_EXECUTED_HIGH_BEAM_NO_DIMMING = 4U,
	AFS_RTE_EXECUTED_HIGH_BEAM_DIMMING = 5U,
};

enum afs_rte_health_state {
	AFS_RTE_HEALTH_OK = 0U,
	AFS_RTE_HEALTH_DEGRADED = 1U,
	AFS_RTE_HEALTH_FAULTED = 2U,
	AFS_RTE_HEALTH_SAFE_FALLBACK = 3U,
};

struct afs_rte_speed_input {
	bool valid;
	int16_t centi_meters_per_second;
	int64_t received_at_ms;
};

struct afs_rte_steering_input {
	bool valid;
	int16_t deci_degrees;
	int64_t received_at_ms;
};

struct afs_rte_object_grid_input {
	bool valid;
	bool perception_degraded;
	bool object_list_overflow;
	uint8_t occupied[AFS_RTE_SECTOR_COUNT];
	uint8_t subsector_mask[AFS_RTE_SECTOR_COUNT];
	int64_t received_at_ms;
};

struct afs_rte_dashboard_input {
	bool valid;
	bool headlight_power_on;
	uint8_t requested_mode;
	bool clear_fault_request;
	int64_t received_at_ms;
};

struct afs_rte_inputs {
	struct afs_rte_speed_input speed;
	struct afs_rte_steering_input steering;
	struct afs_rte_object_grid_input object_grid;
	struct afs_rte_dashboard_input dashboard;
	bool can_decode_fault;
};

struct afs_rte_status {
	bool required_inputs_valid;
	bool fault_present;
	bool safe_fallback;
	uint8_t executed_mode;
	uint8_t health_state;
	bool steering_stale;
	bool speed_stale;
	bool object_stale;
	bool dashboard_stale;
	bool servo_control_lost;
	bool servo_mismatch;
	bool beam_control_lost;
	bool can_decode_fault;
	int8_t left_servo_feedback_half_degrees;
	int8_t right_servo_feedback_half_degrees;
	uint16_t applied_dim_sector_mask;
};

/* The RTE-like data boundary is accessed by the ECU's single application
 * thread. The CAN interrupt callback only queues frames and never writes here.
 */
void afs_rte_init(void);
void afs_rte_write_speed(const struct afs_rte_speed_input *input);
void afs_rte_write_steering(const struct afs_rte_steering_input *input);
void afs_rte_write_object_grid(const struct afs_rte_object_grid_input *input);
void afs_rte_write_dashboard(const struct afs_rte_dashboard_input *input);
void afs_rte_write_can_decode_fault(bool active);
void afs_rte_read_inputs(struct afs_rte_inputs *inputs);
void afs_rte_write_status(const struct afs_rte_status *status);
void afs_rte_read_status(struct afs_rte_status *status);

#endif /* AFS_RTE_AFS_RTE_H_ */
