cmake_minimum_required(VERSION 3.20.0)

find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(afs_ecu)

set(AFS_CAN_GENERATED_DIR ${CMAKE_CURRENT_LIST_DIR}/../../bridge/src/can/generated)

target_include_directories(app PRIVATE
  include
  ${AFS_CAN_GENERATED_DIR}
)

target_sources(app PRIVATE
  src/main.c
  src/application/afs_controller.c
  src/application/afs_ecu_application.c
  src/bsw/ecu_abstraction/can_bus.c
  src/bsw/ecu_abstraction/board_led.c
  src/bsw/services/communication/can_rx_log.c
  src/bsw/services/communication/can_message_service.c
  src/rte/afs_rte.c
  ${AFS_CAN_GENERATED_DIR}/afs.c
)
