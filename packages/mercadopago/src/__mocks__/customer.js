import { IdMap } from "medusa-test-utils";

export const CustomerServiceMock = {
  retrieve: jest.fn().mockImplementation((id) => {
    if (id === IdMap.getId("lebron")) {
      return Promise.resolve({
        _id: IdMap.getId("lebron"),
        first_name: "LeBron",
        last_name: "James",
        email: "lebron@james.com",
        password_hash: "1234",
        metadata: {
          mercadopago_id: "cus_123456789_new",
        },
      });
    }
    if (id === IdMap.getId("vvd")) {
      return Promise.resolve({
        _id: IdMap.getId("vvd"),
        first_name: "Virgil",
        last_name: "Van Dijk",
        email: "virg@vvd.com",
        password_hash: "1234",
        metadata: {},
      });
    }
    return Promise.resolve(undefined);
  }),
  update: jest.fn().mockImplementation((id, update) => {
    return Promise.resolve({
      _id: IdMap.getId("lebron"),
      first_name: "LeBron",
      last_name: "James",
      email: "lebron@james.com",
      password_hash: "1234",
      ...update,
    });
  }),
  setMetadata: jest.fn().mockReturnValue(Promise.resolve()),
};

const mock = jest.fn().mockImplementation(() => {
  return CustomerServiceMock;
});

export default mock;
