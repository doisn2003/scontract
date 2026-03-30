# scontract-hardhat-base
# Base image for ephemeral Hardhat compilation/testing containers.
# Build: docker build -t scontract-hardhat-base ./docker
#
# KEY DESIGN: Pre-cache common Solidity compilers during build time
# so containers can run with --network=none at runtime (security + speed).

FROM node:20-alpine

# Install system deps needed by some npm packages (e.g., node-gyp)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package manifest and install ALL dependencies
# This layer is cached → rebuilds only when package.json changes
COPY package.json package-lock.json* ./

RUN npm install --prefer-offline 2>&1 || npm install

# Copy the template scripts into the image
# (actual project files are mounted via volume at runtime)
COPY scripts/ ./scripts/

# Pre-cache common Solidity compiler versions during BUILD TIME
# This avoids needing network access at container RUNTIME.
# Add more versions as needed (e.g., 0.7.6, 0.8.0, 0.8.17)
COPY cache-compilers.js ./cache-compilers.js
RUN node cache-compilers.js && rm cache-compilers.js

# Create the mount point directory
RUN mkdir -p /app/project

# Default working directory when container runs
WORKDIR /app

# Container is invoked by the backend orchestrator with explicit commands.
# No default CMD — the sandboxService passes the command at runtime.
