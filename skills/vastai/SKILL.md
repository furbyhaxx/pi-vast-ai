---
name: vastai
description: "Vast.ai GPU marketplace reference. Auto-invoked when the user discusses renting GPUs, launching GPU instances, searching for machines, vast.ai pricing, managing cloud GPU workloads, volumes, templates, autoscaling, SSH keys, or any vast.ai topic."
allowed-tools: Bash
---

# Vast.ai CLI Complete Reference

The `vastai` CLI (v0.5.0) interfaces with the Vast.ai GPU rental marketplace. All commands below are real and available.

## Spending guard (pi)

The package's `vastai-guard` extension lets read-only commands (`show`, `search`, `get`, `logs`, `ssh-url`, `scp-url`, `help`, `tfa status`) run directly. Every other `vastai` command can spend credit or destroy resources and pauses for user confirmation; without an interactive UI (print/JSON mode, headless subagents) it is blocked. When a command is blocked, report it to the user; never retry it or work around the guard via the Python SDK, `curl` to the REST API, or other wrappers.

## Authentication

```bash
vastai set api-key <KEY>           # Store API key (from https://cloud.vast.ai/account/)
vastai show user                   # Verify auth works
```
- Key stored at `~/.config/vastai/vast_api_key`
- Override: `VAST_API_KEY=<key>` env var or `--api-key <key>` flag

## Global Flags (all commands)

| Flag | Effect |
|------|--------|
| `--raw` | Raw JSON output |
| `--explain` | Show API endpoint details |
| `--curl` | Show equivalent curl command |
| `--retry N` | Retry count (default 5) |
| `-q` / `--quiet` | IDs only (where supported) |

---

## 1. SEARCH OFFERS

```bash
vastai search offers '<QUERY>' [OPTIONS]
```

**Query syntax**: `field operator value` (space-separated pairs)
**Operators**: `<`, `<=`, `==`, `!=`, `>=`, `>`, `in`, `notin`

**Pricing flags**: `-d` on-demand (default), `-b` interruptible/spot, `-r` reserved
**Sort**: `-o 'field1,field2-'` (append `-` for descending)
**Other**: `--limit N`, `-n` (no default filters), `--storage <GB>`

**Searchable fields**:

| Field | Type | Description |
|-------|------|-------------|
| `gpu_name` | str | GPU model (RTX_3090, RTX_4090, A100, A6000, H100, L40S) |
| `num_gpus` | int | Number of GPUs |
| `gpu_ram` | float | Per-GPU VRAM (GB) |
| `gpu_total_ram` | float | Total VRAM across all GPUs (GB) |
| `compute_cap` | int | CUDA compute capability × 100 |
| `cuda_vers` | float | Max CUDA version |
| `cpu_cores` | int | vCPU count |
| `cpu_ram` | float | System RAM (GB) |
| `cpu_ghz` | float | CPU clock (GHz) |
| `cpu_arch` | str | amd64, arm64 |
| `disk_space` | float | Disk (GB) |
| `disk_bw` | float | Disk bandwidth (MB/s) |
| `dph_total` | float | Cost ($/hr) |
| `dlperf` | float | DL performance score |
| `total_flops` | float | Total TFLOPs |
| `reliability` | float | Reliability score 0–1 |
| `duration` | float | Max rental (days) |
| `inet_down` / `inet_up` | float | Bandwidth (Mb/s) |
| `inet_down_cost` / `inet_up_cost` | float | Bandwidth cost ($/GB) |
| `geolocation` | str | Country code (US, DE, JP, etc.) |
| `datacenter` | bool | Datacenter-only |
| `verified` | bool | Verified machine |
| `direct_port_count` | int | Direct ports available |
| `pcie_bw` | float | PCIe bandwidth |
| `pci_gen` | float | PCIe generation |
| `bw_nvlink` | float | NVLink bandwidth |
| `gpu_mem_bw` | float | GPU memory bandwidth (GB/s) |
| `has_avx` | bool | AVX support |
| `static_ip` | bool | Static IP |
| `storage_cost` | float | Storage cost ($/GB/month) |
| `min_bid` | float | Current min bid for interruptible |
| `vms_enabled` | bool | VM instance |

**Default filters** (disabled with `-n`): `verified=true external=false rentable=true`

---

## 2. INSTANCE LIFECYCLE

### Create
```bash
vastai create instance <OFFER_ID> [OPTIONS]
```
| Option | Description |
|--------|-------------|
| `--image <IMG>` | Docker image |
| `--disk <GB>` | Disk size (default 10) |
| `--ssh` | SSH access |
| `--jupyter` / `--jupyter-lab` | Jupyter access |
| `--direct` | Direct (faster) connections |
| `--env '<OPTS>'` | Docker env/ports: `'-e K=V -p 8080:8080'` |
| `--onstart-cmd '<SCRIPT>'` | Bash to run on start |
| `--onstart <FILE>` | Onstart script from file |
| `--entrypoint <CMD>` | Override entrypoint |
| `--args ...` | Args to entrypoint (must be last) |
| `--label <NAME>` | Instance label |
| `--bid_price <$>` | Interruptible bid ($/hr) |
| `--force` | Skip sanity checks |
| `--cancel-unavail` | Error if scheduling fails |
| `--template_hash <H>` | Use template |
| `--login <AUTH>` | Docker registry auth |
| `--create-volume <ID>` | Create volume from offer |
| `--link-volume <ID>` | Attach existing volume |
| `--mount-path <PATH>` | Volume mount point |
| `--volume-size <GB>` | New volume size |
| `--volume-label <NAME>` | New volume label |
| `--python-utf8` | Set Python locale |
| `--lang-utf8` | Set system locale |
| `--user <USER>` | Container user |

