cmake_minimum_required(VERSION 3.16)

project(afs_bridge LANGUAGES C CXX)

include(CTest)
find_package(Threads REQUIRED)
option(AFS_ENABLE_SOCKETCAN_VCAN_TEST
    "Run the end-to-end bridge test on an already configured vcan interface" OFF)
set(AFS_VCAN_INTERFACE "vcan0" CACHE STRING
    "CAN interface used by the opt-in SocketCAN integration test")
set(AFS_PROJECT_TESTS_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../tests")

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(afs_runner_ipc src/ipc/runner_ipc.cpp)
target_include_directories(afs_runner_ipc PUBLIC include)
target_compile_options(afs_runner_ipc PRIVATE -Wall -Wextra -Wpedantic)

add_library(afs_can_dbc src/can/generated/afs.c)
target_include_directories(afs_can_dbc PUBLIC src/can/generated)
target_compile_options(afs_can_dbc PRIVATE -Wall -Wextra -Wpedantic)
target_link_libraries(afs_can_dbc PUBLIC m)

add_library(afs_can_encoding
    src/can/can_encoder.cpp
    src/can/can_frame_encoder.cpp
)
target_include_directories(afs_can_encoding PUBLIC include)
target_link_libraries(afs_can_encoding PUBLIC afs_runner_ipc PRIVATE afs_can_dbc)
target_compile_options(afs_can_encoding PRIVATE -Wall -Wextra -Wpedantic)

add_library(afs_can_runtime
    src/app/can_runtime.cpp
    src/can/afs_status.cpp
    src/can/socketcan_frame.cpp
    src/can/socketcan_transport.cpp
)
target_include_directories(afs_can_runtime PUBLIC include PRIVATE src/can/generated)
target_link_libraries(afs_can_runtime PUBLIC afs_can_encoding PRIVATE afs_can_dbc Threads::Threads)
target_compile_options(afs_can_runtime PRIVATE -Wall -Wextra -Wpedantic)

add_executable(afs_runner_bridge src/app/runner_bridge_main.cpp)
target_link_libraries(afs_runner_bridge PRIVATE afs_runner_ipc afs_can_runtime Threads::Threads)
target_compile_options(afs_runner_bridge PRIVATE -Wall -Wextra -Wpedantic)

add_executable(afs_can_frame_logger
    src/app/can_frame_logger.cpp
    src/app/can_frame_logger_main.cpp
)
target_include_directories(afs_can_frame_logger PRIVATE src/can/generated)
target_link_libraries(afs_can_frame_logger PRIVATE afs_can_encoding Threads::Threads)
target_compile_options(afs_can_frame_logger PRIVATE -Wall -Wextra -Wpedantic)

if(BUILD_TESTING)
    add_executable(afs_runner_ipc_integration_test
        ${AFS_PROJECT_TESTS_DIR}/unix_socket/runner_bridge/runner_ipc_integration.cpp)
    target_link_libraries(afs_runner_ipc_integration_test PRIVATE afs_runner_ipc)
    target_compile_options(afs_runner_ipc_integration_test PRIVATE -Wall -Wextra -Wpedantic)
    add_test(NAME runner_ipc_integration COMMAND afs_runner_ipc_integration_test)
    set_tests_properties(runner_ipc_integration PROPERTIES TIMEOUT 15)

    add_executable(afs_dashboard_ipc_integration_test
        ${AFS_PROJECT_TESTS_DIR}/unix_socket/dashboard_bridge/dashboard_ipc_integration.cpp)
    target_link_libraries(afs_dashboard_ipc_integration_test PRIVATE afs_runner_ipc)
    target_compile_options(afs_dashboard_ipc_integration_test PRIVATE -Wall -Wextra -Wpedantic)
    add_test(NAME dashboard_ipc_integration COMMAND afs_dashboard_ipc_integration_test)
    set_tests_properties(dashboard_ipc_integration PROPERTIES TIMEOUT 10)

    add_executable(afs_can_encoder_test
        ${AFS_PROJECT_TESTS_DIR}/can/bridge/encoder/can_encoder_test.cpp)
    target_link_libraries(afs_can_encoder_test PRIVATE afs_can_encoding)
    target_compile_options(afs_can_encoder_test PRIVATE -Wall -Wextra -Wpedantic)
    add_test(NAME can_encoder_signal_values COMMAND afs_can_encoder_test)

    add_executable(afs_can_frame_encoder_test
        ${AFS_PROJECT_TESTS_DIR}/can/bridge/encoder/can_frame_encoder_test.cpp)
    target_link_libraries(afs_can_frame_encoder_test PRIVATE afs_can_encoding)
    target_compile_options(afs_can_frame_encoder_test PRIVATE -Wall -Wextra -Wpedantic)
    add_test(NAME can_frame_encoder COMMAND afs_can_frame_encoder_test)

    add_executable(afs_status_test
        ${AFS_PROJECT_TESTS_DIR}/can/bridge/status_decoder/afs_status_test.cpp)
    target_link_libraries(afs_status_test PRIVATE afs_can_runtime)
    target_compile_options(afs_status_test PRIVATE -Wall -Wextra -Wpedantic)
    add_test(NAME afs_status_decoder COMMAND afs_status_test)

    add_executable(afs_socketcan_frame_test
        ${AFS_PROJECT_TESTS_DIR}/can/bridge/socketcan/socketcan_frame_test.cpp)
    target_link_libraries(afs_socketcan_frame_test PRIVATE afs_can_runtime)
    target_compile_options(afs_socketcan_frame_test PRIVATE -Wall -Wextra -Wpedantic)
    add_test(NAME socketcan_frame_conversion COMMAND afs_socketcan_frame_test)

    find_package(Python3 COMPONENTS Interpreter QUIET)
    if(Python3_Interpreter_FOUND)
        add_test(
            NAME runner_ipc_python_end_to_end
            COMMAND ${Python3_EXECUTABLE}
                ${AFS_PROJECT_TESTS_DIR}/unix_socket/runner_bridge/runner_ipc_end_to_end.py
                $<TARGET_FILE:afs_runner_bridge>
        )
        set_tests_properties(runner_ipc_python_end_to_end PROPERTIES TIMEOUT 20)
        if(AFS_ENABLE_SOCKETCAN_VCAN_TEST)
            add_test(
                NAME socketcan_vcan_end_to_end
                COMMAND ${Python3_EXECUTABLE}
                    ${AFS_PROJECT_TESTS_DIR}/can/bridge/socketcan/socketcan_vcan_end_to_end.py
                    $<TARGET_FILE:afs_runner_bridge>
                    --interface ${AFS_VCAN_INTERFACE}
            )
            set_tests_properties(socketcan_vcan_end_to_end PROPERTIES TIMEOUT 20)
        endif()
    endif()
endif()
