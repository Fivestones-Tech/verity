"use client";

import { useEffect } from "react";

/** After sign-out, delete any test data stored on this device (shared devices, docs/17). */
export function WipeDevice() {
  useEffect(() => {
    import("@/lib/offline/store").then((s) => s.wipeAll()).catch(() => {});
    import("@/lib/offline/app-shell").then((s) => s.clearOfflineShell()).catch(() => {});
  }, []);
  return null;
}
