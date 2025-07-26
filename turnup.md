1. Run `turnup.sh`.
1. Go to Stripe and get the API secret key and upload it to GCS.
1. Go to Stripe and create a stripe webhook for invoice.paid event, pointing to payment done URL. Copy the secret key and upload to GCS.
1. Go to Stripe and similarly, create one for invoice.payment_failed event. And upload the secret key to GCS.
1. Go to Stripe and similarly, create one for customer.updated event. And upload the secret key to GCS.
1. Go to Stripe and similarly, create one for account.updated event from Connected Account. And upload the secret key to GCS.
1. Go to Stripe and under customer email settings, add/verfify the domain.
1. Go to Sendgrid and create email templates.
