import _ from "lodash";
import {
  AbstractPaymentService,
  PaymentSessionData,
  PaymentSessionStatus,
} from "@medusajs/medusa"
import mercadopago from "mercadopago";

class MercadoPagoProviderService extends AbstractPaymentService {
  static identifier = "mercadopago";

  constructor(
    { customerService, totalsService, regionService, manager },
    options
  ) {
    super({ customerService, totalsService, regionService, manager }, options);

    /**
     * Required MercadoPago options:
     *  {
     *    access_token: "meli_access_token", REQUIRED
     *    // Use this flag to capture payment immediately (default is false)
     *    capture: true
     *   // Description that the payment will appear with in the card statement
     *   statement_descriptor: 'MEDUSA' REQUIRED
     *  }
     */
    this.options_ = options;

    /** @private @const {MercadoPago} */
    this.mercadopago_ = mercadopago;

    this.mercadopago_.configure({
      access_token: options.access_token,
    });

    /** @private @const {CustomerService} */
    this.customerService_ = customerService;

    /** @private @const {RegionService} */
    this.regionService_ = regionService;

    /** @private @const {TotalsService} */
    this.totalsService_ = totalsService;

    /** @private @const {EntityManager} */
    this.manager_ = manager
  }

  /**
   * Creates a MercadoPago payment intent.
   * If customer is not registered in MercadoPago, we do so.
   * @param {object} cart - cart to create a payment for
   * @returns {object} MercadoPago payment intent
   */
  async createPayment(cart) {
    const { customer_id, region_id, email, shipping_address, items } = cart;
    const { currency_code } = await this.regionService_.retrieve(region_id);

    const amount = await this.totalsService_.getTotal(cart);
    console.log(cart)
    const intentRequest = {
      // currency: currency_code,
      // setup_future_usage: "on_session",
      transaction_amount: Math.round(amount),
      capture: this.options_.capture,
      metadata: { cart_id: `${cart.id}` },
      description:
        cart?.context?.payment_description ?? this.options?.payment_description,
      statement_descriptor: this.options?.statement_descriptor,
      additional_info: {
        items,
        shipments: {
          receiver_address: shipping_address,
        },
        payer: {
          first_name: '',
          last_name: '',
          phone: {
            area_code: '',
            number: '',
          },
          address: {}
        }
      }
    };

    if (customer_id) {
      const customer = await this.customerService_.retrieve(customer_id);

      if (customer.metadata?.mercadopago_id) {
        intentRequest.payer = {
          id: customer.metadata.mercadopago_id,
          type: "customer",
          email,
        };
      } else {
        const mercadoPagoCustomer = await this.createCustomer({
          email,
          id: customer_id,
        });

        intentRequest.payer = {
          id: mercadoPagoCustomer.id,
          type: "customer",
        };
      }
    } else {
      const mercadoPagoCustomer = await this.createCustomer({
        email,
      });

      intentRequest.payer = {
        id: mercadoPagoCustomer.id,
        type: "customer",
      };
    }

    const paymentIntent = await this.mercadopago_.payment.create(intentRequest);

    return paymentIntent;
  }

  /**
   * Fetches MercadoPago's payment intent. Check its status and returns the
   * corresponding Medusa status.
   * @param {object} paymentData - payment method data from cart
   * @returns {string} the status of the payment intent
   */
  async getStatus(paymentData) {
    const paymentIntent = await this.retrievePayment(paymentData);

    switch (paymentIntent.status) {
      case "approved":
      case "authorized":
        return PaymentSessionStatus.AUTHORIZED;
      case "refunded":
      case "charged_back":
      case "cancelled":
        return PaymentSessionStatus.CANCELED;
      case "rejected":
        return PaymentSessionStatus.ERROR;
      case "pending":
      case "in_process":
      case "in_mediation":
        return PaymentSessionStatus.PENDING;
      default:
        return PaymentSessionStatus.PENDING;
    }
  }

  /**
   * Fetches a customers saved payment methods if registered in MercadoPago.
   * @param {object} customer - customer to fetch saved cards for
   * @returns {Promise<Array<object>>} saved payments methods
   */
  async retrieveSavedMethods(customer) {
    if (customer.metadata && customer.metadata.mercadopago_id) {
      const methods = await this.mercadopago_.customer.card.all(
        customer.metadata.mercadopago_id
      );

      return methods;
    }

    return Promise.resolve([]);
  }

  /**
   * Fetches a MercadoPago customer
   * @param {string} customerId - MercadoPago customer id
   * @returns {Promise<object>} MercadoPago customer
   */
  async retrieveCustomer(customerId) {
    if (!customerId) {
      return Promise.resolve();
    }
    return this.mercadopago_.customers.get(customerId);
  }

