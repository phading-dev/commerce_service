#!/bin/bash

# Env variables
export PROJECT_ID=phading-dev
export INSTANCE_ID=test
export DATABASE_ID=test
export FROM_EMAIL_ADDRESS=contact-test@ykuyo.com
export ACCOUNT_SUSPENSION_CONTACT_EMAIL_ADDRESS=contact-test@ykuyo.com
export UPDATE_PAYMENT_METHOD_EN_EMAIL_TEMPLATE_ID=d-ff7a366080984aa5a00231e211214943
export ACCOUNT_SUSPENSION_EN_EMAIL_TEMPLATE_ID=d-a52bef48f029473498cc69c5a29c4b23
export SETUP_STRIPE_CONNECTED_ACCOUNT_EN_EMAIL_TEMPLATE_ID=d-355d950b920a4557a5c0ee35a40f1020

# GCP auth
gcloud auth application-default login

# Spanner
gcloud spanner instances create test --config=regional-us-central1 --description="test" --edition=STANDARD --processing-units=100
gcloud spanner databases create test --instance=test
npx spanage update db/ddl -p phading-dev -i test -d test
