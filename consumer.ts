import Stripe from 'stripe';
let stripe = new Stripe('sk_test_51Ny52tEMJ9W7IVj8iGnjmeCJhB58GYzNxct1fMm2NrP98s5AGKZIwWaco63fPgbB4CxPVRpZupScnbFyaLIxYF7P00Sy4VO7iL');

// One time bootstrap to define meter and pricing.
// Create a new customer
// Create a subscription tied with the customer
// Create a session and collect a payment method.

async function main() {
  // let testClock = await stripe.testHelpers.testClocks.create({
  //   frozen_time: 1728600668,
  // });
  // console.log('testClock', testClock)
  // let testClockId = 'clock_1Q8WetEMJ9W7IVj8phEIc8l5';

  // await stripe.testHelpers.testClocks.advance(
  //   testClockId,
  //   {
  //     frozen_time: 1734156000,
  //   }
  // );

  // let response = await stripe.customers.create({
  //   email: "test.ykuyo@gmail.com",
  //   name: "Test1 test2",
  //   test_clock: testClockId,
  // tax: {
  //   validate_location: 'immediately',
  // },
  // });
  // console.log(JSON.stringify(response));

  let customerId = 'cus_R0XoC00M0SZ0NT';
  // let session = await stripe.checkout.sessions.create({
  //   mode: 'setup',
  //   currency: 'usd',
  //   customer: customerId,
  //   billing_address_collection: 'required',
  //   phone_number_collection: {
  //     enabled: false
  //   },
  //   success_url: 'http://localhost:8080/?session_id={CHECKOUT_SESSION_ID}',
  // });
  // console.log(session.url);

  // let sessionId = 'cs_test_c1oIYPyUU4UtkqWCRKVxHAmhP7tdlNbLlsI3FWUamegJn4czyh27F1afKs';
  // let session = await stripe.checkout.sessions.retrieve(sessionId, {
  //   expand: ['setup_intent']
  // });
  // console.log('session', JSON.stringify(session))
  // let paymentMethodId = 'pm_1Q9bnJEMJ9W7IVj89Zt03IfG';

  // let updatedCustomer = await stripe.customers.update(customerId, {
  //   invoice_settings: {
  //     default_payment_method: paymentMethodId
  //   }
  // });
  // console.log(`updatedCustomer`, JSON.stringify(updatedCustomer));

  // let customer = await stripe.customers.retrieve(customerId, {
  //   expand: ['tax']
  // });
  // console.log(`customer`, JSON.stringify(customer));

  // let paymentMethods = await stripe.customers.listPaymentMethods(customerId);
  // console.log(`paymentMethods`, JSON.stringify(paymentMethods));

  // let updatedCustomer = await stripe.customers.update(customerId, {
  //   address: paymentMethods.data[0].billing_details.address
  // });
  // console.log(`updatedCustomer`, JSON.stringify(updatedCustomer));

  // await stripe.paymentMethods.detach(
  //   paymentMethods.data[0].id
  // );

  // let meter = await stripe.billing.meters.create({
  //   display_name: 'Watch time in seconds',
  //   event_name: 'watch_time',
  //   default_aggregation: {
  //     formula: 'sum',
  //   },
  //   customer_mapping: {
  //     event_payload_key: 'stripe_customer_id',
  //     type: 'by_id',
  //   },
  //   value_settings: {
  //     event_payload_key: 'value',
  //   },
  //   event_time_window: 'day'
  // });
  // console.log(`meter`, JSON.stringify(meter));
  // let meterId = 'mtr_test_61RHstrKm07oRL5LI41EMJ9W7IVj82oa';

  // await stripe.billing.meters.deactivate(meterId);

  // let price = await stripe.prices.create({
  //   currency: 'usd',
  //   unit_amount: 9,
  //   billing_scheme: 'per_unit',
  //   transform_quantity: {
  //     divide_by: 3600,
  //     round: 'up',
  //   },
  //   product_data: {
  //     name: 'Show',
  //   },
  // });
  // console.log(`price`, JSON.stringify(price));
  // let priceId = 'price_1Q8q32EMJ9W7IVj8298bJDhc';

  // let subscription = await stripe.subscriptions.create({
  //   customer: customerId,
  //   items: [
  //     {
  //       price: priceId,
  //     },
  //   ],
  // });
  // console.log('subscription', JSON.stringify(subscription));
  // let subscriptionId = 'sub_1Q8WncEMJ9W7IVj8muLnHTp5';

  // let subscription = await stripe.subscriptions.retrieve(subscriptionId);
  // console.log('subscription', JSON.stringify(subscription));

  // let subscription = await stripe.subscriptions.cancel(
  //   subscriptionId
  // );
  // console.log('subscription', JSON.stringify(subscription));

  // let meterEvent = await stripe.billing.meterEvents.create({
  //   identifier: 'idmp_7',
  //   event_name: 'watch_time',
  //   timestamp: 1733871068,
  //   payload: {
  //     stripe_customer_id: customerId,
  //     value: '30000',
  //   },
  // });
  // console.log('meterEvent', JSON.stringify(meterEvent))

  // let meterEventSummaries = await stripe.billing.meters.listEventSummaries(
  //   meterId,
  //   {
  //     customer: customerId,
  //     start_time: 1731542400,
  //     end_time: 1731801600,
  //     value_grouping_window: 'day',
  //   }
  // );
  // console.log('meterEventSummaries', JSON.stringify(meterEventSummaries))

  // let invoice = await stripe.invoices.create({
  //   customer: customerId,
  //   automatic_tax: {
  //     enabled: true
  //   },
  //   metadata: {
  //     "periodTimestamp": "2024-12-01"
  //   },
  // });
  // console.log('invoice', JSON.stringify(invoice));
  
  // await stripe.invoices.addLines(invoice.id, {
  //   lines: [{
  //     // description: "Watch shows",
  //     // price: priceId,
  //     amount: 67200,
  //     // tax_code: 'txcd_10804002',
  //     period: {
  //       start: 1730419200,
  //       end: 1732924800
  //     }
  //   }]
  // });
  
  // await stripe.invoices.finalizeInvoice(invoice.id, {
  //   auto_advance: true
  // });
  // console.log('invoice', JSON.stringify(invoice));
  // let invoiceId = 'in_1Q8rrSEMJ9W7IVj8C39LynOk';

  // let invoice = await stripe.invoices.retrieve(invoiceId);
  // console.log('invoice', JSON.stringify(invoice));

  // await stripe.invoices.pay(invoiceId);

  // let settings = await stripe.tax.settings.retrieve();
  // console.log('settings', JSON.stringify(settings))

  // let calculation = await stripe.tax.calculations.create({
  //   currency: 'usd',
  //   customer: customerId,
  //   line_items: [
  //     {
  //       amount: 1499,
  //       tax_code: 'txcd_10804002',
  //       reference: 'Cloud streaming service',
  //       tax_behavior: 'exclusive'
  //     },
  //   ],
  // });
  // console.log('calculation', JSON.stringify(calculation))
}

main();
