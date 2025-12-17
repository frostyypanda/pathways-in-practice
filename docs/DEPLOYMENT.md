# Deployment Guide

Pathways Practice is deployed to Azure Static Web Apps with a custom domain.

## Current Deployment

- **URL:** https://pathwayspractice.org
- **Azure URL:** https://gentle-smoke-02b3f020f.3.azurestaticapps.net
- **Static Web App:** `pathways-practice-app`
- **Resource Group:** `pathways-practice`
- **Region:** East US 2
- **Domain Registrar:** easyname

## Prerequisites

- Azure CLI installed (`az`)
- Azure Static Web Apps CLI installed (`npm install -g @azure/static-web-apps-cli`)
- Logged in to Azure (`az login`)
- Correct subscription selected (`az account set --subscription "DEV - PracticeVaultAI"`)

## Deploy Steps

### 1. Build the production version

```bash
npm run build
```

This creates the `dist/` folder with optimized assets.

### 2. Get deployment token

```bash
az staticwebapp secrets list --name pathways-practice-app --resource-group pathways-practice --query "properties.apiKey" -o tsv
```

### 3. Deploy to Azure Static Web Apps

```bash
swa deploy ./dist --deployment-token <YOUR_TOKEN> --env production
```

## Quick Deploy Script

Add to `package.json`:

```json
{
  "scripts": {
    "deploy": "npm run build && swa deploy ./dist --deployment-token <YOUR_TOKEN> --env production"
  }
}
```

Then run:

```bash
npm run deploy
```

## DNS Configuration (easyname)

The following DNS records are configured at easyname:

| Type  | Host | Value |
|-------|------|-------|
| TXT   | @    | `_sd0jsdtyh5qywxxjw2ktxyef7uoulvn` |
| ALIAS | @    | `gentle-smoke-02b3f020f.3.azurestaticapps.net` |
| CNAME | www  | `gentle-smoke-02b3f020f.3.azurestaticapps.net` |

## First-Time Setup (Azure Static Web Apps)

### 1. Create resource group

```bash
az group create --name pathways-practice --location eastus2
```

### 2. Create Static Web App

```bash
az staticwebapp create \
  --name pathways-practice-app \
  --resource-group pathways-practice \
  --location eastus2 \
  --sku Free
```

### 3. Add custom domain

```bash
az staticwebapp hostname set \
  --name pathways-practice-app \
  --resource-group pathways-practice \
  --hostname pathwayspractice.org \
  --validation-method dns-txt-token
```

### 4. Get TXT validation token

```bash
az staticwebapp hostname show \
  -n pathways-practice-app \
  -g pathways-practice \
  --hostname pathwayspractice.org \
  --query "validationToken"
```

Add this TXT record to your DNS, then Azure will validate and provision SSL automatically.

## Notes

- Azure Static Web Apps provides free SSL certificates
- Client-side routing (React Router) requires `public/staticwebapp.config.json` with a `navigationFallback` rule (already configured)
- PWA service worker is included in the build
- All JSON data files are cached for offline use

## SPA Routing Configuration

The file `public/staticwebapp.config.json` enables client-side routing by telling Azure to serve `index.html` for all routes that don't match actual files. This is required for shared links (e.g., `/synthesis/some-id`) to work correctly.

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/data/*", "/assets/*", "*.js", "*.css", "*.png", "*.jpg", "*.svg", "*.ico", "*.json"]
  }
}
```

Without this config, direct links to routes return 404 because Azure looks for a literal file at that path.
