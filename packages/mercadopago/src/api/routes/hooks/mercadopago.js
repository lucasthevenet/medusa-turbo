export default async (req, res) => {
  let event;
  try {
    const mercadoPagoProviderService = req.scope.resolve("pp_mercadopago");
    event = await mercadoPagoProviderService.constructWebhookEvent(req.body);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const paymentIntent = event.data;
  const cartService = req.scope.resolve("cartService");
  const orderService = req.scope.resolve("orderService");

  const cartId = paymentIntent.metadata.cart_id;
  const order = await orderService
    .retrieveByCartId(cartId)
    .catch(() => undefined);

  // handle payment intent events
  switch (event.action) {
    case "payment.created":
      if (order && order.payment_status !== "captured") {
        await orderService.capturePayment(order.id);
      }
      break;
    case "payment.updated":
      if (order) {
        await orderService.update(order._id, {
          status: "canceled",
        });
      }
      break;
    case "payment_intent.amount_capturable_updated":
      if (!order) {
        await cartService.setPaymentSession(cartId, "mercadopago");
        await cartService.authorizePayment(cartId);
        await orderService.createFromCart(cartId);
      }
      break;
    default:
      res.sendStatus(204);
      return;
  }

  res.sendStatus(200);
};
