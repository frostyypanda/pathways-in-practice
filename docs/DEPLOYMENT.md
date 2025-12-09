# Deployment Guide

OpenSynth is deployed to Azure Blob Storage with static website hosting.

## Current Deployment

- **URL:** https://opensynth19904.z20.web.core.windows.net/
- **Storage Account:** `opensynth19904`
- **Resource Group:** `rg-public-webpage`
- **Region:** East US 2

## Prerequisites

- Azure CLI installed (`az`)
- Logged in to Azure (`az login`)
- Correct subscription selected (`az account set --subscription "DEV - PracticeVaultAI"`)

## Deploy Steps

### 1. Build the production version

```bash
npm run build
```

This creates the `dist/` folder with optimized assets.

### 2. Upload to Azure Storage

```bash
az storage blob upload-batch \
  --account-name opensynth19904 \
  --source dist \
  --destination '$web' \
  --overwrite
```

## First-Time Setup (if creating new storage account)

### 1. Create storage account

```bash
az storage account create \
  --name <unique-name> \
  --resource-group rg-public-webpage \
  --location eastus2 \
  --sku Standard_LRS \
  --kind StorageV2
```

### 2. Enable static website hosting

```bash
az storage blob service-properties update \
  --account-name <storage-name> \
  --static-website \
  --index-document index.html \
  --404-document index.html
```

### 3. Upload files

```bash
az storage blob upload-batch \
  --account-name <storage-name> \
  --source dist \
  --destination '$web' \
  --overwrite
```

### 4. Get the URL

```bash
az storage account show \
  --name <storage-name> \
  --query "primaryEndpoints.web" \
  --output tsv
```

## Quick Deploy Script

Add to `package.json`:

```json
{
  "scripts": {
    "deploy": "npm run build && az storage blob upload-batch --account-name opensynth19904 --source dist --destination '$web' --overwrite"
  }
}
```

Then run:

```bash
npm run deploy
```

## Notes

- The `--404-document index.html` setting enables client-side routing (React Router)
- PWA service worker is included in the build
- All JSON data files are cached for offline use
