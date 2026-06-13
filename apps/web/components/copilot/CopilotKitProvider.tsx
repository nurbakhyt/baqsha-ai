"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { CopilotTools } from "./CopilotTools";

export function CopilotKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      publicLicenseKey=""
    >
      <CopilotTools />
      <CopilotSidebar
        defaultOpen={false}
        labels={{
          title: "Baqsha.AI Ассистент",
          initial:
            "Привет! Я ваш помощник по заказу свежих фруктов и овощей. Чем могу помочь?",
        }}
        suggestions={[
          { title: "Каталог", message: "Покажи товары" },
          { title: "Корзина", message: "Что в корзине?" },
          { title: "Поиск", message: "Найди лимон" },
        ]}
      >
        {children}
      </CopilotSidebar>
    </CopilotKit>
  );
}