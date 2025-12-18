import os
from pathlib import Path

# Load .env file if it exists
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())

# PostgreSQL Configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', ''),
    'database': os.environ.get('DB_NAME', ''),
    'user': os.environ.get('DB_USER', ''),
    'password': os.environ.get('DB_PASSWORD', ''),
    'sslmode': 'require'
}

# NOTE: For psql command line, special characters in password need URL encoding.
# The '!' must be encoded as '%21':
#   PGSSLMODE=require psql "postgresql://$DB_USER:${DB_PASSWORD_ENCODED}@$DB_HOST/$DB_NAME"
# psycopg2 (Python) handles this automatically with the DB_CONFIG dict above.

# Azure Blob Storage
BLOB_CONNECTION_STRING = os.environ.get('BLOB_CONNECTION_STRING', '')
BLOB_CONTAINER = os.environ.get('BLOB_CONTAINER', 'chemistry-data')
