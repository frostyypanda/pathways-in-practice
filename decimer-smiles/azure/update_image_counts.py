#!/usr/bin/env python3
"""Update database with correct image counts from output folders."""

import psycopg2
from azure.storage.blob import BlobServiceClient
from db_config import DB_CONFIG, BLOB_CONNECTION_STRING, BLOB_CONTAINER

def main():
    # Connect to blob storage
    blob_service = BlobServiceClient.from_connection_string(BLOB_CONNECTION_STRING)
    container = blob_service.get_container_client(BLOB_CONTAINER)

    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Get all synthesis directories
    cur.execute("SELECT name FROM synthesis ORDER BY name")
    directories = [row[0] for row in cur.fetchall()]

    print(f"Updating image counts for {len(directories)} directories...")

    total_images = 0
    for i, directory in enumerate(directories):
        # Count images in output folder
        prefix = f"{directory}/output/"
        count = 0
        for blob in container.list_blobs(name_starts_with=prefix):
            if blob.name.lower().endswith(('.png', '.jpg', '.jpeg')):
                count += 1

        # Update database
        cur.execute("UPDATE synthesis SET image_count = %s WHERE name = %s", (count, directory))
        total_images += count

        if (i + 1) % 100 == 0:
            print(f"Progress: {i+1}/{len(directories)} - Total images so far: {total_images}")
            conn.commit()

    conn.commit()
    cur.close()
    conn.close()

    print(f"\nDone! Total images in output folders: {total_images}")
    print(f"Average per directory: {total_images / len(directories):.1f}")

if __name__ == '__main__':
    main()
