import type { Metadata } from "next";
import "./globals.css";
import { CopilotKitProvider } from "@/components/copilot/CopilotKitProvider";

export const metadata: Metadata = {
  title: "Baqsha.AI — Доставка свежих фруктов и овощей",
  description: "AI-first платформа для заказа свежих фруктов и овощей с доставкой на дом",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <CopilotKitProvider>{children}</CopilotKitProvider>
      </body>
    </html>
  );
}