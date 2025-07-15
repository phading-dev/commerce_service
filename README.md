## Stripe info

### Tax origin

Delaware US

### Tax code

txcd_10804002: Digital Audio Visual Works - bundle - downloaded with limited rights and streamed - non subscription

### Public details

Under Settings > Business details, update business name, support email and address and website.

### Payment retries

Under Revenue recovery > retries, disable "Smart Retries" by using a custom retry policy for subscriptions, which also cover our use case.

### Set up Stripe Connect

Choose “Buyers will purchase from you”
Agreed to Stripe’s restriction requirements.
Choose “Payouts will be split between sellers”
Under Onboarding Options, choose all countries.

When creating a connected account, use  “digital_goods_media” (5815) as merchant category codes (MCC).

### Email settings

Under Settings > Customer emails, turn on email for successful payments and refund.

Under Settings > Subscription and emails, turn on 

### Test credit cards

https://docs.stripe.com/testing#cards
