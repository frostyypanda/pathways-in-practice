#!/bin/bash
# Monitor blob processor progress
# Usage: ./monitor.sh        (single check)
#        watch -n 10 ./monitor.sh  (auto-refresh)

VMS="4.242.217.91 20.172.39.19 135.234.31.104 57.154.19.182"

# Get stats from blob storage
STORAGE_KEY=$(az storage account keys list --account-name decimerstorage50576 --resource-group decimer-rg --query "[0].value" -o tsv 2>/dev/null)

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║          DECIMER BLOB PROCESSOR STATUS - $(date '+%Y-%m-%d %H:%M:%S')          ║"
echo "╠═══════════════════════════════════════════════════════════════════════════╣"

# Check each VM
for IP in $VMS; do
    result=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 azureuser@$IP "
        procs=\$(pgrep -f 'blob_processor' | wc -l)
        workers=\$(pgrep -f 'python.*-c.*DECIMER\|from DECIMER' 2>/dev/null | wc -l || echo 0)
        cpu=\$(cat /proc/loadavg | awk '{print \$1}')
        mem=\$(free | awk '/Mem:/ {printf \"%.0f\", \$3/\$2*100}')
        echo \"\$procs|\$workers|\$cpu|\$mem\"
    " 2>/dev/null)

    if [ -n "$result" ]; then
        IFS='|' read -r procs workers cpu mem <<< "$result"
        if [ "$procs" -gt 0 ]; then
            status="RUNNING"
        else
            status="STOPPED"
        fi
        printf "║ %-15s │ %-8s │ Workers: %2s │ CPU: %5s │ MEM: %2s%%      ║\n" \
            "$IP" "$status" "$workers" "$cpu" "$mem"
    else
        printf "║ %-15s │ %-8s │ %-40s      ║\n" "$IP" "OFFLINE" ""
    fi
done

echo "╠═══════════════════════════════════════════════════════════════════════════╣"

# Get blob storage stats
if [ -n "$STORAGE_KEY" ]; then
    total=$(az storage blob list --account-name decimerstorage50576 --account-key "$STORAGE_KEY" \
        --container-name chemistry-data --query "[?contains(name, '/')].name" -o tsv 2>/dev/null | \
        cut -d'/' -f1 | grep -v "^results$\|^locks$" | sort -u | wc -l)

    completed=$(az storage blob list --account-name decimerstorage50576 --account-key "$STORAGE_KEY" \
        --container-name chemistry-data --prefix "results/" --query "[?contains(name, 'smiles_output.json')].name" \
        -o tsv 2>/dev/null | wc -l)

    locked=$(az storage blob list --account-name decimerstorage50576 --account-key "$STORAGE_KEY" \
        --container-name chemistry-data --prefix "locks/" --query "[].name" -o tsv 2>/dev/null | wc -l)

    remaining=$((total - completed))
    if [ "$total" -gt 0 ]; then
        pct=$((completed * 100 / total))
    else
        pct=0
    fi

    printf "║ PROGRESS: %d / %d completed (%d%%)                                        ║\n" "$completed" "$total" "$pct"
    printf "║ Remaining: %d │ Currently locked: %d                                     ║\n" "$remaining" "$locked"
fi

echo "╚═══════════════════════════════════════════════════════════════════════════╝"
