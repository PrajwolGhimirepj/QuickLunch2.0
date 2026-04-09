import { configureStore } from "@reduxjs/toolkit";
import sitesReducer from "./Slices/SitesSlice"; // use default import

const store = configureStore({
  reducer: {
    sites: sitesReducer,
  },
});

export default store; // default export
