---
name: search-gpus
description: "Search for available GPU machines on Vast.ai. Use when looking for GPUs to rent, comparing GPU pricing, or finding machines that match specific requirements."
allowed-tools: Bash
---

# Search Vast.ai GPU Offers

Help the user find the best GPU offers on Vast.ai.

## User Request

The user's request is the text appended after the skill command (`/skill:search-gpus <request>`); if nothing was appended, use the current conversation.

## Instructions

1. **Understand requirements**: Key dimensions to determine:
   - GPU model (RTX 4090, A100, H100, etc.)
   - Number of GPUs
   - VRAM requirements
   - Budget ($/hr)
   - Region preferences
   - Reliability needs
   - Pricing type (on-demand vs spot/interruptible vs reserved)

2. **Build the search query** from the mapping below.

3. **Run the search** and present results clearly.

4. **Help interpret**: Highlight best options based on user priorities.

## Query Construction

| User says | Query field |
|-----------|-------------|
| "4090", "RTX 4090" | `gpu_name=RTX_4090` |
| "A100 80GB" | `gpu_name=A100 gpu_ram>=80` |
| "H100" | `gpu_name=H100` |
| "4 GPUs", "multi-GPU" | `num_gpus>=4` |
| "at least 48GB VRAM" | `gpu_total_ram>=48` |
| "under $1/hr", "cheap" | `dph_total<1.0` |
| "reliable" | `reliability>0.95` |
| "US only" | `geolocation=US` |
| "datacenter" | `datacenter=true` |
| "spot", "interruptible" | add `-b` flag |
| "reserved" | add `-r` flag |
| "NVLink" | `bw_nvlink>0` |
| "fast internet" | `inet_down>500` |

Always include `reliability>0.9` unless the user wants cheaper unreliable machines.

Default sort: `-o 'dph_total'` (cheapest first).

## Examples

```bash
# Cheap single 4090
vastai search offers 'gpu_name=RTX_4090 num_gpus=1 reliability>0.9' -o 'dph_total'

# 8x H100 for large training
vastai search offers 'gpu_name=H100 num_gpus=8 reliability>0.95' -o 'dph_total'

# Any GPU with 80GB+ VRAM in US datacenters
vastai search offers 'gpu_total_ram>=80 geolocation=US datacenter=true reliability>0.95' -o 'dph_total'

# Budget multi-GPU fine-tuning
vastai search offers 'num_gpus>=2 gpu_ram>=24 dph_total<1.5 reliability>0.9' -o 'dph_total'

# Spot pricing for H100s
vastai search offers 'gpu_name=H100 num_gpus>=4' -b -o 'dph_total'
```

## Presenting Results

After running the search:
1. Summarize top 3-5 options in a clear table with: Offer ID, GPU, # GPUs, VRAM, $/hr, Reliability, Location
2. Highlight the offer ID prominently — user needs it to launch
3. Note trade-offs (price vs reliability vs perf)
4. Mention spot pricing if it would save significantly
5. If no results, suggest relaxing constraints
