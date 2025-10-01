import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact with ConfidentialToken Locally (--network localhost)
 * ================================================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the ConfidentialToken contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the ConfidentialToken contract
 *
 *   npx hardhat --network localhost task:token-balance --address <token-address>
 *   npx hardhat --network localhost task:token-mint --address <token-address> --to <recipient> --amount 100
 *   npx hardhat --network localhost task:token-transfer --address <token-address> --from <from> --to <to> --amount 50
 *   npx hardhat --network localhost task:token-set-operator --address <token-address> --owner <owner> --operator <operator>
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the ConfidentialToken contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the ConfidentialToken contract
 *
 *   npx hardhat --network sepolia task:token-balance --address <token-address>
 *   npx hardhat --network sepolia task:token-mint --address <token-address> --to <recipient> --amount 100
 *   npx hardhat --network sepolia task:token-transfer --address <token-address> --from <from> --to <to> --amount 50
 *   npx hardhat --network sepolia task:token-set-operator --address <token-address> --owner <owner> --operator <operator>
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:token-address
 *   - npx hardhat --network sepolia task:token-address
 */
task("task:token-address", "Prints the ConfidentialToken address")
    .addOptionalParam("name", "Token contract name (ConfidentialTokenIn, ConfidentialTokenOut, etc.)")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { deployments } = hre;
        const tokenName = taskArguments.name || "ConfidentialTokenExample";

        try {
            const tokenDeployment = await deployments.get(tokenName);
            console.log(`${tokenName} address is ${tokenDeployment.address}`);
        } catch (e) {
            console.log(`Token ${tokenName} not found. Available tokens:`);
            const allDeployments = await deployments.all();
            Object.keys(allDeployments).forEach(name => {
                if (name.includes("ConfidentialToken")) {
                    console.log(`  - ${name}: ${allDeployments[name].address}`);
                }
            });
        }
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:token-balance --address 0x123...
 *   - npx hardhat --network sepolia task:token-balance --address 0x123...
 */
task("task:token-balance", "Gets the encrypted balance of a token holder")
    .addParam("address", "Token contract address")
    .addOptionalParam("holder", "Token holder address (defaults to first signer)")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers, fhevm } = hre;

        await fhevm.initializeCLIApi();

        const tokenContract = await ethers.getContractAt("ConfidentialTokenExample", taskArguments.address);
        const signers = await ethers.getSigners();
        const holder = taskArguments.holder || signers[0].address;

        console.log(`Token: ${taskArguments.address}`);
        console.log(`Holder: ${holder}`);

        const encryptedBalance = await tokenContract.balanceOf(holder);
        if (encryptedBalance === ethers.ZeroHash) {
            console.log(`Encrypted balance: ${encryptedBalance}`);
            console.log("Clear balance    : 0");
            return;
        }

        const clearBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            encryptedBalance,
            taskArguments.address,
            signers[0],
        );
        console.log(`Encrypted balance: ${encryptedBalance}`);
        console.log(`Clear balance    : ${clearBalance}`);
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:token-mint --address 0x123... --to 0x456... --amount 100
 *   - npx hardhat --network sepolia task:token-mint --address 0x123... --to 0x456... --amount 100
 */
task("task:token-mint", "Mints tokens to a recipient")
    .addParam("address", "Token contract address")
    .addParam("to", "Recipient address")
    .addParam("amount", "Amount to mint")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers, fhevm } = hre;

        const amount = parseInt(taskArguments.amount);
        if (!Number.isInteger(amount) || amount <= 0) {
            throw new Error(`Argument --amount must be a positive integer`);
        }

        await fhevm.initializeCLIApi();

        const tokenContract = await ethers.getContractAt("ConfidentialTokenExample", taskArguments.address);
        const signers = await ethers.getSigners();

        console.log(`Token: ${taskArguments.address}`);
        console.log(`Recipient: ${taskArguments.to}`);
        console.log(`Amount: ${amount}`);

        // Encrypt the amount
        const encryptedAmount = await fhevm
            .createEncryptedInput(taskArguments.address, signers[0].address)
            .add64(BigInt(amount))
            .encrypt();

        const tx = await tokenContract
            .connect(signers[0])
            .mint(taskArguments.to, encryptedAmount.handles[0], encryptedAmount.inputProof);
        console.log(`Wait for tx:${tx.hash}...`);

        const receipt = await tx.wait();
        console.log(`tx:${tx.hash} status=${receipt?.status}`);

        console.log(`Mint ${amount} tokens to ${taskArguments.to} succeeded!`);
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:token-transfer --address 0x123... --from 0x456... --to 0x789... --amount 50
 *   - npx hardhat --network sepolia task:token-transfer --address 0x123... --from 0x456... --to 0x789... --amount 50
 */
