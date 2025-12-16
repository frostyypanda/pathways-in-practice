#!/usr/bin/env python3
"""Submit a pre-built JSONL file to Gemini Batch API."""
import sys
import os
from google import genai
from dotenv import load_dotenv

load_dotenv('.env')

if len(sys.argv) < 2:
    print("Usage: python submit_file.py <jsonl_file>")
    sys.exit(1)

filename = sys.argv[1]
client = genai.Client(api_key=os.getenv('GOOGLE_API_KEY'))

print(f'Uploading {filename}...')
f = client.files.upload(file=filename, config={'mime_type': 'application/jsonl'})
print(f'Uploaded: {f.name}')

job = client.batches.create(model='gemini-2.5-flash', src=f.name, config={'display_name': filename.replace('.jsonl', '')})
print(f'Job: {job.name}')
print(f'Status: {job.state.name}')
