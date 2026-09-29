---
name: run-job
description: "Run a job on a Vast.ai GPU instance end-to-end: find a GPU, launch it, execute the job, monitor it, and destroy the instance when done. Use when the user wants to run a training job, inference task, script, or any workload on a remote GPU."
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Glob, Grep
---

# Vast.ai Job Runner Agent

You are an autonomous agent that runs GPU jobs on Vast.ai end-to-end. You will search for a GPU, launch an instance, run the user's job, monitor it to completion, and clean up by destroying the instance.

In pi this workflow runs inline in the current session, not as a forked agent. Launching, copying to and destroying instances each pause for the user's confirmation through `vastai-guard`; say which step you are about to take before running it.

## User's Job Request

The user's request is the text appended after the skill command (`/skill:run-job <request>`); if nothing was appended, use the current conversation.

## Workflow

Follow these phases in order. If any phase fails, attempt recovery. If unrecoverable, destroy the instance to avoid billing and report the error.

---

### Phase 1: Understand the Job

Parse the user's request to determine:

1. **What to run**: Script, command, training job, inference task, etc.
2. **GPU requirements**: Model, VRAM, count (default: 1× GPU with ≥24GB VRAM)
3. **Environment** (pick one — ask the user if ambiguous):
   - **Docker image** (`--image`): e.g. `pytorch/pytorch`, `nvidia/cuda:12.1.0-devel-ubuntu22.04`
   - **Template** (`--template_hash` or `--template_id`): A pre-configured environment from `vastai search templates`
   - If the user says "use my template" or gives a hash/ID, use that instead of an image
4. **Setup commands**: Packages to install, repos to clone, env vars to set (goes in `--onstart-cmd`)
5. **Docker registry auth** (`--login`): Only if using a private image
6. **Disk space**: How much storage (default: 64GB)
7. **Files to upload**: Any local files/scripts to send to the instance
8. **Results to download**: What outputs to retrieve when done
9. **Budget**: Max $/hr the user is willing to pay
10. **Estimated duration**: How long the job will take (affects spot vs on-demand choice)

**Image selection guide** — infer from the job if not specified:

| Job type | Suggested image |
|----------|----------------|
| PyTorch training/fine-tuning | `pytorch/pytorch` |
| General CUDA/C++ work | `nvidia/cuda:12.1.0-devel-ubuntu22.04` |
| Hugging Face / transformers | `pytorch/pytorch` + onstart pip install |
| TensorFlow | `tensorflow/tensorflow:latest-gpu` |
| vLLM / LLM serving | `vllm/vllm-openai:latest` |
| JAX | `nvidia/cuda:12.1.0-devel-ubuntu22.04` + onstart pip install |
| General Python ML | `pytorch/pytorch` |
| Custom / user-specified | Whatever they provide |

If the user provides a template hash/ID, skip image selection entirely — the template includes the image.

If critical details are unclear, ask the user (use the `ask_user` tool when available). For ambiguous but non-critical details, use sensible defaults.

---

### Phase 2: Verify SSH Key Setup

Before launching anything, verify the user has SSH keys configured — without them, you cannot connect to the instance.

```bash
vastai show ssh-keys
```

**If keys exist**: Note the key ID. Determine which local private key corresponds to it. Check common locations:
```bash
ls -la ~/.ssh/id_ed25519 ~/.ssh/id_rsa ~/.ssh/id_ecdsa 2>/dev/null
```
Store the path to the private key — you'll need it for every `ssh` and `scp` command (the `-i` flag).

**If no keys exist**: Ask the user what to do:
1. Upload their existing public key (e.g. `~/.ssh/id_ed25519.pub`):
   ```bash
   vastai create ssh-key "$(cat ~/.ssh/id_ed25519.pub)"
   ```
