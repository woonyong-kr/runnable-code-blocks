import * as React from "react";
import { createRoot } from "react-dom/client";

interface ReactPreviewGlobal {
  __RCB_REACT_RUNTIME__: Readonly<{ React: typeof React; createRoot: typeof createRoot }>;
}

(globalThis as unknown as ReactPreviewGlobal).__RCB_REACT_RUNTIME__ = Object.freeze({
  React,
  createRoot
});
