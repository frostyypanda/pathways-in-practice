#!/bin/bash
# Deploy blob_processor.py to all VMs and start processing
# Usage: ./deploy.sh

set -e

# VM IPs
VMS="4.242.217.91 20.172.39.19 135.234.31.104 57.154.19.182"

# Get storage connection string
STORAGE_KEY=$(az storage account keys list --account-name decimerstorage50576 --resource-group decimer-rg --query "[0].value" -o tsv)
CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=decimerstorage50576;AccountKey=${STORAGE_KEY};EndpointSuffix=core.windows.net"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploying Blob Processor to VMs ==="

for IP in $VMS; do
    echo ""
    echo "--- VM: $IP ---"

    # Kill any existing processors
    echo "Stopping existing processes..."
    ssh -o StrictHostKeyChecking=no azureuser@$IP "pkill -f 'blob_processor\|process_partition' 2>/dev/null || true"

    # Copy the processor script
    echo "Copying blob_processor.py..."
    scp -o StrictHostKeyChecking=no "$SCRIPT_DIR/blob_processor.py" azureuser@$IP:/opt/decimer/

    # Start the processor
    echo "Starting processor..."
    ssh -o StrictHostKeyChecking=no azureuser@$IP "
        cd /opt/decimer
        source venv/bin/activate
        export AZURE_STORAGE_CONNECTION_STRING='$CONNECTION_STRING'
        export AZURE_CONTAINER_NAME='chemistry-data'
        nohup python blob_processor.py > processor.log 2>&1 &
        sleep 2
        if pgrep -f 'blob_processor' > /dev/null; then
            echo 'Started successfully'
        else
            echo 'Failed to start!'
            tail -20 processor.log
        fi
    "
done

echo ""
echo "=== Deployment Complete ==="
echo "Monitor with: ./monitor.sh"
