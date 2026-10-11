"use client";

import { createContext, useContext } from "react";

const AiContext = createContext(false);

export function AiProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <AiContext value={enabled}>{children}</AiContext>;
}

/** Whether AI features are configured on the server. When false, AI buttons are not shown at all. */
export function useAi() {
  return useContext(AiContext);
}
