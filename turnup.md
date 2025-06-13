1. Run `turnup.sh`.
1. Go to Stripe and get the API secret key and upload it to GCS.
1. Go to Stripe and create a stripe webhook for payment succeeded event, pointing to payment done URL. Copy the secret key and upload to GCS.
1. Go to Stripe and similarly, create one for payment failed event. And upload the secret key to GCS.
1. Go to Sendgrid and create an API key and upload the key to GCS.
1. Go to Sendgrid and under "sender authentication", authenticate the domain.
1. Go to Sendgrid and create email templates.
