---
name: manage-volumes
description: "Manage Vast.ai persistent storage volumes — search, create, delete, clone, and attach volumes to instances. Use for persistent data across instance lifecycles."
allowed-tools: Bash
---

# Manage Vast.ai Volumes

Help the user manage persistent storage volumes on Vast.ai.

## User Request

The user's request is the text appended after the skill command (`/skill:manage-volumes <request>`); if nothing was appended, use the current conversation.

## Available Actions

### Search Volume Offers
```bash
vastai search volumes '<QUERY>' -o 'storage_cost' --raw
```
Key fields: `disk_space`, `disk_bw`, `storage_cost`, `geolocation`, `reliability`, `duration`

### Create a Volume
```bash
vastai create volume <OFFER_ID> -s <SIZE_GB>     # Local volume
vastai create network-volume <OFFER_ID> -s <SIZE_GB>  # Network volume
```
Default size: 15 GB.

### List User's Volumes
```bash
vastai show volumes                    # All volumes
vastai show volumes -t local           # Local only
vastai show volumes -t network         # Network only
```

### Clone a Volume
```bash
vastai clone volume <SOURCE_VOLUME_ID> <DEST_OFFER_ID> -s <SIZE_GB>
```

### Delete a Volume
```bash
vastai delete volume <ID>
```
**Confirm with user first — this is irreversible and deletes all data.**

### Attach Volume When Creating Instance
```bash
# New volume
vastai create instance <OFFER_ID> --image <IMG> --ssh \
  --create-volume <VOLUME_OFFER_ID> --volume-size <GB> --mount-path /root/data

# Existing volume
vastai create instance <OFFER_ID> --image <IMG> --ssh \
  --link-volume <VOLUME_ID> --mount-path /root/data
```

### File Transfer To/From Volumes
```bash
vastai copy local:./data V.<VOLUME_ID>:/data
vastai copy V.<VOLUME_ID>:/results local:./results
```

## Tips
- Volumes persist across instance destroy/recreate — use them for datasets and checkpoints
- Local volumes must be on the same machine as the instance
- Network volumes can be accessed from different machines but are slower
- Always check `vastai show volumes` before creating to avoid duplicates
