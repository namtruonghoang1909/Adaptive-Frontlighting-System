cmake_minimum_required(VERSION 3.20)
project(afs_ecu_host_tests C)

include(CTest)

set(AFS_APP_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../firmware/afs_ecu")
set(AFS_DBC_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../bridge/src/can/generated")

add_executable(afs_ecu_logic_test
    afs_ecu_logic_test.c
    ${AFS_APP_DIR}/src/application/afs_controller.c
    ${AFS_APP_DIR}/src/bsw/services/communication/can_message_service.c
    ${AFS_APP_DIR}/src/rte/afs_rte.c
    ${AFS_DBC_DIR}/afs.c
)
target_include_directories(afs_ecu_logic_test PRIVATE
    ${AFS_APP_DIR}/include
    ${AFS_DBC_DIR}
    stubs
)
set_target_properties(afs_ecu_logic_test PROPERTIES C_STANDARD 11 C_STANDARD_REQUIRED ON)
target_compile_options(afs_ecu_logic_test PRIVATE -Wall -Wextra -Wpedantic -Werror)
target_link_libraries(afs_ecu_logic_test PRIVATE m)

foreach(case_name IN ITEMS counter_policy freshness_and_fallback frame_validation
                           command_lease_and_clear_fault_edge status_encoding)
    add_test(NAME ecu_${case_name} COMMAND afs_ecu_logic_test ${case_name})
endforeach()
