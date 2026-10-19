cmake_minimum_required(VERSION 3.16)

project(afs_bridge LANGUAGES CXX)

include(CTest)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(afs_runner_ipc src/ipc/runner_ipc.cpp)
target_include_directories(afs_runner_ipc PUBLIC include)
target_compile_options(afs_runner_ipc PRIVATE -Wall -Wextra -Wpedantic)

add_executable(afs_runner_bridge src/app/runner_bridge_main.cpp)
target_link_libraries(afs_runner_bridge PRIVATE afs_runner_ipc)

if(BUILD_TESTING)
    add_executable(afs_runner_ipc_integration_test tests/runner_ipc_integration.cpp)
    target_link_libraries(afs_runner_ipc_integration_test PRIVATE afs_runner_ipc)
    target_compile_options(afs_runner_ipc_integration_test PRIVATE -Wall -Wextra -Wpedantic)
    add_test(NAME runner_ipc_integration COMMAND afs_runner_ipc_integration_test)
    set_tests_properties(runner_ipc_integration PROPERTIES TIMEOUT 15)

    find_package(Python3 COMPONENTS Interpreter QUIET)
    if(Python3_Interpreter_FOUND)
        add_test(
            NAME runner_ipc_python_end_to_end
            COMMAND ${Python3_EXECUTABLE}
                ${CMAKE_CURRENT_SOURCE_DIR}/tests/runner_ipc_end_to_end.py
                $<TARGET_FILE:afs_runner_bridge>
        )
        set_tests_properties(runner_ipc_python_end_to_end PROPERTIES TIMEOUT 20)
    endif()
endif()
