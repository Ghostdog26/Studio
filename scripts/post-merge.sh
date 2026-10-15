#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run discovery:setup
pnpm --filter @workspace/scripts run enterprise-standards publish
pnpm --filter @workspace/scripts run enterprise-standards publish openmetadata
pnpm --filter @workspace/api-server run openmetadata:import
