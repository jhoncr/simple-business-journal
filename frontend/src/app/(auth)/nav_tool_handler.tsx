import { useState, useContext, createContext } from "react";

// this component is used to provide a user context to pages so that they set the nav bar tools correctly
// the user context is provided by the layout component an any child page can use it

// create a context for toolbar
export const toolbarContext = createContext({
    // toolbar: null as React.ReactNode,
    setToolBar: (el:React.ReactNode) => { },
});

// create and export a hook to use the toolbarContext
export const useToolbar = () => useContext(toolbarContext);

