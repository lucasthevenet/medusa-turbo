export const MercadoPagoMock = {
  customers: {
    create: jest.fn().mockImplementation((data) => {
      if (data.email === "virg@vvd.com") {
        return Promise.resolve({
          id: "cus_vvd",
          email: "virg@vvd.com",
        });
      }
      return Promise.resolve({
        id: "cus_lebron",
        email: "lebron@james.com",
      });
    }),
    cards: {
      all: jest.fn().mockImplementation((customerId) => {
          return Promise.resolve([
            {
              id: "card_1",
              last4: "4242",
              brand: "Visa",
              exp_month: "12",
              exp_year: "2021",
            },
          ]);
      })
    }
  },
  payment: {
    create: jest.fn().mockImplementation((data) => {
      if (data.payer.id === "cus_123456789_new") {
        return Promise.resolve({
          id: "pi_lebron",
          transaction_amount: 100,
          payer: {
            id: "cus_123456789_new",
          },
        });
      }
      if (data.payer.id === "cus_lebron") {
        return Promise.resolve({
          id: "pi_lebron",
          transaction_amount: 100,
          payer: {
            id: "cus_lebron",
          },
        });
      }
    }),
    get: jest.fn().mockImplementation((data) => {
      return Promise.resolve({
        id: "pi_lebron",
        payer: {
          id: "cus_lebron",
        },
      });
    }),
    update: jest.fn().mockImplementation((data) => {
      if (data.payer?.id === "cus_lebron_2") {
        return Promise.resolve({
          id: "pi_lebron",
          payer: {
            id: "cus_lebron_2",
          },
          transaction_amount: 1000,
        });
      }
      return Promise.resolve({
        id: "pi_lebron",
        payer: {
          id: "cus_lebron",
        },
        transaction_amount: 1000,
      });
    }),
    capture: jest.fn().mockImplementation((data) => {
      return Promise.resolve({
        id: "pi_lebron",
        payer: {
          id: "cus_lebron",
        },
        transaction_amount: 1000,
        status: "succeeded",
      });
    }),
    cancel: jest.fn().mockImplementation((data) => {
      return Promise.resolve({
        id: "pi_lebron",
        payer: {
          id: "cus_lebron",
        },
        status: "cancelled",
      });
    }),
  },
  refund: {
    create: jest.fn().mockImplementation((data) => {
      return Promise.resolve({
        id: "re_123",
        payment_intent: "pi_lebron",
        amount: 1000,
        status: "succeeded",
      });
    }),
  },
  configure: jest.fn().mockImplementation((data) => Promise.resolve()),
};

const mercadopago = MercadoPagoMock;

export default mercadopago;
