#!/bin/bash
echo "Creating Python virtual environment..."
python3 -m venv venv

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Setup complete! Virtual environment is ready."
echo "To activate manually, run: source venv/bin/activate"
