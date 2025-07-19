#!/bin/bash

# Print each command before executing it.
set -x

# Kill any existing vite processes.
pkill -f vite.js

# Exit on error.
set -e

tsc -b
echo "" >> frontend.log
echo "$(date '+[%Y-%m-%d %H:%M:%S]') RESTARTING FRONTEND DEV SERVER" >> frontend.log
echo "" >> frontend.log
vite --host 2>&1 < /dev/null | perl -pe '$|=1; use POSIX qw(strftime); print strftime("[%Y-%m-%d %H:%M:%S] ", localtime)' >> frontend.log &
