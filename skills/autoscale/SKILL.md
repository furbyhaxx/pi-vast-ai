---
name: autoscale
description: "Manage Vast.ai autoscaling endpoints and worker groups for production deployments. Use when setting up auto-scaling GPU inference, managing worker pools, or deploying services."
allowed-tools: Bash
---

# Vast.ai Autoscaling & Endpoints

Manage production deployments with auto-scaling worker pools.

## User Request

The user's request is the text appended after the skill command (`/skill:autoscale <request>`); if nothing was appended, use the current conversation.

## Concepts

- **Endpoint**: A deployment target that manages load and scaling policy
- **Worker Group**: A pool of instances (workers) tied to an endpoint, auto-scaled based on load

## Endpoints

### Create
```bash
vastai create endpoint \
  --endpoint_name '<NAME>' \
  --target_util 0.9 \
  --max_workers 20 \
  --cold_workers 5 \
  --cold_mult 2.5 \
  --min_load 0.0
```

| Option | Description | Default |
|--------|-------------|---------|
| `--endpoint_name` | Name for the endpoint | (required) |
| `--target_util` | Target utilization 0–1 | 0.9 |
| `--max_workers` | Max workers | 20 |
| `--cold_workers` | Min cold/standby workers | 5 |
| `--cold_mult` | Cold capacity multiplier | 2.5 |
| `--min_load` | Minimum floor load (perf units/s) | 0.0 |
| `--min_cold_load` | Minimum cold load | 0.0 |

### Manage
```bash
vastai show endpoints
vastai update endpoint <ID> [--target_util 0.85 --max_workers 50 ...]
vastai delete endpoint <ID>
vastai get endpt-logs <ID> [--level 0-3 --tail N]
```

## Worker Groups

### Create
```bash
vastai create workergroup \
  --template_hash '<HASH>' \
  --endpoint_name '<NAME>' \
  --test_workers 3 \
  --cold_workers 2 \
  --target_util 0.9 \
  --search_params 'gpu_name=RTX_4090 reliability>0.9'
```

| Option | Description |
|--------|-------------|
| `--template_hash` | Template for worker instances |
| `--template_id` | Template ID (alternative) |
| `--endpoint_name` / `--endpoint_id` | Target endpoint |
| `--test_workers` | Workers for perf estimation |
| `--cold_workers` | Min cold workers |
| `--target_util` | Target utilization |
| `--cold_mult` | Cold capacity multiplier |
| `--search_params` | Search query for selecting machines |
| `--gpu_ram` | Estimated GPU RAM requirement |
| `--launch_args` | Extra args for instance creation |
| `-n` | Disable default search params |

### Manage
```bash
vastai show workergroups
vastai update workergroup <ID> [--target_util --cold_workers ...]
vastai delete workergroup <ID>
vastai get wrkgrp-logs <ID> [--level 0-3 --tail N]
```

## Typical Setup Flow
1. Create a template with your Docker image and config
2. Create an endpoint with scaling policy
3. Create a worker group linking the template to the endpoint
4. Monitor with `show endpoints` and `show workergroups`
5. Check logs with `get endpt-logs` and `get wrkgrp-logs`
