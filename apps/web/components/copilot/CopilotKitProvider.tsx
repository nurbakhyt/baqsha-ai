"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export function CopilotKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      publicLicenseKey=""
    >
      <CopilotSidebar
        defaultOpen={false}
        labels={{
          title: "Baqsha.AI Ассистент",
          initial:
            "Привет! Я ваш помощник по заказу свежих фруктов и овощей. Чем могу помочь?",
        }}
      >
        {children}
      </CopilotSidebar>
    </CopilotKit>
  );
}