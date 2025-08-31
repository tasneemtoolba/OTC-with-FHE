import { useOrderEvents } from "@/hooks/useOrderEvents";

export function Orders() {
    const { orders } = useOrderEvents();

    if (orders.length === 0) {
        return (
            <div className="p-8 text-center">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 max-w-md mx-auto">
                    <div className="text-gray-400 text-4xl mb-4">📋</div>
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Orders Yet</h3>
                    <p className="text-gray-500">Orders will appear here once they are created and filled</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">📋 Order History</h3>
                    <p className="text-gray-600">View all confidential OTC orders and their current status</p>
                </div>

                <div className="space-y-4">
                    {orders.map((order, index) => (
                        <div
                            key={index}
                            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">
                                        {order.type === "OrderCreated" && "📝"}
                                        {order.type === "FillRequested" && "✅"}
                                        {order.type === "OrderFinalized" && "🎯"}
                                        {order.type === "OrderCancelled" && "❌"}
                                        {order.type === "TermsRevealed" && "🔍"}
                                    </span>
                                    <div>
                                        <h4 className="text-lg font-semibold text-gray-900">
                                            {order.type === "OrderCreated" && "Order Created"}
                                            {order.type === "FillRequested" && "Order Fill Requested"}
                                            {order.type === "OrderFinalized" && "Order Finalized"}
                                            {order.type === "OrderCancelled" && "Order Cancelled"}
                                            {order.type === "TermsRevealed" && "Terms Revealed"}
                                        </h4>
                                        <p className="text-sm text-gray-500">
                                            Order ID: {order.id}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-500">
                                        {new Date(order.timestamp).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {new Date(order.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-medium text-gray-700">User: </span>
                                    <span className="text-gray-600">
                                        {order.type === "OrderCreated" && order.maker}
                                        {order.type === "FillRequested" && order.taker}
                                        {order.type === "OrderFinalized" && "System"}
                                        {order.type === "OrderCancelled" && order.maker}
                                        {order.type === "TermsRevealed" && order.maker}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700">Transaction: </span>
                                    <span className="text-gray-600 font-mono">
                                        {order.txHash ? `${order.txHash.slice(0, 8)}...${order.txHash.slice(-6)}` : "Pending"}
                                    </span>
                                </div>
                            </div>

                            {order.type === "OrderCreated" && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <p className="text-sm text-blue-800">
                                        <strong>New Order:</strong> A confidential OTC order has been created with encrypted amounts.
                                    </p>
                                </div>
                            )}

                            {order.type === "FillRequested" && (
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                                    <p className="text-sm text-green-800">
                                        <strong>Fill Requested:</strong> A taker has requested to fill this order.
                                    </p>
                                </div>
                            )}

                            {order.type === "OrderFinalized" && (
                                <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
                                    <p className="text-sm text-purple-800">
                                        <strong>Order Finalized:</strong> The trade has been completed successfully.
                                    </p>
                                </div>
                            )}

                            {order.type === "OrderCancelled" && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                    <p className="text-sm text-red-800">
                                        <strong>Order Cancelled:</strong> This order has been cancelled by the maker.
                                    </p>
                                </div>
                            )}

                            {order.type === "TermsRevealed" && (
                                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Terms Revealed:</strong> The order terms have been made public for transparency.
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-8 text-center">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                        <p className="text-sm text-blue-800">
                            <strong>Note:</strong> This is a demonstration interface showing mock order events.
                            In production, you would see real blockchain events from your smart contract.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
