import { useState } from "react";
import { ethers } from "ethers";
import { OTC_ABI } from "@/abi/otc";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";

type Props = {
    otcAddress: `0x${string}`;
    onTermsRevealed?: (txHash: string) => void;
};

export function RevealAndAudit({ otcAddress, onTermsRevealed }: Props) {
    const { ethersSigner, isConnected, connect } = useMetaMaskEthersSigner();
    const [orderId, setOrderId] = useState<string>("0");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const [success, setSuccess] = useState<string>("");

    async function onReveal() {
        if (!ethersSigner) {
            setError("Please connect your wallet");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const contract = new ethers.Contract(otcAddress, OTC_ABI, ethersSigner);
            const tx = await contract.revealTerms(BigInt(orderId));
            await tx.wait();

            setSuccess(`Terms revealed successfully! Transaction: ${tx.hash}`);
            onTermsRevealed?.(tx.hash);

            // Reset form
            setOrderId("0");
        } catch (err: any) {
            console.error("Failed to reveal terms:", err);
            setError(err.message || "Failed to reveal terms");
        } finally {
            setLoading(false);
        }
    }

    async function onAuditDecrypt() {
        setError("");
        setSuccess("");

        try {
            // This is a mock implementation for the demo
            // In production, you would:
            // 1. Have the actual ciphertext handles stored when orders are created
            // 2. Have a proper FHEVM instance initialized
            // 3. Call decrypt with the real handles

            setSuccess("Mock decryption completed! In production, this would decrypt the actual order terms.");
        } catch (err: any) {
            setError("Decryption failed: " + err.message);
        }
    }

    if (!isConnected) {
        return (
            <div className="p-8 text-center">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-8 max-w-md mx-auto">
                    <div className="text-purple-600 text-4xl mb-4">🔗</div>
                    <h3 className="text-lg font-semibold text-purple-800 mb-2">Connect Your Wallet</h3>
                    <p className="text-purple-700 mb-6">Please connect your MetaMask wallet to reveal order terms or audit decryptions</p>
                    <button
                        onClick={connect}
                        className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                        Connect MetaMask
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">🔍 Reveal & Audit</h3>
                    <p className="text-gray-600">Reveal order terms for transparency and audit decrypted values</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Reveal Terms Section */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                        <div className="text-center mb-6">
                            <div className="text-3xl mb-2">📢</div>
                            <h4 className="text-xl font-semibold text-gray-900 mb-2">Reveal Order Terms</h4>
                            <p className="text-gray-600 text-sm">Make order details public for transparency and auditing</p>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); onReveal(); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Order ID *
                                </label>
                                <input
                                    value={orderId}
                                    onChange={e => setOrderId(e.target.value)}
                                    type="number"
                                    min="0"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="0"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Enter the ID of the order whose terms you want to reveal</p>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                                disabled={loading}
                            >
                                {loading ? "Revealing..." : "Reveal Terms"}
                            </button>
                        </form>

                        {error && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                                <p className="text-sm text-green-800">{success}</p>
                            </div>
                        )}
                    </div>

                    {/* Audit Decrypt Section */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                        <div className="text-center mb-6">
                            <div className="text-3xl mb-2">🔐</div>
                            <h4 className="text-xl font-semibold text-gray-900 mb-2">Audit Decryption</h4>
                            <p className="text-gray-600 text-sm">Decrypt revealed order terms to verify their authenticity</p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                This feature allows anyone to decrypt order terms that have been revealed by the maker.
                                It provides transparency and enables auditing of completed trades.
                            </p>

                            <button
                                onClick={onAuditDecrypt}
                                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
                            >
                                Decrypt Revealed Terms
                            </button>

                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                <h4 className="text-sm font-medium text-blue-800 mb-1">ℹ️ Implementation Note</h4>
                                <p className="text-xs text-blue-700">
                                    This demo shows mock decryption. In production, you'll need to:
                                    <br />• Store ciphertext handles when orders are created
                                    <br />• Initialize a proper FHEVM instance
                                    <br />• Call decrypt with the real handles after reveal
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* How It Works */}
                <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">How Reveal & Audit Works</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                            <h5 className="font-medium text-gray-800 mb-2">1. Order Creation</h5>
                            <p>Orders are created with encrypted amounts and terms using FHEVM encryption.</p>
                        </div>
                        <div>
                            <h5 className="font-medium text-gray-800 mb-2">2. Terms Reveal</h5>
                            <p>Makers can reveal order terms to make them public and auditable.</p>
                        </div>
                        <div>
                            <h5 className="font-medium text-gray-800 mb-2">3. Public Audit</h5>
                            <p>Anyone can decrypt revealed terms to verify trade authenticity.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
