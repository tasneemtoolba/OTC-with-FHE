import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact with ConfidentialOtcEscrow Locally (--network localhost)
 * ====================================================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the contracts
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the OTC Escrow contract
 *
 *   npx hardhat --network localhost task:otc-address
 *   npx hardhat --network localhost task:otc-create-order --tokenin 0x123... --tokenout 0x456... --amountin 100 --amountout 200 --taker 0x789... --deadline 1759332928
 *   npx hardhat --network localhost task:otc-fill-order --orderid 0 --takerpay 100
 *   npx hardhat --network localhost task:otc-cancel-order --orderid 0
 *   npx hardhat --network localhost task:otc-order-info --orderid 0
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the contracts
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the OTC Escrow contract
 *
 *   npx hardhat --network sepolia task:otc-address
 *   npx hardhat --network sepolia task:otc-create-order --tokenin 0x123... --tokenout 0x456... --amountin 100 --amountout 200 --taker 0x789... --deadline 1759332928
 *   npx hardhat --network sepolia task:otc-fill-order --orderid 0 --takerpay 100
 *   npx hardhat --network sepolia task:otc-cancel-order --orderid 0
 *   npx hardhat --network sepolia task:otc-order-info --orderid 0
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:otc-address
 *   - npx hardhat --network sepolia task:otc-address
 */
task("task:otc-address", "Prints the ConfidentialOtcEscrow address").setAction(async function (_taskArguments: TaskArguments, hre) {
    const { deployments } = hre;

    try {
        const otcDeployment = await deployments.get("ConfidentialOtcEscrowWithOZ");
        console.log("ConfidentialOtcEscrow address is " + otcDeployment.address);
    } catch (e) {
        console.log("ConfidentialOtcEscrow not found. Available contracts:");
        const allDeployments = await deployments.all();
        Object.keys(allDeployments).forEach(name => {
            console.log(`  - ${name}: ${allDeployments[name].address}`);
        });
    }
});

/**
 * Example:
 *   - npx hardhat --network localhost task:otc-create-order --tokenin 0x123... --tokenout 0x456... --amountin 100 --amountout 200 --taker 0x789... --deadline 1759332928
 *   - npx hardhat --network sepolia task:otc-create-order --tokenin 0x123... --tokenout 0x456... --amountin 100 --amountout 200 --taker 0x789... --deadline 1759332928
 */
