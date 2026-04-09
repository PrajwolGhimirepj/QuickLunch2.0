import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import Test from "./Text/Test";
import store from "./Store"; // default import matches store.js

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
    <Test />
  </Provider>,
);