2. Or generate a new keypair and upload it:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/vastai_ed25519 -N "" -C "vastai"
   vastai create ssh-key "$(cat ~/.ssh/vastai_ed25519.pub)"
   ```

**IMPORTANT**: Store the SSH private key path (e.g. `SSH_KEY=~/.ssh/id_ed25519`) for use in all subsequent SSH/SCP commands. Every `ssh` and `scp` command in this workflow MUST include `-i $SSH_KEY`.

---

### Phase 3: Find a GPU

Search for suitable offers:

```bash
vastai search offers '<QUERY>' -o 'dph_total' --raw
```

Build the query from requirements. Always include `reliability>0.9`. Default search:
```bash
vastai search offers 'gpu_ram>=24 num_gpus=1 reliability>0.9 disk_space>=64' -o 'dph_total' --raw
```

Parse the JSON output. Select the cheapest suitable offer. Note:
- The offer `id` — needed to create the instance
- The `dph_total` — cost per hour
- The `gpu_name` — what GPU it is

Tell the user what you found and the cost. Ask for confirmation before proceeding.

---

### Phase 4: Launch the Instance

Create the instance with SSH access. Choose the right flags based on what the user specified:

**Option A — Using a Docker image (most common):**
```bash
vastai create instance <OFFER_ID> \
  --image <DOCKER_IMAGE> \
  --disk <DISK_GB> \
  --ssh \
  --label 'claude-job-<timestamp>' \
  --onstart-cmd '<SETUP_SCRIPT>' \
  [--env '<-e KEY=VAL -p HOST:CONTAINER>'] \
  [--login '<REGISTRY_AUTH>']
```

**Option B — Using a template:**
```bash
vastai create instance <OFFER_ID> \
  --template_hash <HASH> \
  --disk <DISK_GB> \
  --ssh \
  --label 'claude-job-<timestamp>' \
  [--onstart-cmd '<EXTRA_SETUP>']
```

**Option C — Using a template ID:**
```bash
vastai create instance <OFFER_ID> \
  --template_id <ID> \
  --disk <DISK_GB> \
  --ssh \
  --label 'claude-job-<timestamp>'
```

**Onstart-cmd tips:**
- Use for: `pip install`, `apt-get install`, `git clone`, setting env vars, downloading datasets
- Keep the container running — do NOT put the main job in onstart-cmd (use SSH for that)
- Separate multiple commands with `&&` or `;`
- Example: `'pip install transformers datasets && git clone https://github.com/user/repo /root/repo'`

**Volume attachment** (if user needs persistent storage):
```bash
  --create-volume <VOLUME_OFFER_ID> --volume-size <GB> --mount-path /root/data
  # OR
  --link-volume <EXISTING_VOLUME_ID> --mount-path /root/data
```

Capture the instance ID from the response (`new_contract` field).

---

### Phase 5: Wait for Instance Ready

Poll until the instance is running:

```bash
# Poll every 10 seconds, up to 5 minutes
for i in $(seq 1 30); do
  STATUS=$(vastai show instance <ID> --raw 2>/dev/null | jq -r '.actual_status // .status // "unknown"')
  echo "Attempt $i: status=$STATUS"
  if [ "$STATUS" = "running" ]; then
    echo "Instance is running!"
    break
  fi
  if [ "$STATUS" = "exited" ] || [ "$STATUS" = "offline" ]; then
    echo "Instance failed with status: $STATUS"
    break
  fi
  sleep 10
done
```

If the instance fails to start within 5 minutes, destroy it and try the next offer.

Once running, get SSH connection info:
```bash
vastai ssh-url <ID>
```

Parse the SSH URL to extract host and port. The format is `ssh://root@<HOST>:<PORT>`.

Wait an additional 15-20 seconds after "running" status for SSH to become available, then test connectivity:
```bash
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p <PORT> root@<HOST> 'echo connected'
```

---

### Phase 6: Upload Files (if needed)

Always tar+gzip before transferring to minimize transfer time. Never scp files individually.

**Single file:**
```bash
scp -i <SSH_KEY> -o StrictHostKeyChecking=no -P <PORT> <LOCAL_FILE> root@<HOST>:/root/
```

**Multiple files or directories** — tar+gzip and stream directly (no temp file):
```bash
tar czf - -C <LOCAL_BASE_DIR> <PATHS...> | \
  ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> \
  'tar xzf - -C /root/'
```

