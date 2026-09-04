import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";

interface ReactPreviewGlobal {
  __RCB_REACT_RUNTIME__: Readonly<{
    React: typeof React;
    ReactDOM: typeof ReactDOM;
    ReactDOMClient: typeof ReactDOMClient;
  }>;
}

(globalThis as unknown as ReactPreviewGlobal).__RCB_REACT_RUNTIME__ = Object.freeze({
  React,
  ReactDOM,
  ReactDOMClient
});