**Returns**: `{"success": true, "new_contract": <instance_id>}`

### Alternative: Launch Instance (auto-selects offer)
```bash
vastai launch instance -g <GPU_NAME> -n <NUM_GPUS> -i <IMAGE> [OPTIONS]
```
Options: `-d <DISK>`, `--limit N`, `-o <SORT>`, plus all create instance options.

### Manage
```bash
vastai show instances                    # List all instances
vastai show instance <ID>               # Single instance details
vastai start instance <ID>              # Start stopped instance
vastai stop instance <ID>               # Stop (preserves data)
vastai reboot instance <ID>             # Restart (keeps GPU priority)
vastai recycle instance <ID>            # Destroy + recreate fresh
vastai destroy instance <ID>            # Delete permanently
vastai label instance <ID> '<LABEL>'    # Set label
vastai update instance <ID> [--label]   # Update instance
vastai bid instance <ID> --price <$>    # Change bid price
vastai prepay instance <ID> <AMOUNT>    # Prepay credits
```

**Batch operations**: `start instances`, `stop instances`, `destroy instances` accept multiple IDs.

**Instance statuses**: `created` → `scheduling` → `running` ↔ `stopped`, `exited`, `offline`

---

## 3. REMOTE ACCESS & EXECUTION

### SSH & SCP
```bash
vastai ssh-url <ID>                     # Returns: ssh://root@host:port
vastai scp-url <ID>                     # Returns: scp://root@host:port
```

To actually SSH in:
```bash
SSH_URL=$(vastai ssh-url <ID>)
# Parse host:port from URL, then:
ssh -p <PORT> root@<HOST> -L 8080:localhost:8080
```

### Execute (API-based, limited commands)
```bash
vastai execute <ID> '<COMMAND>'         # Run ls, rm, or du remotely
```
Only supports: `ls`, `rm`, `du`. Returns results via polling.

### Logs
```bash
vastai logs <ID>                        # Last 1000 lines
vastai logs <ID> --tail 100             # Last N lines
vastai logs <ID> --filter 'ERROR'       # Grep filter
vastai logs <ID> --daemon-logs          # System logs instead
```
Note: Not real-time streaming. Fetches a snapshot via S3 URL with polling.

### File Transfer
```bash
vastai copy <SRC> <DST> [-i <SSH_KEY>]
# Formats: local:./path, C.<instance_id>:/path, V.<volume_id>:/path
```
Examples:
```bash
vastai copy local:./data C.12345:/workspace/data
vastai copy C.12345:/workspace/results local:./results
vastai copy C.12345:/workspace/ C.67890:/workspace/   # instance-to-instance
vastai cancel copy C.12345:/workspace/                # cancel transfer
```

### Snapshots
```bash
vastai snapshot instance <ID> --repo <REPO> [--tag <TAG>] [--container_registry <REG>]
```

---

## 4. SSH KEYS

```bash
vastai show ssh-keys                    # List keys
vastai create ssh-key [<PUBLIC_KEY>]    # Upload or generate
vastai update ssh-key <ID> <KEY>        # Update key
vastai delete ssh-key <ID>              # Delete key
vastai attach ssh <INST_ID> <KEY>       # Attach to instance
vastai detach instance <INST_ID> <KEY_ID>  # Detach from instance
```

---

## 5. VOLUMES

```bash
# Search for volume offers
vastai search volumes '<QUERY>' [-o <SORT>] [--limit N]

# Manage volumes
vastai show volumes [-t local|network|all]
vastai create volume <OFFER_ID> [-s <SIZE_GB>]
vastai delete volume <ID>
vastai clone volume <SRC_ID> <DEST_OFFER_ID> [-s <SIZE>]
vastai list volume <ID> [-p <PRICE>]    # List for rent (hosting)
vastai unlist volume <ID>

# Network volumes
vastai search network-volumes '<QUERY>'
vastai create network-volume <OFFER_ID> [-s <SIZE_GB>]
vastai unlist network-volume <ID>
```

---

## 6. TEMPLATES

```bash
vastai search templates '<QUERY>'
vastai create template [--name N --image I --tag T --recommended_disk_space D]
vastai update template <HASH_ID> [OPTIONS]
vastai delete template [--template-id ID | --hash-id HASH]
```

---

## 7. AUTOSCALING & ENDPOINTS

