# This is not part of the project, it's here to help out CLion.
# This is never used to build the app.

cmake_minimum_required(VERSION 3.22)
project(node_dump_stacks)

set(CMAKE_CXX_STANDARD 14)

include_directories(
        src
        # this is created by `npm install`
        node_modules/nan
        # this is created by `npm run install`, on the `.nvmrc` specified node version
        # the version is not otherwise important
        $ENV{HOME}/.cache/node-gyp/16.15.1/include/node)

add_executable(node_dump_stacks
        src/dump-stacks.cc
        src/stacks.h
        src/stringify.h
        src/sys.h)
