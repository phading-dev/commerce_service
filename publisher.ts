import Stripe from 'stripe';
let stripe = new Stripe('sk_test_51Ny52tEMJ9W7IVj8iGnjmeCJhB58GYzNxct1fMm2NrP98s5AGKZIwWaco63fPgbB4CxPVRpZupScnbFyaLIxYF7P00Sy4VO7iL');

async function main() {
  // let account = await stripe.accounts.create({
  //   controller: {
  //     stripe_dashboard: {
  //       type: "express",
  //     },
  //     fees: {
  //       payer: "application"
  //     },
  //     losses: {
  //       payments: "application"
  //     },
  //   },
  // });
  // console.log('account', JSON.stringify(account));
  let accountId = 'acct_1Q9V3fELpdKpp72m';
  // let accountId = 'acct_1Q9VZoEIoCTLViEL';

  // account.details_submitted
  // const accountLink = await stripe.accountLinks.create({
  //   account: accountId,
  //   return_url: `https://localhost/return/${accountId}`,
  //   refresh_url: `https://localhost/refresh/${accountId}`,
  //   type: "account_onboarding",
  // });
  // console.log('accountLink', JSON.stringify(accountLink));

  // let account = await stripe.accounts.retrieve(accountId);
  // console.log('account', JSON.stringify(account))

  // let loginLink = await stripe.accounts.createLoginLink(accountId);
  // console.log('loginLink', JSON.stringify(loginLink))

  // let transfer = await stripe.transfers.create({
  //   amount: 100,
  //   currency: 'usd',
  //   destination: accountId,
  // });
  // console.log('transfer', JSON.stringify(transfer))
}

main();
