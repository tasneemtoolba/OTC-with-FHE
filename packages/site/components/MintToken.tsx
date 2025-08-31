import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useFhevm } from "@/fhevm/useFhevm";

// ERC-7984 Mintable Burnable ABI (minimal version for minting)
const ERC7984_ABI = [
    "function mint(address to, bytes calldata externalEuint64, bytes calldata inputProof) external",
    "function balanceOf(address account) external view returns (uint256)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
];

type Props = {
    contractAddress: `0x${string}`;
};

export default function MintToken({ contractAddress }: Props) {
    const { ethersSigner, isConnected, connect, provider, chainId } = useMetaMaskEthersSigner();
    const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFhevm({
        provider,
        chainId,
        enabled: !!provider
    });

    const [amount, setAmount] = useState<string>("100");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const [success, setSuccess] = useState<string>("");
    const [tokenInfo, setTokenInfo] = useState<{
        name: string;
        symbol: string;
        decimals: number;
        balance: string;
    } | null>(null);

    // Fetch token information
    useEffect(() => {
        if (isConnected && ethersSigner && contractAddress) {
            fetchTokenInfo();
        }
    }, [isConnected, ethersSigner, contractAddress]);

    const fetchTokenInfo = async () => {
        try {
            const contract = new ethers.Contract(contractAddress, ERC7984_ABI, ethersSigner);
            const [name, symbol, decimals] = await Promise.all([
                contract.name(),
                contract.symbol(),
                contract.decimals()
            ]);

            // Get user's balance
            const balance = await contract.balanceOf(ethersSigner?.address);

            setTokenInfo({
                name,
                symbol,
                decimals,
                balance: ethers.formatUnits(balance, decimals)
            });
        } catch (err: any) {
            console.error("Failed to fetch token info:", err);
            setError("Failed to fetch token information");
        }
    };

    const handleMint = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fhevmInstance || !ethersSigner) return;

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            if (!ethersSigner.address) {
                throw new Error("Signer address not available");
            }

            // Create encrypted input using FHEVM
            const encryptedInput = fhevmInstance.createEncryptedInput(contractAddress, ethersSigner.address);
            encryptedInput.add32(parseInt(amount));
            const encryptedAmount = await encryptedInput.encrypt();

            // Setup contract
            const contract = new ethers.Contract(contractAddress, ERC7984_ABI, ethersSigner);

            // Call mint function
            const tx = await contract.mint(
                ethersSigner.address,
                encryptedAmount.handles[0], // externalEuint64
                encryptedAmount.inputProof   // inputProof
            );

            const receipt = await tx.wait();
            console.log("Token minted successfully:", receipt.hash);

            setSuccess(`Successfully minted ${amount} tokens! Transaction: ${receipt.hash}`);

            // Refresh token info
            await fetchTokenInfo();

            // Reset form
            setAmount("100");

        } catch (err: any) {
            console.error("Failed to mint token:", err);
            setError(err.message || "Failed to mint token");
        } finally {
            setLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="p-8 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 max-w-md mx-auto">
                    <div className="text-blue-600 text-4xl mb-4">🔗</div>
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">Connect Your Wallet</h3>
                    <p className="text-blue-700 mb-6">Please connect your MetaMask wallet to mint tokens</p>
                    <button
                        onClick={connect}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">🪙 Mint ERC-7984 Tokens</h3>
                    <p className="text-gray-600">Mint confidential tokens using FHEVM encryption</p>
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <strong>🔬 SIMULATION MODE:</strong> This simulates the minting process with MetaMask signature requests.
                        </p>
                    </div>
                </div>

                {/* Token Information */}
                {tokenInfo && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                        <h4 className="font-medium text-gray-900 mb-3">Token Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Name:</span>
                                <span className="ml-2 font-medium">{tokenInfo.name}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Symbol:</span>
                                <span className="ml-2 font-medium">{tokenInfo.symbol}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Decimals:</span>
                                <span className="ml-2 font-medium">{tokenInfo.decimals}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Your Balance:</span>
                                <span className="ml-2 font-medium">{tokenInfo.balance} {tokenInfo.symbol}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mint Form */}
                <form onSubmit={handleMint} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount to Mint (uint64) *
                        </label>
                        <input
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            type="number"
                            min="1"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter the amount of tokens you want to mint</p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        disabled={loading || !fhevmInstance || !ethersSigner || fhevmStatus !== "ready"}
                    >
                        {loading ? "Minting Tokens..." : "Mint Tokens"}
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

                    {/* Success Message */}
                    {success && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-800">{success}</p>
                        </div>
                    )}
                </form>

                {/* Contract Address */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">
                        Contract: {contractAddress.slice(0, 8)}...{contractAddress.slice(-6)}
                    </p>
                </div>
            </div>
        </div>
    );
}