Examples:
```bash
# Upload a directory
tar czf - -C /home/user my_project/ | \
  ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> 'tar xzf - -C /root/'

# Upload multiple files from same parent dir
tar czf - -C /home/user/data file1.csv file2.csv model.bin | \
  ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> 'tar xzf - -C /root/data/'

# Upload files from different locations — create a staging tarball first
tar czf /tmp/upload.tar.gz -C /path/a fileA -C /path/b fileB && \
  scp -i <SSH_KEY> -o StrictHostKeyChecking=no -P <PORT> /tmp/upload.tar.gz root@<HOST>:/root/ && \
  ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> 'cd /root && tar xzf upload.tar.gz && rm upload.tar.gz'
```

---

### Phase 7: Run the Job

Execute the job via SSH. For long-running jobs, use `nohup` or `tmux` and redirect output:

```bash
# For short jobs (< 10 min), run directly:
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> '<COMMAND>'

# For long jobs, use nohup so it survives SSH disconnect:
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> \
  'nohup bash -c "<COMMAND>" > /root/job_output.log 2>&1 & echo $!'
```

Capture the PID if running in background.

---

### Phase 8: Monitor Progress

For background jobs, poll for completion:

```bash
# Check if process is still running
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> 'kill -0 <PID> 2>/dev/null && echo running || echo done'

# Check latest output
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> 'tail -20 /root/job_output.log'
```

Also check instance logs periodically:
```bash
vastai logs <ID> --tail 50
```

Report progress to the user periodically. If the job appears stuck or erroring, alert the user.

Poll interval: every 30 seconds for jobs < 10 min, every 2 minutes for longer jobs.

---

### Phase 9: Retrieve Results (if needed)

Always tar+gzip results on the remote side and stream back. Never scp -r directories.

**Single file:**
```bash
scp -i <SSH_KEY> -o StrictHostKeyChecking=no -P <PORT> root@<HOST>:<REMOTE_FILE> <LOCAL_PATH>
```

**Directory or multiple outputs** — tar+gzip and stream directly:
```bash
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> \
  'tar czf - -C /root <RESULT_PATHS...>' | \
  tar xzf - -C <LOCAL_DEST>
```

Examples:
```bash
# Download an output directory
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> \
  'tar czf - -C /root output/' | tar xzf - -C ./

# Download multiple result paths
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> \
  'tar czf - -C /root output/ checkpoints/ job_output.log' | tar xzf - -C ./results/

# Download and save as a single archive (preserves everything)
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no -p <PORT> root@<HOST> \
  'tar czf - -C /root output/' > results.tar.gz
```

Common result locations to check:
- Model checkpoints: `/root/output/`, `/root/checkpoints/`
- Logs: `/root/job_output.log`
- Whatever the user specified

---

### Phase 10: Cleanup

**Always destroy the instance when done** (or on failure):

```bash
vastai destroy instance <ID>
```

Verify destruction:
```bash
vastai show instances --raw | jq '.[] | select(.id == <ID>)'
```

---

### Phase 11: Report

Provide the user with a summary:
- GPU used and cost per hour
- Total runtime and estimated cost
- Job output / results location
- Any errors encountered
- Confirmation that the instance was destroyed

---

## Error Recovery

- **Instance won't start**: Destroy it, pick next cheapest offer, retry (up to 3 attempts)
- **SSH won't connect**: Wait 30 more seconds, retry 3 times, then check instance status
- **Job fails**: Show the user the error output, ask if they want to debug (keep instance) or abort (destroy)
- **Network error during monitoring**: Retry SSH connection, check instance is still running
- **Any unrecoverable error**: ALWAYS destroy the instance to stop billing, then report

## Safety Rules

1. **Always confirm cost** with the user before creating an instance
2. **Always destroy** the instance when done or on failure — never leave it running
3. **Never run** `--force` unless the user explicitly asks
4. **Track the instance ID** throughout — you need it for cleanup
5. If you lose track of the instance ID, run `vastai show instances` to find it by label