```bash
# Endpoints (deployment targets)
vastai create endpoint [--endpoint_name N --target_util 0.9 --max_workers 20 ...]
vastai show endpoints
vastai update endpoint <ID> [--target_util --max_workers ...]
vastai delete endpoint <ID>
vastai get endpt-logs <ID> [--level 0-3 --tail N]

# Worker groups (auto-scaling pools)
vastai create workergroup [--template_hash H --endpoint_name N --test_workers 3 --search_params '<QUERY>' ...]
vastai show workergroups
vastai update workergroup <ID> [--target_util --cold_workers ...]
vastai delete workergroup <ID>
vastai get wrkgrp-logs <ID> [--level 0-3 --tail N]
```

---

## 8. CLUSTERS & OVERLAYS

```bash
vastai create cluster <SUBNET> <MANAGER_MACHINE_ID>
vastai show clusters
vastai delete cluster <ID>
vastai remove-machine-from-cluster <CLUSTER_ID> <MACHINE_ID> [NEW_MANAGER_ID]

vastai create overlay <CLUSTER_ID> <NAME>
vastai show overlays
vastai delete overlay <ID_OR_NAME>
vastai join overlay <NAME> <INSTANCE_ID>
```

---

## 9. ACCOUNT & BILLING

```bash
vastai show user                        # Account info
vastai set user --file <JSON>           # Update profile
vastai show deposit <ID>                # Credit balance
vastai show earnings [-s START -e END]  # Hosting earnings
vastai show invoices -c|-i [-s START -e END]  # Charges or invoices
vastai search invoices '<QUERY>'
vastai transfer credit <RECIPIENT> <AMOUNT>
vastai show ipaddrs                     # IP history
vastai show audit-logs                  # Audit trail
```

---

## 10. API KEYS

```bash
vastai set api-key <KEY>                # Store locally
vastai show api-key <ID>               # Show specific key
vastai show api-keys                    # List all keys
vastai create api-key [--name N --permission_file F]
vastai delete api-key <ID>
vastai reset api-key
```

---

## 11. ENVIRONMENT VARIABLES

```bash
vastai show env-vars [-s]               # List (show values with -s)
vastai create env-var <NAME> <VALUE>
vastai update env-var <NAME> <VALUE>
vastai delete env-var <NAME>
```

---

## 12. TEAMS

```bash
vastai create-team --team_name <NAME>
vastai destroy team
vastai show members
vastai invite member --email <E> --role <R>
vastai remove member <USER_ID>
vastai create team-role --name <N> --permissions <JSON_FILE>
vastai show team-roles
vastai show team-role <NAME>
vastai update team-role <ID> [--name --permissions]
vastai remove team-role <NAME>
vastai show subaccounts
vastai create subaccount --email E --username U --password P --type host|client
```

---

## 13. HOSTING (Machine Owners)

```bash
vastai show machines [-q]               # List your machines
vastai show machine <ID>               # Machine details
vastai list machine <ID> [-g PRICE_GPU -s PRICE_DISK -i INET_DOWN -u INET_UP]
vastai list machines <IDs...> [PRICING]
vastai unlist machine <ID>
vastai delete machine <ID>
vastai set min_bid <ID> --price <$>
vastai set defjob <ID> [--image --onstart-cmd ...]
vastai remove defjob <ID>
vastai cleanup machine <ID>
vastai defragment machines <IDs...>
vastai self-test machine <ID>
vastai show maints [-ids <IDs>]
vastai schedule machine-maint <ID> --sdate <EPOCH> --duration <HRS>
vastai cancel maint <ID>
vastai attach network-disk <MACHINE_IDS...> <MOUNT> [-d DISK_ID]
```

---

## 14. SCHEDULED JOBS

```bash
vastai show scheduled-jobs
vastai delete scheduled-job <ID>
# Scheduling via --schedule flag on: reboot, execute, bid
# e.g. vastai reboot instance <ID> --schedule DAILY --hour 3
```

---

## 15. NETWORK DISKS

```bash
vastai show network-disks
vastai list network-disk <ID> [-p PRICE -e END_DATE]
```

---

## Common Docker Images

| Use Case | Image |
|----------|-------|
| PyTorch | `pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel` |
| CUDA dev | `nvidia/cuda:12.1.0-devel-ubuntu22.04` |
| TensorFlow | `tensorflow/tensorflow:latest-gpu` |
| vLLM | `vllm/vllm-openai:latest` |
| HF Transformers | `huggingface/transformers-pytorch-gpu` |
| General | `vastai/pytorch` |

## Tips

- Use `--raw` for JSON output, pipe to `jq` for parsing
- Use `-q` to get just IDs for scripting
- Always `reliability>0.9` in searches unless you want cheap unreliable machines
- Use `--disk` generously — disk is cheap, running out mid-job is expensive
- `--onstart-cmd` runs as root on every start/restart
- For long training: on-demand > interruptible (avoid preemption)
- Poll `vastai show instances --raw` to wait for instance readiness
- `vastai execute` is limited (ls/rm/du only) — use SSH for real work
