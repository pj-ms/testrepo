#!/bin/bash

# Print each command before executing it.
set -x

# Kill any existing wrangler processes.
pkill -f wrangler

# Exit on error.
set -e

tsc
echo "" >> backend.log
echo "$(date '+[%Y-%m-%d %H:%M:%S]') RESTARTING BACKEND DEV SERVER" >> backend.log
echo "" >> backend.log
wrangler dev --local --port 8787 --ip 0.0.0.0 2>&1 < /dev/null | perl -pe '$|=1; use POSIX qw(strftime); print strftime("[%Y-%m-%d %H:%M:%S] ", localtime)' >> backend.log &