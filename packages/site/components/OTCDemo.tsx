import { useState } from "react";
import CreateOrder from "./CreateOrder";
import FillOrder from "./FillOrder";
import { Orders } from "./Orders";
import { RevealAndAudit } from "./RevealAndAudit";
import MintToken from "./MintToken";
import ContractDebugger from "./ContractDebugger";
import { useOrderEvents } from "@/hooks/useOrderEvents";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";

type Props = {
    otcAddress: `0x${string}`;
    gatewayAddress: `0x${string}`;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
};

export default function OTCDemo({ otcAddress, gatewayAddress, tokenIn, tokenOut }: Props) {
    const [activeTab, setActiveTab] = useState<"create" | "fill" | "orders" | "audit" | "mint" | "debug">("create");
    const { orders, onOrderCreated, onOrderFilled, onTermsRevealed } = useOrderEvents();
    const { chainId, isConnected, connect } = useMetaMaskEthersSigner();

    const tabs = [
        { id: "create", label: "Create Order", icon: "📝" },
        { id: "fill", label: "Fill Order", icon: "✅" },
        { id: "orders", label: "View Orders", icon: "📋" },
        // { id: "audit", label: "Reveal & Audit", icon: "🔍" },
        // { id: "mint", label: "Mint Tokens", icon: "🪙" },
        // { id: "debug", label: "Debug", icon: "🔧" },
    ] as const;

    // Check if current network supports FHEVM
    const isNetworkSupported = chainId && [11155111, 31337].includes(chainId);
    const getNetworkName = (chainId: number) => {
        switch (chainId) {
            case 1: return "Ethereum Mainnet";
            case 11155111: return "Sepolia Testnet";
            case 84532: return "Base Sepolia";
            case 31337: return "Hardhat Local";
            default: return `Chain ID ${chainId}`;
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            {/* Network Status Banner */}
            {isConnected ? (
                <div className={`mb-6 p-4 rounded-lg border ${isNetworkSupported
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                    }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <span className={`text-lg ${isNetworkSupported ? "text-green-600" : "text-red-600"}`}>
                                {isNetworkSupported ? "✅" : "⚠️"}
                            </span>
                            <div>
                                <p className={`font-medium ${isNetworkSupported ? "text-green-800" : "text-red-800"}`}>
                                    {isNetworkSupported ? "Network Supported" : "Network Not Supported"}
                                </p>
                                <p className={`text-sm ${isNetworkSupported ? "text-green-700" : "text-red-700"}`}>
                                    Current Network: {chainId ? getNetworkName(chainId) : "Unknown"}
                                </p>
                            </div>
                        </div>
                        {!isNetworkSupported && (
                            <div className="text-right">
                                <p className="text-xs text-red-600 font-medium">FHEVM Required</p>
                                <p className="text-xs text-red-600">Switch to Sepolia or Hardhat</p>
                            </div>
                        )}
                    </div>

                    {/* Network Switching Guide */}
                    {!isNetworkSupported && (
                        <div className="mt-3 pt-3 border-t border-red-200">
                            <p className="text-xs text-red-700 mb-2">
                                <strong>How to switch networks:</strong>
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-red-700">
                                <div>
                                    <p className="font-medium">Sepolia Testnet:</p>
                                    <p>• Network Name: Sepolia</p>
                                    <p>• Chain ID: 11155111</p>
                                    <p>• RPC URL: https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID</p>
                                </div>
                                <div>
                                    <p className="font-medium">Hardhat Local:</p>
                                    <p>• Network Name: Hardhat</p>
                                    <p>• Chain ID: 31337</p>
                                    <p>• RPC URL: http://127.0.0.1:8545</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="mb-6 p-4 rounded-lg border border-blue-200 bg-blue-50">
                    <div className="text-center">
                        <div className="text-blue-600 text-4xl mb-4">🔗</div>
                        <h3 className="text-lg font-semibold text-blue-800 mb-2">Connect Your Wallet</h3>
                        <p className="text-blue-700 mb-6">Please connect your MetaMask wallet to use the confidential OTC escrow</p>
                        <button
                            onClick={connect}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            Connect MetaMask
                        </button>
                    </div>
                </div>
            )}

            {/* Contract Info Card */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">📋 Contract Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Contract Addresses</h3>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <span className="text-gray-500">OTC:</span>
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                    {otcAddress.slice(0, 8)}...{otcAddress.slice(-6)}
                                </code>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="text-gray-500">Gateway:</span>
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                    {gatewayAddress.slice(0, 8)}...{gatewayAddress.slice(-6)}
                                </code>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Demo Tokens</h3>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <span className="text-gray-500">Token In:</span>
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                    {tokenIn === "0x0000000000000000000000000000000000000000" ? "User Input" : tokenIn.slice(0, 8) + "..." + tokenIn.slice(-6)}
                                </code>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="text-gray-500">Token Out:</span>
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                    {tokenOut === "0x0000000000000000000000000000000000000000" ? "User Input" : tokenOut.slice(0, 8) + "..." + tokenOut.slice(-6)}
                                </code>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-2 mb-8">
                <div className="flex space-x-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                                ? "bg-blue-600 text-white shadow-md transform scale-105"
                                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {activeTab === "create" && (
                    <CreateOrder
                        otcAddress={otcAddress}
                        tokenIn={tokenIn}
                        tokenOut={tokenOut}
                        onOrderCreated={onOrderCreated}
                    />
                )}
                {activeTab === "fill" && (
                    <FillOrder
                        otcAddress={otcAddress}
                        onOrderFilled={onOrderFilled}
                    />
                )}
                {activeTab === "orders" && (
                    <Orders />
                )}
                {/* {activeTab === "audit" && (
                    <RevealAndAudit
                        otcAddress={otcAddress}
                        onTermsRevealed={onTermsRevealed}
                    />
                )} */}
                {/* {activeTab === "mint" && (
                    <MintToken
                        contractAddress="0x5296968f6443608B719C142cbc4cC413e9B46F09"
                    />
                )} */}
                {/* {activeTab === "debug" && (
                    <ContractDebugger
                        otcAddress={otcAddress}
                        gatewayAddress={gatewayAddress}
                        tokenIn={tokenIn}
                        tokenOut={tokenOut}
                    />
                )} */}
            </div>

            {/* Footer Note */}
            <div className="mt-8 text-center">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl mx-auto">
                    <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> This is a demonstration interface. In production, you would need:
                        proper wallet integration, real event listening, and production-ready FHEVM configuration.
                    </p>
                </div>
            </div>
        </div>
    );
}