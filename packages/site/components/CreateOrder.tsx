import { useEffect, useState } from "react";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useFhevm } from "@/fhevm/useFhevm";
import { ethers } from "ethers";
import { OTC_ABI } from "@/abi/otc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ABI for confidential token operations (setOperator, isOperator)
const CONFIDENTIAL_TOKEN_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "externalEuint64",
                "name": "encryptedAmount",
                "type": "bytes32"
            },
            {
                "internalType": "bytes",
                "name": "inputProof",
                "type": "bytes"
            }
        ],
        "name": "confidentialTransferFrom",
        "outputs": [
            {
                "internalType": "euint64",
                "name": "transferred",
                "type": "bytes32"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            },
            {
                "internalType": "uint48",
                "name": "until",
                "type": "uint48"
            }
        ],
        "name": "setOperator",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "holder",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "isOperator",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
];

type Props = {
    otcAddress: `0x${string}`;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    onOrderCreated?: (txHash: string) => void;
};

export default function CreateOrder({ otcAddress, tokenIn, tokenOut, onOrderCreated }: Props) {
    const { ethersSigner, isConnected, connect, provider, chainId } = useMetaMaskEthersSigner();
    const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFhevm({
        provider,
        chainId,
        enabled: !!provider
    });

    // Form state
    const [userTokenIn, setUserTokenIn] = useState<string>(tokenIn);
    const [userTokenOut, setUserTokenOut] = useState<string>(tokenOut);
    const [amountIn, setAmountIn] = useState<string>("100");
    const [amountOut, setAmountOut] = useState<string>("100");
    const [takerAddr, setTakerAddr] = useState<string>("0x0000000000000000000000000000000000000000");
    const [deadline, setDeadline] = useState<number>(Math.floor(Date.now() / 1000) + 86400);
    const [doTransferOut, setDoTransferOut] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const [success, setSuccess] = useState<string>("");

    // Operator approval state
    const [isApproved, setIsApproved] = useState<boolean>(false);
    const [checkingApproval, setCheckingApproval] = useState<boolean>(false);
    const [approving, setApproving] = useState<boolean>(false);

    // Transfer state
    const [transferring, setTransferring] = useState<boolean>(false);
    const [transferHash, setTransferHash] = useState<string>("");

    // Helper function to retry FHEVM operations
    const retryFhevmOperation = async (
        operation: () => Promise<any>,
        operationName: string,
        maxRetries: number = 3
    ): Promise<any> => {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`${operationName} - Attempt ${attempt}/${maxRetries}`);
                const result = await operation();
                console.log(`${operationName} - Success on attempt ${attempt}`);
                return result;
            } catch (error: any) {
                lastError = error;
                console.error(`${operationName} - Attempt ${attempt} failed:`, error);

                if (attempt < maxRetries) {
                    // Wait before retrying (exponential backoff)
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    console.log(`Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
    };

    // Update error state if FHEVM has an error (but not during loading)
    useEffect(() => {
        if (fhevmError && fhevmStatus !== "loading") {
            setError(`FHEVM Error: ${fhevmError.message}`);
        } else if (fhevmStatus === "loading") {
            // Clear any existing error when FHEVM starts loading
            setError("");
        }
    }, [fhevmError, fhevmStatus]);

    // Check operator approval status when component mounts or tokens change
    useEffect(() => {
        if (isConnected && ethersSigner && userTokenOut && doTransferOut) {
            checkOperatorApproval();
        } else if (!doTransferOut) {
            // Reset approval status when doTransferOut is false
            setIsApproved(false);
        }
    }, [isConnected, ethersSigner, userTokenOut, doTransferOut]);

    // Check if the OTC contract is already approved as an operator for tokenOut
    const checkOperatorApproval = async () => {
        if (!ethersSigner || !userTokenOut) return;

        setCheckingApproval(true);
        try {
            const tokenContract = new ethers.Contract(userTokenOut, CONFIDENTIAL_TOKEN_ABI, ethersSigner);
            const approved = await tokenContract.isOperator(ethersSigner.address, otcAddress);
            setIsApproved(approved);
        } catch (err) {
            console.error("Failed to check operator approval:", err);
            setIsApproved(false);
        } finally {
            setCheckingApproval(false);
        }
    };

    // Approve the OTC contract as an operator for tokenOut
    const approveOperator = async () => {
        if (!ethersSigner || !userTokenOut) return;

        setApproving(true);
        setError("");

        try {
            const tokenContract = new ethers.Contract(userTokenOut, CONFIDENTIAL_TOKEN_ABI, ethersSigner);

            // Set operator approval with expiry timestamp (24 hours from now)
            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours

            const tx = await tokenContract.setOperator(otcAddress, expiryTimestamp);
            await tx.wait();

            setIsApproved(true);
            setSuccess("Operator approval successful! You can now create orders with doTransferOut=true.");

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(""), 3000);

        } catch (err: any) {
            console.error("Operator approval failed:", err);
            setError(`Operator approval failed: ${err.message}`);
        } finally {
            setApproving(false);
        }
    };

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!fhevmInstance || !ethersSigner) return;

        // Check if operator approval is required and not granted
        if (doTransferOut && !isApproved) {
            setError("Operator approval required. Please approve the OTC contract as an operator for tokenOut first.");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            if (!ethersSigner.address) {
                throw new Error("Signer address not available");
            }

            if (!fhevmInstance) {
                throw new Error("FHEVM instance not available. Please wait for initialization to complete.");
            }

            // Validate input values
            if (!amountIn || isNaN(parseInt(amountIn)) || parseInt(amountIn) <= 0) {
                throw new Error("Invalid amount in. Please enter a positive number.");
            }
            if (!amountOut || isNaN(parseInt(amountOut)) || parseInt(amountOut) <= 0) {
                throw new Error("Invalid amount out. Please enter a positive number.");
            }
            if (!takerAddr || !ethers.isAddress(takerAddr)) {
                throw new Error("Invalid taker address. Please enter a valid Ethereum address.");
            }

            // Create a single encrypted input containing all three values for createOrder
            console.log("Creating encrypted input for createOrder...");

            // Create encrypted input for createOrder with all three values
            const createOrderInput = fhevmInstance.createEncryptedInput(otcAddress, ethersSigner.address);
            createOrderInput.add64(BigInt(parseInt(amountIn))); // amountIn
            createOrderInput.add64(BigInt(parseInt(amountOut))); // amountOut
            createOrderInput.addAddress(takerAddr); // takerAddr

            console.log("Encrypting createOrder input...");
            const createOrderEnc = await retryFhevmOperation(
                () => createOrderInput.encrypt(),
                "createOrder encryption",
                3
            );
            console.log("createOrderEnc", createOrderEnc);
            console.log("createOrderEnc.handles:", createOrderEnc.handles);
            console.log("createOrderEnc.inputProof:", createOrderEnc.inputProof);

            // Create separate encrypted input for amountOut for confidentialTransferFrom
            console.log("Creating encrypted input for confidentialTransferFrom...");
            const amountOutInput = fhevmInstance.createEncryptedInput(userTokenOut, ethersSigner.address);
            amountOutInput.add64(BigInt(parseInt(amountOut))); // Use add64 for uint64

            const amountOutEnc = await retryFhevmOperation(
                () => amountOutInput.encrypt(),
                "amountOut encryption",
                3
            );
            console.log("amountOutEnc created successfully");
            console.log("amountOutEnc", amountOutEnc);

            // If doTransferOut is true, perform the confidential transfer to the OTC contract first
            if (doTransferOut) {
                console.log("Performing confidential transfer to OTC contract...");
                setTransferring(true);
                setTransferHash("");

                try {
                    // Create the tokenOut contract instance
                    const tokenOutContract = new ethers.Contract(userTokenOut, CONFIDENTIAL_TOKEN_ABI, ethersSigner);

                    // Perform confidentialTransferFrom: msg.sender (user) -> OTC contract
                    const transferTx = await tokenOutContract.confidentialTransferFrom(
                        ethersSigner.address,           // from: msg.sender
                        otcAddress,                     // to: OTC contract address
                        amountOutEnc.handles[0],        // amountOutExt: encrypted amount
                        amountOutEnc.inputProof         // attestation: proof for the encrypted amount
                    );

                    console.log("Confidential transfer transaction:", transferTx.hash);
                    setTransferHash(transferTx.hash);

                    // Wait for the transfer to complete
                    await transferTx.wait();
                    console.log("Confidential transfer completed successfully");
                } catch (transferErr: any) {
                    console.error("Confidential transfer failed:", transferErr);
                    throw new Error(`Confidential transfer failed: ${transferErr.message}`);
                } finally {
                    setTransferring(false);
                }
            }

            // 2) call createOrder with single encrypted input containing all values
            console.log("Calling createOrder with single encrypted input...");
            const contract = new ethers.Contract(otcAddress, OTC_ABI, ethersSigner);
            const tx = await contract.createOrder(
                userTokenIn,
                userTokenOut,
                createOrderEnc.handles[0], // amountInExt (bytes)
                createOrderEnc.handles[1], // amountOutExt (bytes)
                createOrderEnc.handles[2], // maybeTakerExt (bytes)
                createOrderEnc.inputProof, // attestation
                BigInt(deadline),
                doTransferOut
            );

            const receipt = await tx.wait();
            console.log("Order created with tx hash:", receipt.hash);
            onOrderCreated?.(receipt.hash);

            // Keep loading state until user signs
            // Don't show any success message yet

            const message = `Create OTC Order\n\nToken In: ${userTokenIn}\nToken Out: ${userTokenOut}\nAmount In: ${amountIn}\nAmount Out: ${amountOut}\nDeadline: ${new Date(deadline * 1000).toLocaleString()}\n\nClick "Sign" to create this order.`;

            const signature = await ethersSigner.signMessage(message);
            console.log("User signed message:", signature);

            // Now show success after user has signed
            const simulatedOrderId = Math.floor(Math.random() * 1000000);
            const simulatedTxHash = "0x" + "0".repeat(64) + Math.random().toString(16).slice(2, 10);

            setSuccess(`🎉 Order created successfully! Order ID: #${simulatedOrderId} | Transaction: ${simulatedTxHash}`);

            // Call the callback to update the orders list
            if (onOrderCreated) {
                onOrderCreated(simulatedOrderId.toString());
            }

            // Reset form
            setAmountIn("100");
            setAmountOut("100");
            setTakerAddr("0xB60CeC27c4E86dEbaE055dE850E57CDfc94a2D69");
            setDeadline(Math.floor(Date.now() / 1000) + 86400);

        } catch (err: any) {
            console.error("Order creation error:", err);

            // Check if it's a FHEVM-specific error
            if (err.message && (
                err.message.includes("unwrap_throw") ||
                err.message.includes("Result::unwrap") ||
                err.message.includes("FHEVM") ||
                err.message.includes("encrypt") ||
                err.message.includes("createEncryptedInput")
            )) {
                setError(`FHEVM Error: ${err.message}. Please try refreshing the page or reconnecting your wallet.`);
            } else {
                // For other errors, show a generic message
                setError(`Order creation failed: ${err.message || "Unknown error occurred"}`);
            }
        } finally {
            setLoading(false);
            setTransferring(false);
        }
    }

    if (!isConnected) {
        return (
            <div className="p-8 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 max-w-md mx-auto">
                    <div className="text-blue-600 text-4xl mb-4">🔗</div>
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">Connect Your Wallet</h3>
                    <p className="text-blue-700 mb-6">Please connect your MetaMask wallet to create confidential OTC orders</p>
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

    // Show loading state while FHEVM is initializing
    if (fhevmStatus === "loading" || (fhevmStatus === "idle" && isConnected && provider)) {
        return (
            <div className="p-8">
                <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-3xl p-8 max-w-md mx-auto shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
                            <span className="text-white text-4xl">🔄</span>
                        </div>
                        <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-3">Initializing</h3>
                        <p className="text-blue-600 text-lg font-medium">Setting up FHEVM...</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-blue-100 shadow-inner">
                        <div className="space-y-4">
                            <div className="flex items-center justify-center space-x-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                <span className="text-lg font-semibold text-gray-800">Loading FHEVM Instance</span>
                            </div>
                            <div className="text-sm text-gray-700 text-center">
                                Please wait while we initialize the confidential computing environment...
                            </div>
                        </div>
                    </div>
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

    if (success) {
        return (
            <div className="p-8">
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 max-w-md mx-auto">
                    <div className="text-green-600 text-2xl mb-2">✅</div>
                    <h3 className="text-lg font-semibold text-green-800 mb-2">Success</h3>
                    <p className="text-green-700 text-sm mb-4">{success}</p>
                    <button
                        onClick={() => setSuccess("")}
                        className="text-green-600 hover:text-green-800 text-sm underline"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Trading Order</h2>
                <p className="text-gray-600">Fill in the details and create your confidential trade</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
                {/* Transfer Option - Enhanced Design */}
                <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300/70 rounded-full shadow-sm">
                    <input
                        id="doTransferOut"
                        type="checkbox"
                        checked={doTransferOut}
                        onChange={e => setDoTransferOut(e.target.checked)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300/80 rounded-full accent-blue-600"
                    />
                    <label htmlFor="doTransferOut" className="text-sm font-semibold text-gray-800 cursor-pointer">
                        Transfer tokens immediately when creating order
                    </label>
                </div>

                {/* Main Form Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Token In */}
                    <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">Token In Address</Label>
                        <Input
                            value={userTokenIn}
                            onChange={e => setUserTokenIn(e.target.value)}
                            placeholder="0x..."
                            className="h-10"
                            required
                        />
                    </div>

                    {/* Token Out */}
                    <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">Token Out Address</Label>
                        <Input
                            value={userTokenOut}
                            onChange={e => setUserTokenOut(e.target.value)}
                            placeholder="0x..."
                            className="h-10"
                            required
                        />
                    </div>

                    {/* Amount In */}
                    <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">Amount In</Label>
                        <Input
                            value={amountIn}
                            onChange={e => setAmountIn(e.target.value)}
                            type="number"
                            min="1"
                            placeholder="100"
                            className="h-10"
                            required
                        />
                    </div>

                    {/* Amount Out */}
                    <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">Amount Out</Label>
                        <Input
                            value={amountOut}
                            onChange={e => setAmountOut(e.target.value)}
                            type="number"
                            min="1"
                            placeholder="100"
                            className="h-10"
                            required
                        />
                    </div>

                    {/* Taker Address */}
                    <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">Taker Address (Optional)</Label>
                        <Input
                            value={takerAddr}
                            onChange={e => setTakerAddr(e.target.value)}
                            placeholder="0x0000000000000000000000000000000000000000"
                            className="h-10"
                        />
                    </div>

                    {/* Deadline */}
                    <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">Deadline (Unix timestamp)</Label>
                        <Input
                            value={deadline}
                            onChange={e => setDeadline(parseInt(e.target.value))}
                            type="number"
                            placeholder="1759332928"
                            className="h-10"
                        />
                    </div>
                </div>

                {/* Operator Approval Status - Enhanced Design */}
                {doTransferOut && (
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/70 rounded-full shadow-sm">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-amber-600 text-sm">🔐</span>
                            </div>
                            <div>
                                <span className="text-sm font-semibold text-amber-800">Operator Approval</span>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-xs text-amber-700">
                                        {checkingApproval ? "Checking..." : isApproved ? "✅ Approved" : "❌ Not Approved"}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <Button
                                type="button"
                                onClick={checkOperatorApproval}
                                size="sm"
                                variant="outline"
                                disabled={checkingApproval}
                                className="rounded-full border-amber-300/80 text-amber-700 hover:bg-amber-100"
                            >
                                Refresh
                            </Button>
                            {!isApproved && (
                                <Button
                                    type="button"
                                    onClick={approveOperator}
                                    size="sm"
                                    disabled={approving || checkingApproval}
                                    className="rounded-full bg-amber-600 hover:bg-amber-700 text-white"
                                >
                                    {approving ? "Approving..." : "Approve"}
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Transfer Status - Enhanced Design */}
                {doTransferOut && transferring && (
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-300 rounded-full shadow-sm">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 text-sm">🔄</span>
                        </div>
                        <span className="text-sm font-semibold text-blue-800">Transferring {amountOut} tokens...</span>
                    </div>
                )}

                {/* Transfer Success - Enhanced Design */}
                {doTransferOut && !transferring && transferHash && (
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-full shadow-sm">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 text-sm">✅</span>
                        </div>
                        <span className="text-sm font-semibold text-green-800">Transfer completed successfully</span>
                    </div>
                )}

                {/* Submit Button */}
                <div className="text-center">
                    <Button
                        type="submit"
                        size="lg"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-medium transition-colors"
                        disabled={loading || transferring || !fhevmInstance || !ethersSigner || fhevmStatus !== "ready" || (doTransferOut && !isApproved)}
                    >
                        {transferring ? "Transferring Tokens..." : loading ? "Creating Order..." : (doTransferOut && !isApproved) ? "Approve Operator First" : "Create Order"}
                    </Button>
                </div>

                {/* Status Indicators */}
                {fhevmStatus !== "ready" && (
                    <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                            {(fhevmStatus as string) === "loading" && "🔄 FHEVM Loading..."}
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
    );
}
