#!/bin/bash
# VM Setup Script for DECIMER Blob Processor
# Run this on each VM to set up the environment

set -e

echo "=== Setting up DECIMER Blob Processor ==="

# Install system dependencies
echo "Installing system packages..."
sudo apt-get update
sudo apt-get install -y python3.10 python3.10-venv python3-pip libgl1-mesa-glx

# Create working directory
sudo mkdir -p /opt/decimer
sudo chown $USER:$USER /opt/decimer
cd /opt/decimer

# Create virtual environment
echo "Creating Python virtual environment..."
python3.10 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "Installing Python packages..."
pip install --upgrade pip
pip install decimer psutil azure-storage-blob psycopg2-binary

# Pre-download DECIMER model (avoids race condition)
echo "Pre-downloading DECIMER model..."
python -c "from DECIMER import predict_SMILES; print('Model loaded')"

# Copy the processor script (will be done separately)
echo "Setup complete!"
echo ""
echo "To run the processor:"
echo "  export AZURE_STORAGE_CONNECTION_STRING='your-connection-string'"
echo "  cd /opt/decimer && source venv/bin/activate"
echo "  python blob_processor.py"
