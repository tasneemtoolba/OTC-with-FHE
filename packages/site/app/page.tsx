"use client";

import OTCDemo from "@/components/OTCDemo";
import { DEMO_CONFIG } from "@/config/demo";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* OTC Demo */}
      <OTCDemo
        otcAddress={DEMO_CONFIG.otcAddress}
        gatewayAddress={DEMO_CONFIG.gatewayAddress}
        tokenIn={DEMO_CONFIG.tokenIn}
        tokenOut={DEMO_CONFIG.tokenOut}
      />
    </main>
  );
}
