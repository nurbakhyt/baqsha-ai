"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { CopilotTools } from "./CopilotTools";

export function CopilotKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl={`${process.env.NEXT_PUBLIC_API_URL || "https://baqsha-worker.nurbakhyt.workers.dev"}/api/copilotkit`}
    >
      <CopilotTools />
      <CopilotSidebar
        defaultOpen={false}
        labels={{
          title: "Baqsha.AI Ассистент",
          initial:
            "Я ваш помощник по заказу свежих фруктов и овощей. Чем могу помочь?",
        }}
      >
        {children}
      </CopilotSidebar>
    </CopilotKit>
  );
}
