"use client";

import OTCDemo from "@/components/OTCDemo";
import { DEMO_CONFIG } from "@/config/demo";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔐 Confidential OTC Escrow
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Trade confidential tokens with zero-knowledge proofs using Zama FHEVM and OpenZeppelin ERC-7984
          </p>
        </div>

        {/* OTC Demo */}
        <OTCDemo
          otcAddress={DEMO_CONFIG.otcAddress}
          gatewayAddress={DEMO_CONFIG.gatewayAddress}
          tokenIn={DEMO_CONFIG.tokenIn}
          tokenOut={DEMO_CONFIG.tokenOut}
        />
      </div>
    </main>
  );
}
