import { useState } from "react";
import CreateOrder from "./CreateOrder";
import { Orders } from "./Orders";
import { RevealAndAudit } from "./RevealAndAudit";
import ContractDebugger from "./ContractDebugger";
import { useOrderEvents } from "@/hooks/useOrderEvents";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Props = {
    otcAddress: `0x${string}`;
    gatewayAddress: `0x${string}`;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
};

export default function OTCDemo({ otcAddress, gatewayAddress, tokenIn, tokenOut }: Props) {
    const [activeTab, setActiveTab] = useState<"create" | "orders" | "audit" | "debug">("create");
    const { orders, onOrderCreated, onOrderFilled, onTermsRevealed } = useOrderEvents();
    const { chainId, isConnected, connect } = useMetaMaskEthersSigner();

    const tabs = [
        { id: "create", label: "Create Order", icon: "📝" },
        { id: "orders", label: "View Orders", icon: "📋" },
        // { id: "audit", label: "Reveal & Audit", icon: "🔍" },
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">🔒 Confidential OTC Trading</h1>
                    <p className="text-gray-600">Trade confidential tokens with complete privacy</p>
                </div>

                {/* Network Status */}
                {!isConnected ? (
                    <Card className="mb-6 shadow-lg">
                        <CardContent className="p-8 text-center">
                            <div className="text-blue-600 text-4xl mb-4">🔗</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
                            <p className="text-gray-600 mb-4">Connect your wallet to start trading</p>
                            <button
                                onClick={connect}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-medium transition-colors"
                            >
                                Connect Wallet
                            </button>
                        </CardContent>
                    </Card>
                ) : !isNetworkSupported ? (
                    <Card className="mb-6 shadow-lg bg-red-50 border-red-200">
                        <CardContent className="p-8 text-center">
                            <div className="text-red-600 text-4xl mb-4">⚠️</div>
                            <h3 className="text-xl font-semibold text-red-900 mb-2">Unsupported Network</h3>
                            <p className="text-red-700 mb-2">Please switch to Sepolia testnet or localhost</p>
                            <p className="text-sm text-red-600">Current: {chainId ? getNetworkName(chainId) : "Unknown"}</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Contract Info - Compact */}
                        <Card className="shadow-lg">
                            <CardContent className="p-4">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Contract Info</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">OTC:</span>
                                        <code className="text-gray-900 font-mono">{otcAddress.slice(0, 6)}...{otcAddress.slice(-4)}</code>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Gateway:</span>
                                        <code className="text-gray-900 font-mono">{gatewayAddress.slice(0, 6)}...{gatewayAddress.slice(-4)}</code>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Token In:</span>
                                        <code className="text-gray-900 font-mono">{tokenIn === "0x0000000000000000000000000000000000000000" ? "Custom" : tokenIn.slice(0, 6) + "..." + tokenIn.slice(-4)}</code>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Token Out:</span>
                                        <code className="text-gray-900 font-mono">{tokenOut === "0x0000000000000000000000000000000000000000" ? "Custom" : tokenOut.slice(0, 6) + "..." + tokenOut.slice(-4)}</code>
                                    </div>
                                </div>
                                
                                {/* View All Orders Button */}
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => setActiveTab("orders")}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full font-medium transition-colors text-sm"
                                    >
                                        📋 View All Orders
                                    </button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Create Order - Main Focus */}
                        <Card className="lg:col-span-2 shadow-lg">
                            <CardContent className="p-6">
                                <CreateOrder
                                    otcAddress={otcAddress}
                                    tokenIn={tokenIn}
                                    tokenOut={tokenOut}
                                    onOrderCreated={onOrderCreated}
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Orders Modal/Overlay */}
                {activeTab === "orders" && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">📋 All Orders</h2>
                                    <p className="text-gray-600">View and fill existing orders</p>
                                </div>
                                <button
                                    onClick={() => setActiveTab("create")}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-full font-medium transition-colors"
                                >
                                    ✕ Close
                                </button>
                            </div>
                            
                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <Orders otcAddress={otcAddress} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}