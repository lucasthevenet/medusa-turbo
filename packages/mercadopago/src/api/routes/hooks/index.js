import { Router } from "express";
import bodyParser from "body-parser";
import middlewares from "../../middlewares";

const route = Router();

export default (app) => {
  app.use("/mercadopago", route);

  route.post(
    "/hooks",
    // mercadopago constructEvent fails without body-parser
    bodyParser.raw({ type: "application/json" }),
    middlewares.wrap(require("./mercadopago").default)
  );
  return app;
};
