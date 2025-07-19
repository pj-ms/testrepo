#!/bin/bash

# Print each command before executing it, and exit on error.
set -xe

tsc -b
vite build