task("task:token-transfer", "Transfers tokens from one address to another")
    .addParam("address", "Token contract address")
    .addParam("from", "Sender address")
    .addParam("to", "Recipient address")
    .addParam("amount", "Amount to transfer")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers, fhevm } = hre;

        const amount = parseInt(taskArguments.amount);
        if (!Number.isInteger(amount) || amount <= 0) {
            throw new Error(`Argument --amount must be a positive integer`);
        }

        await fhevm.initializeCLIApi();

        const tokenContract = await ethers.getContractAt("ConfidentialTokenExample", taskArguments.address);
        const signers = await ethers.getSigners();

        console.log(`Token: ${taskArguments.address}`);
        console.log(`From: ${taskArguments.from}`);
        console.log(`To: ${taskArguments.to}`);
        console.log(`Amount: ${amount}`);

        // Encrypt the amount
        const encryptedAmount = await fhevm
            .createEncryptedInput(taskArguments.address, signers[0].address)
            .add64(BigInt(amount))
            .encrypt();

        const tx = await tokenContract
            .connect(signers[0])
            .confidentialTransferFrom(
                taskArguments.from,
                taskArguments.to,
                encryptedAmount.handles[0],
                encryptedAmount.inputProof
            );
        console.log(`Wait for tx:${tx.hash}...`);

        const receipt = await tx.wait();
        console.log(`tx:${tx.hash} status=${receipt?.status}`);

        console.log(`Transfer ${amount} tokens from ${taskArguments.from} to ${taskArguments.to} succeeded!`);
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:token-set-operator --address 0x123... --owner 0x456... --operator 0x789...
 *   - npx hardhat --network sepolia task:token-set-operator --address 0x123... --owner 0x456... --operator 0x789...
 */
task("task:token-set-operator", "Sets an operator for a token holder")
    .addParam("address", "Token contract address")
    .addParam("owner", "Token holder address")
    .addParam("operator", "Operator address")
    .addOptionalParam("approved", "Whether to approve (true) or revoke (false) the operator", "true")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers } = hre;

        const approved = taskArguments.approved === "true";

        const tokenContract = await ethers.getContractAt("ConfidentialTokenExample", taskArguments.address);
        const signers = await ethers.getSigners();

        console.log(`Token: ${taskArguments.address}`);
        console.log(`Owner: ${taskArguments.owner}`);
        console.log(`Operator: ${taskArguments.operator}`);
        console.log(`Approved: ${approved}`);

        // Find the signer that matches the owner address
        const ownerSigner = signers.find(signer => signer.address.toLowerCase() === taskArguments.owner.toLowerCase());
        if (!ownerSigner) {
            throw new Error(`No signer found for owner address ${taskArguments.owner}`);
        }

        const tx = await tokenContract
            .connect(ownerSigner)
            .setOperator(taskArguments.operator, approved);
        console.log(`Wait for tx:${tx.hash}...`);

        const receipt = await tx.wait();
        console.log(`tx:${tx.hash} status=${receipt?.status}`);

        console.log(`Set operator ${taskArguments.operator} for ${taskArguments.owner} to ${approved} succeeded!`);
    });

/**
 * Example:
 *   - npx hardhat --network localhost task:token-info --address 0x123...
 *   - npx hardhat --network sepolia task:token-info --address 0x123...
 */
task("task:token-info", "Gets token information (name, symbol, URI, owner)")
    .addParam("address", "Token contract address")
    .setAction(async function (taskArguments: TaskArguments, hre) {
        const { ethers } = hre;

        const tokenContract = await ethers.getContractAt("ConfidentialTokenExample", taskArguments.address);

        console.log(`Token: ${taskArguments.address}`);
        console.log(`Name: ${await tokenContract.name()}`);
        console.log(`Symbol: ${await tokenContract.symbol()}`);
        console.log(`Token URI: ${await tokenContract.tokenURI()}`);
        console.log(`Owner: ${await tokenContract.owner()}`);
    });
