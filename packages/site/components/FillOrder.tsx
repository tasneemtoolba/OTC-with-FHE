import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { OTC_ABI } from "@/abi/otc";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useFhevm } from "@/fhevm/useFhevm";

type Props = {
    otcAddress: `0x${string}`;
    onOrderFilled?: (txHash: string) => void;
};

export default function FillOrder({ otcAddress, onOrderFilled }: Props) {
    const { ethersSigner, isConnected, connect, provider, chainId } = useMetaMaskEthersSigner();
    const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFhevm({
        provider,
        chainId,
        enabled: !!provider
    });
    const [orderId, setOrderId] = useState<string>("0");
    const [payIn, setPayIn] = useState<string>("150000");
    const [doTransferIn, setDoTransferIn] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");

    // Update error state if FHEVM has an error
    useEffect(() => {
        if (fhevmError) {
            setError(`FHEVM Error: ${fhevmError.message}`);
        }
    }, [fhevmError]);

    async function onFill(e: React.FormEvent) {
        e.preventDefault();
        if (!fhevmInstance || !ethersSigner) return;
        setLoading(true);
        setError("");

        try {
            // Create encrypted input using FHEVM
            if (!ethersSigner.address) {
                throw new Error("Signer address not available");
            }

            const payInInput = fhevmInstance.createEncryptedInput(otcAddress, ethersSigner.address);
            payInInput.add32(parseInt(payIn));
            const payInEnc = await payInInput.encrypt();

            const contract = new ethers.Contract(otcAddress, OTC_ABI, ethersSigner);
            const tx = await contract.fillOrder(
                BigInt(orderId),
                payInEnc.handles[0],  // takerPayExt
                payInEnc.inputProof, // attestation
                doTransferIn
            );

            const receipt = await tx.wait();
            console.log("Order filled with tx hash:", receipt.hash);
            onOrderFilled?.(receipt.hash);

            // Reset form
            setOrderId("0");
            setPayIn("150000");

        } catch (err: any) {
            console.error("Failed to fill order:", err);
            setError(err.message || "Failed to fill order");
        } finally {
            setLoading(false);
        }
    }

    if (!isConnected) {
        return (
            <div className="p-8 text-center">
                <div className="bg-green-50 border border-green-200 rounded-xl p-8 max-w-md mx-auto">
                    <div className="text-green-600 text-4xl mb-4">🔗</div>
                    <h3 className="text-lg font-semibold text-green-800 mb-2">Connect Your Wallet</h3>
                    <p className="text-green-700 mb-6">Please connect your MetaMask wallet to fill confidential OTC orders</p>
                    <button
                        onClick={connect}
                        className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                        Connect MetaMask
                    </button>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                    <div className="text-red-600 text-2xl mb-2">⚠️</div>
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
                    <p className="text-red-700 text-sm mb-4">{error}</p>
                    <button
                        onClick={() => setError("")}
                        className="text-red-600 hover:text-red-800 text-sm underline"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">✅ Fill OTC Order</h3>
                    <p className="text-gray-600">Fill an existing confidential over-the-counter trading order</p>
                </div>

                <form onSubmit={onFill} className="space-y-6">
                    {/* Order ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Order ID *
                        </label>
                        <input
                            value={orderId}
                            onChange={e => setOrderId(e.target.value)}
                            type="number"
                            min="0"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="0"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter the ID of the order you want to fill</p>
                    </div>

                    {/* Pay In Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Pay In Amount (uint64) *
                        </label>
                        <input
                            value={payIn}
                            onChange={e => setPayIn(e.target.value)}
                            type="number"
                            min="1"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="150000"
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

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        disabled={loading || !fhevmInstance || !ethersSigner || fhevmStatus !== "ready"}
                    >
                        {loading ? "Filling Order..." : "Fill Order"}
                    </button>

                    {/* Status Indicators */}
                    {fhevmStatus !== "ready" && (
                        <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                                {fhevmStatus === "loading" && "🔄 FHEVM Loading..."}
                                {fhevmStatus === "error" && "❌ FHEVM Error"}
                                {fhevmStatus === "unsupported" && "⚠️ Network Not Supported"}
                                {fhevmStatus === "idle" && "⏳ Waiting for connection..."}
                            </p>
                            {fhevmStatus === "unsupported" && (
                                <p className="text-xs text-yellow-700 mt-1">
                                    Please switch to Sepolia testnet or Hardhat local network for FHEVM support.
                                </p>
                            )}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