task("task:otc-create-order", "Creates a new OTC order")
    .addParam("tokenin", "Token In contract address")
    .addParam("tokenout", "Token Out contract address")
    .addParam("amountin", "Amount In (uint64)")
    .addParam("amountout", "Amount Out (uint64)")
    .addOptionalParam("taker", "Taker address (optional, defaults to zero address)")
    .addParam("deadline", "Deadline (Unix timestamp)")
    .addOptionalParam("dotransferout", "Whether to transfer tokens out immediately", "false")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers, fhevm } = hre;

        const amountIn = parseInt(taskArguments.amountin);
        const amountOut = parseInt(taskArguments.amountout);
        const deadline = parseInt(taskArguments.deadline);
        const doTransferOut = taskArguments.dotransferout === "true";

        if (!Number.isInteger(amountIn) || amountIn <= 0) {
            throw new Error(`Argument --amountin must be a positive integer`);
        }
        if (!Number.isInteger(amountOut) || amountOut <= 0) {
            throw new Error(`Argument --amountout must be a positive integer`);
        }
        if (!Number.isInteger(deadline) || deadline <= Math.floor(Date.now() / 1000)) {
            throw new Error(`Argument --deadline must be a future Unix timestamp`);
        }

        await fhevm.initializeCLIApi();

        const otcContract = await ethers.getContractAt("ConfidentialOtcEscrowWithOZ", await hre.deployments.get("ConfidentialOtcEscrowWithOZ").then(d => d.address));
        const signers = await ethers.getSigners();

        const takerAddr = taskArguments.taker || ethers.ZeroAddress;

        console.log(`OTC Contract: ${await otcContract.getAddress()}`);
        console.log(`Token In: ${taskArguments.tokenin}`);
        console.log(`Token Out: ${taskArguments.tokenout}`);
        console.log(`Amount In: ${amountIn}`);
        console.log(`Amount Out: ${amountOut}`);
        console.log(`Taker: ${takerAddr}`);
        console.log(`Deadline: ${deadline}`);
        console.log(`Do Transfer Out: ${doTransferOut}`);

        // Encrypt order parameters
        const orderInput = await fhevm
            .createEncryptedInput(await otcContract.getAddress(), signers[0].address)
            .add64(BigInt(amountIn))
            .add64(BigInt(amountOut))
            .addAddress(takerAddr)
            .encrypt();

        const tx = await otcContract
            .connect(signers[0])
            .createOrder(
                taskArguments.tokenin,
                taskArguments.tokenout,
                orderInput.handles[0], // amountIn
                orderInput.handles[1], // amountOut
                orderInput.handles[2], // takerAddr
                orderInput.inputProof,
                deadline,
                doTransferOut
            );
        console.log(`Wait for tx:${tx.hash}...`);

        const receipt = await tx.wait();
        console.log(`tx:${tx.hash} status=${receipt?.status}`);

        // Get the order ID from the event
        const orderCreatedEvent = receipt?.logs.find(log => {
            try {
                const parsed = otcContract.interface.parseLog(log);
                return parsed?.name === "OrderCreated";
            } catch {
                return false;
            }
        });

        if (orderCreatedEvent) {
            const parsed = otcContract.interface.parseLog(orderCreatedEvent);
            const orderId = parsed?.args[0];
            console.log(`Order created with ID: ${orderId}`);
        }

        console.log(`Create order succeeded!`);
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:otc-fill-order --orderid 0 --takerpay 100
 *   - npx hardhat --network sepolia task:otc-fill-order --orderid 0 --takerpay 100
 */
task("task:otc-fill-order", "Fills an existing OTC order")
    .addParam("orderid", "Order ID to fill")
    .addParam("takerpay", "Taker payment amount (uint64)")
    .addOptionalParam("dotransferin", "Whether to transfer tokens in immediately", "false")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers, fhevm } = hre;

        const orderId = parseInt(taskArguments.orderid);
        const takerPay = parseInt(taskArguments.takerpay);
        const doTransferIn = taskArguments.dotransferin === "true";

        if (!Number.isInteger(orderId) || orderId < 0) {
            throw new Error(`Argument --orderid must be a non-negative integer`);
        }
        if (!Number.isInteger(takerPay) || takerPay <= 0) {
            throw new Error(`Argument --takerpay must be a positive integer`);
        }

        await fhevm.initializeCLIApi();

        const otcContract = await ethers.getContractAt("ConfidentialOtcEscrowWithOZ", await hre.deployments.get("ConfidentialOtcEscrowWithOZ").then(d => d.address));
        const signers = await ethers.getSigners();

        console.log(`OTC Contract: ${await otcContract.getAddress()}`);
        console.log(`Order ID: ${orderId}`);
        console.log(`Taker Pay: ${takerPay}`);
        console.log(`Do Transfer In: ${doTransferIn}`);

        // Encrypt taker payment amount
        const takerPayInput = await fhevm
            .createEncryptedInput(await otcContract.getAddress(), signers[0].address)
            .add64(BigInt(takerPay))
            .encrypt();

        const tx = await otcContract
            .connect(signers[0])
            .fillOrder(
                orderId,
                takerPayInput.handles[0],
                takerPayInput.inputProof,
                doTransferIn
            );
        console.log(`Wait for tx:${tx.hash}...`);

        const receipt = await tx.wait();
        console.log(`tx:${tx.hash} status=${receipt?.status}`);

        console.log(`Fill order ${orderId} succeeded!`);
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:otc-cancel-order --orderid 0
 *   - npx hardhat --network sepolia task:otc-cancel-order --orderid 0
 */
