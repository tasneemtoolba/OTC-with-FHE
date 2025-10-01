import { useState } from "react";
import { ethers } from "ethers";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useFhevm } from "@/fhevm/useFhevm";

// Minimal ABI for basic contract calls
const BASIC_ABI = [
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
    "function owner() external view returns (address)",
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)"
];

type Props = {
    otcAddress: `0x${string}`;
    gatewayAddress: `0x${string}`;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
};

export default function ContractDebugger({ otcAddress, gatewayAddress, tokenIn, tokenOut }: Props) {
    const { ethersSigner, isConnected, connect, provider, chainId } = useMetaMaskEthersSigner();
    const { instance: fhevmInstance, status: fhevmStatus } = useFhevm({
        provider,
        chainId,
        enabled: !!provider
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>("");
    const [error, setError] = useState<string>("");

    const testTokenContract = async () => {
        if (!ethersSigner) return;

        setLoading(true);
        setError("");
        setResult("");

        try {
            const tokenAddress = "0xcde70d205f9D467CFA1fC46b45C45a30E651E172";
            const contract = new ethers.Contract(tokenAddress, BASIC_ABI, ethersSigner);

            const [name, symbol, decimals, owner, totalSupply] = await Promise.all([
                contract.name().catch(() => "N/A"),
                contract.symbol().catch(() => "N/A"),
                contract.decimals().catch(() => "N/A"),
                contract.owner().catch(() => "N/A"),
                contract.totalSupply().catch(() => "N/A")
            ]);

            const balance = await contract.balanceOf(ethersSigner.address).catch(() => "N/A");

            setResult(`
🪙 Token Contract Test Results:
Address: ${tokenAddress}
Name: ${name}
Symbol: ${symbol}
Decimals: ${decimals}
Owner: ${owner}
Total Supply: ${totalSupply !== "N/A" ? ethers.formatUnits(totalSupply, decimals) : "N/A"}
Your Balance: ${balance !== "N/A" ? ethers.formatUnits(balance, decimals) : "N/A"}
            `);

        } catch (err: any) {
            console.error("Token contract read error:", err);
            setError(err.message || "Failed to read token contract");
        } finally {
            setLoading(false);
        }
    };

    const testFHEVMConnection = async () => {
        if (!fhevmInstance || !ethersSigner) return;

        setLoading(true);
        setError("");
        setResult("");

        try {
            // Test FHEVM instance
            const publicKey = fhevmInstance.getPublicKey();
            const publicParams = fhevmInstance.getPublicParams(2048);

            setResult(`
🔐 FHEVM Connection Test Results:
Status: ✅ Ready
Public Key Length: ${publicKey?.publicKey.length} bytes
Public Params Length: ${publicParams?.publicParams.length} bytes
Signer Address: ${ethersSigner.address}
Network: ${chainId}
            `);

        } catch (err: any) {
            console.error("FHEVM test error:", err);
            setError(err.message || "Failed to test FHEVM");
        } finally {
            setLoading(false);
        }
    };

    const testContractAddresses = async () => {
        setLoading(true);
        setError("");
        setResult("");

        try {
            setResult(`
📍 Contract Addresses:
OTC Contract: ${otcAddress}
Gateway: ${gatewayAddress}
Token In: ${tokenIn === "0x0000000000000000000000000000000000000000" ? "User Input" : tokenIn}
Token Out: ${tokenOut === "0x0000000000000000000000000000000000000000" ? "User Input" : tokenOut}
Token Contract: 0xcde70d205f9D467CFA1fC46b45C45a30E651E172
            `);
        } catch (err: any) {
            setError("Failed to display contract addresses");
        } finally {
            setLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="p-4 text-center">
                <button
                    onClick={connect}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    Connect Wallet
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-6">🔧 Contract Debugger</h3>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                        onClick={testTokenContract}
                        disabled={loading}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                        {loading ? "Testing..." : "Test Token Contract"}
                    </button>

                    <button
                        onClick={testFHEVMConnection}
                        disabled={loading || fhevmStatus !== "ready"}
                        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                        {loading ? "Testing..." : "Test FHEVM"}
                    </button>

                    <button
                        onClick={testContractAddresses}
                        disabled={loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? "Loading..." : "Show Addresses"}
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-red-800 text-sm">{error}</p>
                    </div>
                )}

                {result && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap">{result}</pre>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                    <div>
                        <p><strong>FHEVM Status:</strong> {fhevmStatus}</p>
                        <p><strong>Network:</strong> {chainId}</p>
                        <p><strong>Connected:</strong> {ethersSigner?.address?.slice(0, 8)}...{ethersSigner?.address?.slice(-6)}</p>
                    </div>
                    <div>
                        <p><strong>OTC Address:</strong> {otcAddress.slice(0, 8)}...{otcAddress.slice(-6)}</p>
                        <p><strong>Gateway:</strong> {gatewayAddress.slice(0, 8)}...{gatewayAddress.slice(-6)}</p>
                        <p><strong>Token Contract:</strong> 0x5296...F09</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
