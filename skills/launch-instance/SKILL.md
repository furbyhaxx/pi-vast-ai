---
name: launch-instance
description: "Launch a GPU instance on Vast.ai. Use when the user wants to create, start, or spin up a new GPU machine for training, inference, or development."
disable-model-invocation: true
allowed-tools: Bash
---

# Launch a Vast.ai GPU Instance

Guide the user through launching a GPU instance on Vast.ai.

## User Request

The user's request is the text appended after the skill command (`/skill:launch-instance <request>`); if nothing was appended, use the current conversation.

## Instructions

### Step 1: Determine the Offer

If the user provided an **offer ID** (number), use it directly.

If they described **requirements**, search first:
```bash
vastai search offers '<query>' -o 'dph_total'
```
Present top options and ask the user to pick one.

### Step 2: Gather Configuration

| Setting | Flag | Default |
|---------|------|---------|
| Docker image | `--image` | Ask user (suggest `pytorch/pytorch`) |
| Disk size | `--disk` | 64 GB |
| Access method | `--ssh` / `--jupyter` / `--jupyter-lab` | `--ssh` |
| Direct connect | `--direct` | No (not all machines support it) |
| Startup script | `--onstart-cmd` | None |
| Environment/ports | `--env` | None |
| Pricing | `--bid_price` | On-demand (no flag) |
| Label | `--label` | None |
| Template | `--template_hash` | None |
| Volume | `--create-volume` / `--link-volume` | None |
| Mount path | `--mount-path` | None |
| Entrypoint | `--entrypoint` | Container default |
| Container user | `--user` | root |

**Common images**: `pytorch/pytorch`, `nvidia/cuda:12.1.0-devel-ubuntu22.04`, `vllm/vllm-openai:latest`, `tensorflow/tensorflow:latest-gpu`

### Step 3: Launch

```bash
vastai create instance <OFFER_ID> \
  --image <IMAGE> \
  --disk <GB> \
  --ssh \
  [--env '<DOCKER_OPTS>'] \
  [--onstart-cmd '<SCRIPT>'] \
  [--label '<NAME>']
```

Alternatively, auto-select an offer:
```bash
vastai launch instance -g <GPU_NAME> -n <NUM_GPUS> -i <IMAGE> -d <DISK> --ssh
```

### Step 4: Verify & Connect

After creation succeeds (note the `new_contract` instance ID):

```bash
# Wait for running status
vastai show instances

# Get SSH connection
vastai ssh-url <INSTANCE_ID>
```

Provide the user with the SSH command or Jupyter URL.

### Step 5: Volume Setup (if needed)

```bash
# With new volume
vastai create instance <OFFER_ID> --image <IMG> --ssh --disk 64 \
  --create-volume <VOLUME_OFFER_ID> --volume-size 100 --mount-path /root/data

# With existing volume
vastai create instance <OFFER_ID> --image <IMG> --ssh --disk 64 \
  --link-volume <VOLUME_ID> --mount-path /root/data
```

## Safety

- **Always confirm** offer ID and $/hr cost before creating
- Remind user to `vastai destroy instance <ID>` when done
- Warn about interruptible instances losing work if preempted
- For spot: use `--bid_price` — if bid is too low, instance won't start
