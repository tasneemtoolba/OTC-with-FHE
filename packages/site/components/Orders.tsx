import { useOrderEvents } from "@/hooks/useOrderEvents";
import { useOrders } from "@/hooks/useOrders";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useFhevm } from "@/fhevm/useFhevm";
import { ethers } from "ethers";
import { OTC_ABI } from "@/abi/otc";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
    otcAddress: string;
};

export function Orders({ otcAddress }: Props) {
    const { isConnected, ethersSigner, provider, chainId } = useMetaMaskEthersSigner();
    const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFhevm({
        provider,
        chainId,
        enabled: !!provider
    });
    const { orders: contractOrders, loading, error, refreshOrders } = useOrders(otcAddress);
    const { orders: eventOrders } = useOrderEvents();
    const [showMockOrders, setShowMockOrders] = useState(false);
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "filled" | "cancelled" | "expired">("all");
    const [filterMine, setFilterMine] = useState<"all" | "mine" | "others">("all");

    // Fill order modal state
    const [showFillModal, setShowFillModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [payIn, setPayIn] = useState<string>("100");
    const [doTransferIn, setDoTransferIn] = useState(true);
    const [fillLoading, setFillLoading] = useState(false);
    const [fillError, setFillError] = useState<string>("");

    if (!isConnected) {
        return (
            <div className="p-8 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 max-w-md mx-auto">
                    <div className="text-blue-400 text-4xl mb-4">🔗</div>
                    <h3 className="text-lg font-semibold text-blue-600 mb-2">Connect Your Wallet</h3>
                    <p className="text-blue-500">Please connect your MetaMask wallet to view orders</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 max-w-md mx-auto">
                    <div className="text-yellow-400 text-4xl mb-4">⏳</div>
                    <h3 className="text-lg font-semibold text-yellow-600 mb-2">Loading Orders...</h3>
                    <p className="text-yellow-500">Fetching orders from the blockchain</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md mx-auto">
                    <div className="text-red-400 text-4xl mb-4">❌</div>
                    <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Orders</h3>
                    <p className="text-red-500 mb-4">{error}</p>
                    <button
                        onClick={refreshOrders}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (contractOrders.length === 0) {
        return (
            <div className="p-8 text-center">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 max-w-md mx-auto">
                    <div className="text-gray-400 text-4xl mb-4">📋</div>
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Orders Yet</h3>
                    <p className="text-gray-500 mb-4">No orders have been created yet</p>
                    <button
                        onClick={refreshOrders}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>
        );
    }

    // Filter orders based on status and ownership
    const filteredOrders = contractOrders.filter(order => {
        const statusMatch = filterStatus === "all" || order.status === filterStatus;
        const mineMatch = filterMine === "all" ||
            (filterMine === "mine" && order.isMine) ||
            (filterMine === "others" && !order.isMine);
        return statusMatch && mineMatch;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "active": return "bg-green-100 text-green-800 border-green-200";
            case "filled": return "bg-blue-100 text-blue-800 border-blue-200";
            case "cancelled": return "bg-red-100 text-red-800 border-red-200";
            case "expired": return "bg-gray-100 text-gray-800 border-gray-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "active": return "🟢";
            case "filled": return "✅";
            case "cancelled": return "❌";
            case "expired": return "⏰";
            default: return "❓";
        }
    };

    const formatTimeRemaining = (seconds: number) => {
        if (seconds <= 0) return "Expired";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // Fill order functionality
    const handleFillOrder = (order: any) => {
        setSelectedOrder(order);
        setPayIn("100");
        setDoTransferIn(true);
        setFillError("");
        setShowFillModal(true);
    };

    const onFillOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fhevmInstance || !ethersSigner || !selectedOrder) return;

        setFillLoading(true);
        setFillError("");

        try {
            // Create encrypted input using FHEVM
            if (!ethersSigner.address) {
                throw new Error("Signer address not available");
            }

            const payInInput = fhevmInstance.createEncryptedInput(otcAddress, ethersSigner.address);
            payInInput.add64(BigInt(parseInt(payIn))); // Use add64 for uint64
            const payInEnc = await payInInput.encrypt();

            const contract = new ethers.Contract(otcAddress, OTC_ABI, ethersSigner);
            const tx = await contract.fillOrder(
                BigInt(selectedOrder.id),
                payInEnc.handles[0],  // takerPayExt
                payInEnc.inputProof, // attestation
                doTransferIn
            );

            const receipt = await tx.wait();
            console.log("Order filled with tx hash:", receipt.hash);

            // Close modal and refresh orders
            setShowFillModal(false);
            refreshOrders();

        } catch (err: any) {
            console.error("Failed to fill order:", err);
            setFillError(err.message || "Failed to fill order");
        } finally {
            setFillLoading(false);
        }
    };

    const closeFillModal = () => {
        setShowFillModal(false);
        setSelectedOrder(null);
        setFillError("");
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Trading Orders</h2>
                <p className="text-gray-600">View and manage all confidential trading orders</p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex gap-3">
                    <Button
                        onClick={refreshOrders}
                        variant="outline"
                        size="sm"
                    >
                        Refresh
                    </Button>
                    <Button
                        onClick={() => setShowMockOrders(!showMockOrders)}
                        variant="outline"
                        size="sm"
                    >
                        {showMockOrders ? "Hide" : "Show"} Mock Events
                    </Button>
                </div>
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    {filteredOrders.length} of {contractOrders.length} orders
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1">Status</Label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="w-full h-9 px-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="filled">Filled</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>
                <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1">Ownership</Label>
                    <select
                        value={filterMine}
                        onChange={(e) => setFilterMine(e.target.value as any)}
                        className="w-full h-9 px-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="all">All Orders</option>
                        <option value="mine">My Orders</option>
                        <option value="others">Others' Orders</option>
                    </select>
                </div>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
                {filteredOrders.map((order) => (
                    <Card
                        key={order.id}
                        className="hover:shadow-md transition-shadow"
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                    <span className="text-xl">{getStatusIcon(order.status)}</span>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <h4 className="text-lg font-semibold text-gray-900">
                                                Order #{order.id}
                                            </h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                {order.status.toUpperCase()}
                                            </span>
                                            {order.isMine && (
                                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                                    YOURS
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            By {formatAddress(order.maker)} • {new Date(order.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                {order.timeRemaining !== undefined && order.timeRemaining > 0 && (
                                    <div className="text-xs text-orange-600">
                                        Expires in {formatTimeRemaining(order.timeRemaining)}
                                    </div>
                                )}
                            </div>

                            {/* Order Details - Compact */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                                <div>
                                    <span className="text-gray-500">Token In:</span>
                                    <div className="font-mono text-xs">{formatAddress(order.tokenIn)}</div>
                                </div>
                                <div>
                                    <span className="text-gray-500">Token Out:</span>
                                    <div className="font-mono text-xs">{formatAddress(order.tokenOut)}</div>
                                </div>
                                <div>
                                    <span className="text-gray-500">Deadline:</span>
                                    <div className="text-xs">{new Date(order.deadline * 1000).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <span className="text-gray-500">Encrypted:</span>
                                    <div className="text-xs">Amount In: 0x{order.amountInEnc.slice(0, 6)}...</div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {order.status === "active" && (
                                <div className="flex justify-end">
                                    {!order.isMine && (
                                        <Button
                                            onClick={() => handleFillOrder(order)}
                                            size="sm"
                                            disabled={!fhevmInstance || fhevmStatus !== "ready"}
                                        >
                                            Fill Order
                                        </Button>
                                    )}
                                    {order.isMine && (
                                        <Button
                                            onClick={() => handleFillOrder(order)}
                                            variant="outline"
                                            size="sm"
                                            disabled={!fhevmInstance || fhevmStatus !== "ready"}
                                        >
                                            Test Fill
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Status-specific information */}
                            {order.status === "active" && (
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                                    <p className="text-sm text-green-800">
                                        <strong>Active Order:</strong> This order is available for filling.
                                        {order.isMine ? " You can cancel it if needed." : " Click 'Fill Order' to complete this trade."}
                                    </p>
                                </div>
                            )}

                            {order.status === "filled" && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <p className="text-sm text-blue-800">
                                        <strong>Order Filled:</strong> This order has been successfully completed.
                                    </p>
                                </div>
                            )}

                            {order.status === "cancelled" && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                    <p className="text-sm text-red-800">
                                        <strong>Order Cancelled:</strong> This order has been cancelled by the maker.
                                    </p>
                                </div>
                            )}

                            {order.status === "expired" && (
                                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                    <p className="text-sm text-gray-800">
                                        <strong>Order Expired:</strong> This order has passed its deadline and is no longer available.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Mock Events Section */}
            {showMockOrders && eventOrders.length > 0 && (
                <div className="mt-8">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">📊 Mock Events ({eventOrders.length})</h4>
                    <div className="space-y-4">
                        {eventOrders.map((event, index) => (
                            <div
                                key={index}
                                className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-xl">
                                            {event.type === "OrderCreated" && "📝"}
                                            {event.type === "FillRequested" && "✅"}
                                            {event.type === "OrderFinalized" && "🎯"}
                                            {event.type === "OrderCancelled" && "❌"}
                                            {event.type === "TermsRevealed" && "🔍"}
                                        </span>
                                        <div>
                                            <h5 className="font-medium text-gray-900">
                                                {event.type.replace(/([A-Z])/g, ' $1').trim()}
                                            </h5>
                                            <p className="text-sm text-gray-600">
                                                {event.maker && `Maker: ${formatAddress(event.maker)}`}
                                                {event.taker && `Taker: ${formatAddress(event.taker)}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right text-sm text-gray-500">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info Note */}
            <div className="mt-8 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                    <p className="text-sm text-blue-800">
                        <strong>Note:</strong> All order amounts are encrypted for privacy.
                        Only the order maker and taker can decrypt the actual amounts after the trade is completed.
                    </p>
                </div>
            </div>

            {showFillModal && selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Fill Order #{selectedOrder.id}</h3>
                            <button
                                onClick={closeFillModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={onFillOrder} className="space-y-4">
                            {/* Order Info */}
                            <div className="p-3 bg-gray-50 rounded-md">
                                <p className="text-sm text-gray-600">
                                    <strong>Order Details:</strong>
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Token In: {formatAddress(selectedOrder.tokenIn)}<br />
                                    Token Out: {formatAddress(selectedOrder.tokenOut)}<br />
                                    Maker: {formatAddress(selectedOrder.maker)}
                                </p>
                            </div>

                            {/* Pay In Amount */}
                            <div>
                                <Label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pay In Amount (uint64) *
                                </Label>
                                <Input
                                    value={payIn}
                                    onChange={e => setPayIn(e.target.value)}
                                    type="number"
                                    min="1"
                                    placeholder="100"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Amount you're willing to pay for this order</p>
                            </div>

                            {/* Transfer Option */}
                            <div className="flex items-center">
                                <input
                                    id="doTransferIn"
                                    type="checkbox"
                                    checked={doTransferIn}
                                    onChange={e => setDoTransferIn(e.target.checked)}
                                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                />
                                <label htmlFor="doTransferIn" className="ml-2 block text-sm text-gray-700">
                                    Transfer tokens in immediately when filling the order
                                </label>
                            </div>

                            {/* Error Display */}
                            {fillError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                                    <p className="text-sm text-red-800">{fillError}</p>
                                </div>
                            )}

                            {/* FHEVM Status */}
                            {fhevmStatus !== "ready" && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-sm text-yellow-800">
                                        {fhevmStatus === "loading" && "🔄 FHEVM Loading..."}
                                        {fhevmStatus === "error" && "❌ FHEVM Error"}
                                        {fhevmStatus === "unsupported" && "⚠️ Network Not Supported"}
                                        {fhevmStatus === "idle" && "⏳ Waiting for connection..."}
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex space-x-3 pt-4">
                                <Button
                                    type="button"
                                    onClick={closeFillModal}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={fillLoading || !fhevmInstance || fhevmStatus !== "ready"}
                                >
                                    {fillLoading ? "Filling..." : "Fill Order"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )
            }
        </div>
    );
}
