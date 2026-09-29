---
name: manage-instances
description: "Manage Vast.ai GPU instances — show status, start, stop, destroy, SSH, execute commands, view logs, copy files, take snapshots. Use when the user wants to check on, connect to, transfer files, or control their GPU instances."
allowed-tools: Bash
---

# Manage Vast.ai Instances

Help the user manage their GPU instances on Vast.ai.

## User Request

The user's request is the text appended after the skill command (`/skill:manage-instances <request>`); if nothing was appended, use the current conversation.

## Available Actions

### Show Instances
```bash
vastai show instances                   # Table view
vastai show instances --raw             # JSON
vastai show instance <ID> --raw         # Single instance JSON
```

### Start / Stop / Reboot / Destroy
```bash
vastai start instance <ID>
vastai stop instance <ID>
vastai reboot instance <ID>             # Restart, keeps GPU priority
vastai recycle instance <ID>            # Destroy + recreate fresh
vastai destroy instance <ID>            # PERMANENT — confirm first
```

Batch: `start instances`, `stop instances`, `destroy instances` take multiple IDs.

**Always confirm `destroy` with the user — it is irreversible.**

### Labels & Updates
```bash
vastai label instance <ID> '<LABEL>'
vastai update instance <ID> --label '<NEW>'
vastai bid instance <ID> --price <$/hr>  # Change bid price
vastai prepay instance <ID> <AMOUNT>     # Prepay credits
```

### SSH Connection
```bash
vastai ssh-url <ID>
# Returns: ssh://root@<HOST>:<PORT>
# Connect with: ssh -p <PORT> root@<HOST>
```

### SCP File Transfer
```bash
vastai scp-url <ID>
# Upload:   scp -P <PORT> file.py root@<HOST>:/root/
# Download: scp -P <PORT> root@<HOST>:/root/results.tar.gz ./
```

### Copy (rsync-based)
```bash
vastai copy local:./data C.<ID>:/workspace/data          # Upload
vastai copy C.<ID>:/workspace/results local:./results    # Download
vastai copy C.<ID1>:/data C.<ID2>:/data                  # Instance-to-instance
vastai cancel copy C.<ID>:/path                          # Cancel transfer
```

### Execute (API-based, limited)
```bash
vastai execute <ID> 'ls -l /workspace'     # ls, rm, du only
```

### Logs
```bash
vastai logs <ID>                        # Last 1000 lines
vastai logs <ID> --tail 50              # Last N lines
vastai logs <ID> --filter 'ERROR'       # Filter lines
vastai logs <ID> --daemon-logs          # System logs
```

### Snapshots
```bash
vastai snapshot instance <ID> --repo <DOCKERHUB_REPO> [--tag <TAG>]
```

### Scheduled Operations
```bash
# Schedule reboots
vastai reboot instance <ID> --schedule DAILY --hour 3

# Schedule bid changes
vastai bid instance <ID> --price 0.5 --schedule WEEKLY --day 1

# View/delete scheduled jobs
vastai show scheduled-jobs
vastai delete scheduled-job <ID>
```

## Instance Statuses

| Status | Meaning |
|--------|---------|
| `created` | Just created, initializing |
| `scheduling` | Waiting for resources |
| `running` | Active and accessible |
| `exited` | Container exited (check logs) |
| `stopped` | Paused by user |
| `offline` | Machine went offline |

## Cost Awareness

When showing instances, note:
- $/hr rate for each instance
- Uptime duration
- Remind users to destroy idle instances
