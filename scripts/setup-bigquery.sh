#!/bin/bash

# BigQuery Setup Script
# This script helps set up Google Cloud BigQuery for the trading application

set -e

echo "🚀 Setting up BigQuery for Trading Application"
echo "=============================================="

# Check if required environment variables are set
if [ -z "$GOOGLE_CLOUD_PROJECT_ID" ]; then
    echo "❌ GOOGLE_CLOUD_PROJECT_ID environment variable is required"
    echo "Please set it in your .env.local file"
    exit 1
fi

PROJECT_ID=$GOOGLE_CLOUD_PROJECT_ID
SERVICE_ACCOUNT_NAME="trading-data-service"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="./trading-data-key.json"

echo "📋 Configuration:"
echo "   Project ID: $PROJECT_ID"
echo "   Service Account: $SERVICE_ACCOUNT_EMAIL"
echo ""

# Check if user is authenticated
echo "🔐 Checking Google Cloud authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ You are not authenticated with Google Cloud"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set the project
echo "📂 Setting Google Cloud project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable bigquery.googleapis.com
gcloud services enable bigquerystorage.googleapis.com

# Create service account if it doesn't exist
echo "👤 Creating service account..."
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL >/dev/null 2>&1; then
    echo "   Service account already exists"
else
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="Trading Data Service Account" \
        --description="Service account for trading data BigQuery operations"
fi

# Grant necessary permissions
echo "🔑 Granting BigQuery permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/bigquery.jobUser"

# Create and download service account key
echo "🗝️  Creating service account key..."
if [ -f "$KEY_FILE" ]; then
    echo "   Key file already exists, backing up..."
    cp "$KEY_FILE" "${KEY_FILE}.backup.$(date +%s)"
fi

gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SERVICE_ACCOUNT_EMAIL

echo "✅ Service account key created: $KEY_FILE"

# Create BigQuery dataset and tables
echo "🗄️  Setting up BigQuery dataset and tables..."

# Create dataset
if bq ls -d $PROJECT_ID:trading_data >/dev/null 2>&1; then
    echo "   Dataset 'trading_data' already exists"
else
    bq mk --dataset --location=US $PROJECT_ID:trading_data
    echo "   Created dataset 'trading_data'"
fi

# Create tables using the schema file
echo "   Creating tables from schema..."
bq query --use_legacy_sql=false < src/app/actions/bigquery/schema.sql

echo ""
echo "🎉 BigQuery setup completed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Add the following to your .env.local file:"
echo "      GOOGLE_CLOUD_KEY_FILE=$(pwd)/$KEY_FILE"
echo ""
echo "   2. For production deployment, use environment variables instead:"
echo "      GOOGLE_CLOUD_CLIENT_EMAIL=$SERVICE_ACCOUNT_EMAIL"
echo "      GOOGLE_CLOUD_PRIVATE_KEY=\"$(cat $KEY_FILE | jq -r .private_key)\""
echo ""
echo "   3. Generate a secure cron token:"
echo "      CRON_SECRET_TOKEN=$(openssl rand -base64 32)"
echo ""
echo "   4. Test the setup by calling:"
echo "      curl -X POST http://localhost:3000/api/bigquery/setup"
echo ""
echo "⚠️  SECURITY NOTE:"
echo "   Keep your service account key file secure and never commit it to version control!"
echo "   Consider adding 'trading-data-key.json' to your .gitignore file"

# Add to gitignore if not already there
if ! grep -q "trading-data-key.json" .gitignore 2>/dev/null; then
    echo "trading-data-key.json" >> .gitignore
    echo "   Added key file to .gitignore"
fi