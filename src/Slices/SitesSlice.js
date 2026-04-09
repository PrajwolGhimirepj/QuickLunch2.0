import { createSlice } from "@reduxjs/toolkit";

// Initial sites array
const initialState = {
  sites: [],
};

export const sitesSlice = createSlice({
  name: "sites",
  initialState,
  reducers: {
    addSite: (state, action) => {
      // action.payload should be an object { name, url, logo }
      state.sites.push(action.payload);
    },
  },
});

export const { addSite } = sitesSlice.actions;
export default sitesSlice.reducer;