task("task:otc-cancel-order", "Cancels an existing OTC order")
    .addParam("orderid", "Order ID to cancel")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers } = hre;

        const orderId = parseInt(taskArguments.orderid);
        if (!Number.isInteger(orderId) || orderId < 0) {
            throw new Error(`Argument --orderid must be a non-negative integer`);
        }

        const otcContract = await ethers.getContractAt("ConfidentialOtcEscrowWithOZ", await hre.deployments.get("ConfidentialOtcEscrowWithOZ").then(d => d.address));
        const signers = await ethers.getSigners();

        console.log(`OTC Contract: ${await otcContract.getAddress()}`);
        console.log(`Order ID: ${orderId}`);

        const tx = await otcContract
            .connect(signers[0])
            .cancelOrder(orderId);
        console.log(`Wait for tx:${tx.hash}...`);

        const receipt = await tx.wait();
        console.log(`tx:${tx.hash} status=${receipt?.status}`);

        console.log(`Cancel order ${orderId} succeeded!`);
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:otc-finalize-fill --orderid 0 --taker 0x123...
 *   - npx hardhat --network sepolia task:otc-finalize-fill --orderid 0 --taker 0x123...
 */
task("task:otc-finalize-fill", "Finalizes a filled order (gateway only)")
    .addParam("orderid", "Order ID to finalize")
    .addParam("taker", "Taker address")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers } = hre;

        const orderId = parseInt(taskArguments.orderid);
        if (!Number.isInteger(orderId) || orderId < 0) {
            throw new Error(`Argument --orderid must be a non-negative integer`);
        }

        const otcContract = await ethers.getContractAt("ConfidentialOtcEscrowWithOZ", await hre.deployments.get("ConfidentialOtcEscrowWithOZ").then(d => d.address));
        const signers = await ethers.getSigners();

        console.log(`OTC Contract: ${await otcContract.getAddress()}`);
        console.log(`Order ID: ${orderId}`);
        console.log(`Taker: ${taskArguments.taker}`);

        // Use the gateway signer (assuming it's the last signer)
        const gatewaySigner = signers[signers.length - 1];

        const tx = await otcContract
            .connect(gatewaySigner)
            .finalizeFill(orderId, taskArguments.taker);
        console.log(`Wait for tx:${tx.hash}...`);

        const receipt = await tx.wait();
        console.log(`tx:${tx.hash} status=${receipt?.status}`);

        console.log(`Finalize fill for order ${orderId} succeeded!`);
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:otc-order-info --orderid 0
 *   - npx hardhat --network sepolia task:otc-order-info --orderid 0
 */
task("task:otc-order-info", "Gets information about an OTC order")
    .addParam("orderid", "Order ID to query")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers } = hre;

        const orderId = parseInt(taskArguments.orderid);
        if (!Number.isInteger(orderId) || orderId < 0) {
            throw new Error(`Argument --orderid must be a non-negative integer`);
        }

        const otcContract = await ethers.getContractAt("ConfidentialOtcEscrowWithOZ", await hre.deployments.get("ConfidentialOtcEscrowWithOZ").then(d => d.address));

        console.log(`OTC Contract: ${await otcContract.getAddress()}`);
        console.log(`Order ID: ${orderId}`);

        try {
            const order = await otcContract.orders(orderId);
            const isOpen = await otcContract.isOpen(orderId);

            console.log(`Maker: ${order.maker}`);
            console.log(`Token In: ${order.tokenIn}`);
            console.log(`Token Out: ${order.tokenOut}`);
            console.log(`Deadline: ${order.deadline}`);
            console.log(`Filled: ${order.filled}`);
            console.log(`Cancelled: ${order.cancelled}`);
            console.log(`Is Open: ${isOpen}`);
        } catch (error) {
            console.log(`Error getting order info: ${error}`);
        }
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:otc-gateway-info
 *   - npx hardhat --network sepolia task:otc-gateway-info
 */
task("task:otc-gateway-info", "Gets OTC contract gateway information").setAction(async function (_taskArguments: TaskArguments, hre) {
    const { ethers } = hre;

    const otcContract = await ethers.getContractAt("ConfidentialOtcEscrowWithOZ", await hre.deployments.get("ConfidentialOtcEscrowWithOZ").then(d => d.address));

    console.log(`OTC Contract: ${await otcContract.getAddress()}`);
    console.log(`Gateway: ${await otcContract.gateway()}`);
});
