# pi-vastai

Rent GPUs, launch instances, run jobs and manage your Vast.ai workflow from [pi](https://pi.dev) through natural language.

A pi package fork of [LiorZ/vastai-claude-skill](https://github.com/LiorZ/vastai-claude-skill). It adds `vastai-guard`, an extension that stands in for Claude Code's per-command permission prompt: read-only `vastai` commands run directly, anything that can spend credit or destroy resources waits for your confirmation, and is blocked outright when no interactive UI exists (print/JSON mode, headless subagents).

## Install

```bash
pi install git:github.com/furbyhaxx/vastai-claude-skill
```

For local development, load the checkout for one run or install it by path:

```bash
pi -e /path/to/vastai-claude-skill
pi install /path/to/vastai-claude-skill
```

In pi, skills are invoked as `/skill:<name> <request>`, for example `/skill:run-job train.py on one RTX 4090`. The `/name` forms below are the Claude Code spelling. The skills still load as a Claude Code plugin through `.claude-plugin/` (see upstream for those install steps), but the guard only exists in pi.

### Confirmation dialog

| Choice | Effect |
|---|---|
| Allow once | Runs this command |
| Allow these actions for the rest of this session | Stops asking for the same verb and object (for example `create instance`) until the session restarts |
| Block | Rejects the call; the model is told not to retry or work around it |

The guard classifies with an allow-list, so unknown or new `vastai` verbs require confirmation. It only inspects `vastai` CLI calls made through the `bash` tool; the Python SDK and raw REST calls are not covered, and the skills instruct the model not to use them to bypass it.

### Prerequisites

1. [Vast.ai CLI](https://vast.ai/docs/cli/commands) installed:
   ```bash
   pip install vastai
   ```
2. API key configured (get one at https://cloud.vast.ai/account/):
   ```bash
   vastai set api-key <YOUR_KEY>
   ```
3. SSH key registered with Vast.ai:
   ```bash
   vastai create ssh-key "$(cat ~/.ssh/id_ed25519.pub)"
   ```

If you're not sure about your setup, run `/vastai-setup` after installing.

## Skills

### `/run-job` — Autonomous Job Runner

An agent that handles the full lifecycle of a GPU job:

1. Parses your requirements (GPU, image/template, files, budget)
2. Searches for the cheapest suitable offer
3. Confirms cost, then launches the instance
4. Waits for SSH readiness
5. Uploads local files via tar+gzip streaming
6. Runs your job (short jobs inline, long jobs via nohup)
7. Monitors progress and reports periodically
8. Downloads results via tar+gzip streaming
9. Destroys the instance (even on failure)
10. Reports summary with runtime and estimated cost

```
/run-job fine-tune a LoRA adapter on my dataset in ./data using an A100, pytorch image
```

```
/run-job run python train.py on a 4090, upload the ./src directory, download /root/output when done
```

```
/run-job use template abc123 on 8x H100, run bash /root/train.sh, budget $8/hr
```

### `/search-gpus` — Find GPU Offers

Natural language GPU search. Translates your requirements into Vast.ai query syntax.

```
/search-gpus cheap 4090 in the US
/search-gpus 8x H100 with NVLink for distributed training
/search-gpus any GPU with 80GB+ VRAM under $2/hr
```

### `/launch-instance` — Create an Instance

Guided instance creation with cost confirmation before billing starts.

```
/launch-instance offer 12345678 with pytorch image and 100GB disk
/launch-instance RTX 4090 with jupyter lab
```

### `/manage-instances` — Control Running Instances

Show, start, stop, destroy, SSH, logs, file transfer, snapshots, and scheduled operations.

```
/manage-instances show all my instances
/manage-instances get SSH command for instance 12345
/manage-instances destroy all stopped instances
```

### `/manage-volumes` — Persistent Storage

Search, create, delete, clone, and attach volumes that persist across instance lifecycles.

```
/manage-volumes create a 100GB volume in the US
/manage-volumes list my volumes
```

### `/autoscale` — Production Deployments

Manage endpoints and auto-scaling worker groups for inference serving.

```
/autoscale create an endpoint with 4090 workers for my vLLM service
/autoscale show worker group logs
```

### `/vastai-setup` — First-Time Setup

Verify CLI installation, configure API key, register SSH keys, and test connectivity.

### Background Reference

The `vastai` skill (not user-invocable) is automatically loaded when you discuss Vast.ai topics. It provides the model with comprehensive knowledge of all 124+ CLI commands — instances, volumes, templates, clusters, overlays, teams, billing, hosting, SSH keys, API keys, environment variables, and more.

## How It Works

| Skill | Invocation | Auto-triggers | Runs as agent |
|-------|-----------|---------------|---------------|
| `vastai` | Background only | Yes (GPU/vast.ai topics) | No |
| `search-gpus` | `/search-gpus` | Yes | No |
| `launch-instance` | `/launch-instance` | No (side effects) | No |
| `manage-instances` | `/manage-instances` | Yes | No |
| `manage-volumes` | `/manage-volumes` | Yes | No |
| `autoscale` | `/autoscale` | Yes | No |
| `run-job` | `/run-job` | No (side effects) | Claude: forked agent; pi: inline |
| `vastai-setup` | `/vastai-setup` | No | No |

Skills with side effects (creating instances, spending money) require explicit `/command` invocation — they won't trigger automatically.

## License

MIT
