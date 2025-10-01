import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { OTC_ABI } from "@/abi/otc";

export type Order = {
    id: string;
    maker: string;
    tokenIn: string;
    tokenOut: string;
    amountInEnc: string;
    amountOutEnc: string;
    takerEnc: string;
    deadline: number;
    filled: boolean;
    cancelled: boolean;
    takerPayEnc: string;
    createdAt: number;
};

export type OrderWithDetails = Order & {
    status: "active" | "filled" | "cancelled" | "expired";
    timeRemaining?: number;
    isExpired: boolean;
    isMine: boolean;
};

export function useOrders(otcAddress: string) {
    const { ethersSigner, isConnected, provider } = useMetaMaskEthersSigner();
    const [orders, setOrders] = useState<OrderWithDetails[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");

    const fetchOrders = useCallback(async () => {
        if (!ethersSigner || !provider || !otcAddress) return;

        setLoading(true);
        setError("");

        try {
            const contract = new ethers.Contract(otcAddress, OTC_ABI, ethersSigner);

            // Get the next order ID to know how many orders exist
            const nextOrderId = await contract.nextOrderId();
            const totalOrders = Number(nextOrderId);

            if (totalOrders === 0) {
                setOrders([]);
                return;
            }

            // Fetch all orders
            const ordersData: Order[] = [];
            for (let i = 0; i < totalOrders; i++) {
                try {
                    const orderData = await contract.orders(i);
                    ordersData.push({
                        id: i.toString(),
                        maker: orderData.maker,
                        tokenIn: orderData.tokenIn,
                        tokenOut: orderData.tokenOut,
                        amountInEnc: orderData.amountInEnc,
                        amountOutEnc: orderData.amountOutEnc,
                        takerEnc: orderData.takerEnc,
                        deadline: Number(orderData.deadline),
                        filled: orderData.filled,
                        cancelled: orderData.cancelled,
                        takerPayEnc: orderData.takerPayEnc,
                        createdAt: Date.now() - (totalOrders - i) * 60000, // Mock creation time
                    });
                } catch (err) {
                    console.warn(`Failed to fetch order ${i}:`, err);
                }
            }

            // Process orders to add computed fields
            const processedOrders: OrderWithDetails[] = ordersData.map(order => {
                const now = Math.floor(Date.now() / 1000);
                const isExpired = order.deadline < now;
                const isMine = ethersSigner.address?.toLowerCase() === order.maker.toLowerCase();

                let status: OrderWithDetails["status"] = "active";
                if (order.filled) {
                    status = "filled";
                } else if (order.cancelled) {
                    status = "cancelled";
                } else if (isExpired) {
                    status = "expired";
                }

                const timeRemaining = isExpired ? 0 : order.deadline - now;

                return {
                    ...order,
                    status,
                    timeRemaining,
                    isExpired,
                    isMine,
                };
            });

            // Sort by creation time (newest first)
            processedOrders.sort((a, b) => b.createdAt - a.createdAt);

            setOrders(processedOrders);
        } catch (err: any) {
            console.error("Failed to fetch orders:", err);
            setError(`Failed to fetch orders: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [ethersSigner, provider, otcAddress]);

    // Fetch orders when component mounts or dependencies change
    useEffect(() => {
        if (isConnected && ethersSigner && otcAddress) {
            fetchOrders();
        }
    }, [isConnected, ethersSigner, otcAddress, fetchOrders]);

    // Refresh orders
    const refreshOrders = useCallback(() => {
        fetchOrders();
    }, [fetchOrders]);

    return {
        orders,
        loading,
        error,
        refreshOrders,
    };
}
