import { useState, useCallback } from "react";

export type OrderEvent = {
    type: "OrderCreated" | "FillRequested" | "OrderFinalized" | "OrderCancelled" | "TermsRevealed";
    id: string;
    maker?: string;
    taker?: string;
    timestamp: number;
    txHash?: string;
};

export function useOrderEvents() {
    const [orders, setOrders] = useState<OrderEvent[]>([]);

    const onOrderCreated = useCallback((txHash: string) => {
        const newOrder: OrderEvent = {
            type: "OrderCreated",
            id: orders.length.toString(),
            maker: "Current User",
            timestamp: Date.now(),
            txHash,
        };
        setOrders(prev => [...prev, newOrder]);
    }, [orders.length]);

    const onOrderFilled = useCallback((txHash: string) => {
        const newOrder: OrderEvent = {
            type: "FillRequested",
            id: orders.length.toString(),
            taker: "Current User",
            timestamp: Date.now(),
            txHash,
        };
        setOrders(prev => [...prev, newOrder]);
    }, [orders.length]);

    const onTermsRevealed = useCallback((txHash: string) => {
        const newOrder: OrderEvent = {
            type: "TermsRevealed",
            id: orders.length.toString(),
            maker: "Current User",
            timestamp: Date.now(),
            txHash,
        };
        setOrders(prev => [...prev, newOrder]);
    }, [orders.length]);

    const addMockOrder = useCallback((type: OrderEvent["type"]) => {
        const mockOrder: OrderEvent = {
            type,
            id: orders.length.toString(),
            maker: type === "OrderCreated" || type === "OrderCancelled" || type === "TermsRevealed" ? "0x1234...5678" : undefined,
            taker: type === "FillRequested" ? "0x8765...4321" : undefined,
            timestamp: Date.now(),
            txHash: `0x${Math.random().toString(16).slice(2, 10)}...`,
        };
        setOrders(prev => [...prev, mockOrder]);
    }, [orders.length]);

    const clearOrders = useCallback(() => {
        setOrders([]);
    }, []);

    return {
        orders,
        onOrderCreated,
        onOrderFilled,
        onTermsRevealed,
        addMockOrder,
        clearOrders,
    };
}