  /**
   * Creates a MercadoPago customer using a Medusa customer.
   * @param {object} customer - Customer data from Medusa
   * @returns {Promise<object>} MercadoPago customer
   */
  async createCustomer(customer) {
    try {
      const mercadoPagoCustomer = await this.mercadopago_.customers.create({
        email: customer.email,
      });

      if (customer.id) {
        await this.customerService_.update({
          id: customer.id,
          metadata: { mercadopago_id: mercadoPagoCustomer.id },
        });
      }

      return mercadoPagoCustomer;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves MercadoPago payment intent.
   * @param {object} data - the data of the payment to retrieve
   * @returns {Promise<object>} MercadoPago payment intent
   */
  async retrievePayment(data) {
    try {
      return this.mercadopago_.payment.get(data.id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets a MercadoPago payment intent and returns it.
   * @param {object} sessionData - the data of the payment to retrieve
   * @returns {Promise<object>} MercadoPago payment intent
   */
  async getPaymentData(sessionData) {
    try {
      return this.mercadopago_.payment.get(sessionData.data.id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Authorizes MercadoPago payment intent by simply returning
   * the status for the payment intent in use.
   * @param {object} sessionData - payment session data
   * @param {object} context - properties relevant to current context
   * @returns {Promise<{ status: string, data: object }>} result with data and status
   */
  async authorizePayment(sessionData, context = {}) {
    const stat = await this.getStatus(sessionData.data);

    try {
      return { data: sessionData.data, status: stat };
    } catch (error) {
      throw error;
    }
  }

  async updatePaymentData(sessionData, update) {
    try {
      return this.mercadopago_.payment.update({
        id: sessionData.id,
        ...update.data,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates MercadoPago payment intent.
   * @param {object} sessionData - payment session data.
   * @param {object} update - objec to update intent with
   * @returns {object} MercadoPago payment intent
   */
  async updatePayment(sessionData, cart) {
    try {
      const mercadoPagoId =
        cart.customer?.metadata?.mercadopago_id || undefined;

      if (mercadoPagoId !== sessionData?.payer?.id) {
        return this.createPayment(cart);
      } else {

        if (cart.total && sessionData.transaction_amount === Math.round(cart.total)) {
          return sessionData;
        }

        return this.mercadopago_.payment.update({
          id: sessionData.id,
          transaction_amount: Math.round(cart.total),
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async deletePayment(payment) {
    try {
      const { id } = payment.data;
      return this.mercadopago_.payment.cancel(id).catch((err) => {
        if (err.statusCode === 400) {
          return;
        }
        throw err;
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Captures payment for MercadoPago payment intent.
   * @param {object} paymentData - payment method data from cart
   * @returns {object} MercadoPago payment intent
   */
  async capturePayment(payment) {
    const { id } = payment.data;
    try {
      const intent = await this.mercadopago_.payment.capture(id);
      return intent;
    } catch (error) {
      if (error.code === "payment_intent_unexpected_state") {
        if (error.payment_intent.status === "succeeded") {
          return error.payment_intent;
        }
      }
      throw error;
    }
  }

  /**
   * Refunds payment for MercadoPago payment intent.
   * @param {object} paymentData - payment method data from cart
   * @param {number} amountToRefund - amount to refund
   * @returns {string} refunded payment intent
   */
  async refundPayment(payment, amountToRefund) {
    const { id } = payment.data;
    try {
      await this.mercadopago_.refund.create({
        amount: Math.round(amountToRefund),
        payment_id: id,
      });

      return payment.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancels payment for MercadoPago payment intent.
   * @param {object} paymentData - payment method data from cart
   * @returns {object} canceled payment intent
   */
  async cancelPayment(payment) {
    const { id } = payment.data;
    try {
      return await this.mercadopago_.payment.cancel(id);
    } catch (error) {
      if (error.payment_intent.status === "canceled") {
        return error.payment_intent;
      }

      throw error;
    }
  }

  /**
   * Constructs MercadoPago Webhook event
   * @param {object} event - the data of the webhook request: req.body
   * @returns {object} MercadoPago Webhook event
   */
  async constructWebhookEvent(event) {
    const { id } = event.data;
    let data;
    switch (event.type) {
      case "payment":
        data = await this.mercadopago_.payment.get(id);
        break;
      case "plan":
        data = await this.mercadopago_.plan.get(id);
        break;
      case "subscription":
        data = await this.mercadopago_.subscription.get(id);
        break;
      case "invoice":
        data = await this.mercadopago_.invoice.get(id);
        break;
      default:
        data = event.data;
        break;
    }
    return {
      ...event,
      data,
    };
  }
}

export default MercadoPagoProviderService;
