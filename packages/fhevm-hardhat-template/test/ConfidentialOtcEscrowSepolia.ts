import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { ConfidentialOtcEscrowWithOZ, ConfidentialTokenExample } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
    deployer: HardhatEthersSigner;
    alice: HardhatEthersSigner;
    bob: HardhatEthersSigner;
    gateway: HardhatEthersSigner;
};

describe("ConfidentialOtcEscrowSepolia", function () {
    let signers: Signers;
    let escrowContract: ConfidentialOtcEscrowWithOZ;
    let escrowAddress: string;
    let tokenIn: ConfidentialTokenExample;
    let tokenInAddress: string;
    let tokenOut: ConfidentialTokenExample;
    let tokenOutAddress: string;
    let step: number;
    let steps: number;

    function progress(message: string) {
        console.log(`${++step}/${steps} ${message}`);
    }

    before(async function () {
        if (fhevm.isMock) {
            console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
            this.skip();
        }

        try {
            const ConfidentialOtcEscrowDeployment = await deployments.get("ConfidentialOtcEscrowWithOZ");
            escrowAddress = ConfidentialOtcEscrowDeployment.address;
            escrowContract = await ethers.getContractAt("ConfidentialOtcEscrowWithOZ", ConfidentialOtcEscrowDeployment.address);

            const ConfidentialTokenInDeployment = await deployments.get("ConfidentialTokenIn");
            tokenInAddress = ConfidentialTokenInDeployment.address;
            tokenIn = await ethers.getContractAt("ConfidentialTokenExample", ConfidentialTokenInDeployment.address);

            const ConfidentialTokenOutDeployment = await deployments.get("ConfidentialTokenOut");
            tokenOutAddress = ConfidentialTokenOutDeployment.address;
            tokenOut = await ethers.getContractAt("ConfidentialTokenExample", ConfidentialTokenOutDeployment.address);
        } catch (e) {
            (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
            throw e;
        }

        const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
        signers = {
            deployer: ethSigners[0],
            alice: ethSigners[1],
            bob: ethSigners[2],
            gateway: ethSigners[3]
        };
    });

    beforeEach(async () => {
        step = 0;
        steps = 0;
    });

    it("should have correct gateway set", async function () {
        steps = 1;
        this.timeout(40000);

        progress("Checking gateway address...");
        expect(await escrowContract.gateway()).to.equal(signers.gateway.address);
    });

    it("should create an order successfully", async function () {
        steps = 6;
        this.timeout(3 * 40000);

        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const takerAddr = signers.bob.address;

        progress("Encrypting order parameters...");
        const orderInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.alice.address)
            .add64(BigInt(amountIn))
            .add64(BigInt(amountOut))
            .addAddress(takerAddr)
            .encrypt();

        progress("Creating order...");
        const tx = await escrowContract
            .connect(signers.alice)
            .createOrder(
                tokenInAddress,
                tokenOutAddress,
                orderInput.handles[0], // amountIn
                orderInput.handles[1], // amountOut
                orderInput.handles[2], // takerAddr
                orderInput.inputProof,
                deadline,
                false // doTransferOut
            );
        await tx.wait();

        progress("Checking order was created...");
        const order = await escrowContract.orders(0);
        expect(order.maker).to.equal(signers.alice.address);
        expect(order.tokenIn).to.equal(tokenInAddress);
        expect(order.tokenOut).to.equal(tokenOutAddress);
        expect(order.deadline).to.equal(deadline);
        expect(order.filled).to.be.false;
        expect(order.cancelled).to.be.false;
    });

    it("should create an order with doTransferOut=true", async function () {
        steps = 10;
        this.timeout(5 * 40000);

        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        progress("Minting tokens to alice...");
        const mintAmount = 500;
        const encryptedMintAmount = await fhevm
            .createEncryptedInput(tokenOutAddress, signers.deployer.address)
            .add64(BigInt(mintAmount))
            .encrypt();

        await tokenOut
            .connect(signers.deployer)
            .mint(signers.alice.address, encryptedMintAmount.handles[0], encryptedMintAmount.inputProof);

        progress("Setting escrow as operator...");
        await tokenOut
            .connect(signers.alice)
            .setOperator(escrowAddress, true);

        progress("Encrypting order parameters...");
        const orderInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.alice.address)
            .add64(BigInt(amountIn))
            .add64(BigInt(amountOut))
            .addAddress(takerAddr)
            .encrypt();

        progress("Creating order with doTransferOut=true...");
        const tx = await escrowContract
            .connect(signers.alice)
            .createOrder(
                tokenInAddress,
                tokenOutAddress,
                orderInput.handles[0], // amountIn
                orderInput.handles[1], // amountOut
                orderInput.handles[2], // takerAddr
                orderInput.inputProof,
                deadline,
                true // doTransferOut
            );
        await tx.wait();

        progress("Checking order was created...");
        const order = await escrowContract.orders(0);
        expect(order.maker).to.equal(signers.alice.address);
        expect(order.tokenIn).to.equal(tokenInAddress);
        expect(order.tokenOut).to.equal(tokenOutAddress);
        expect(order.deadline).to.equal(deadline);
        expect(order.filled).to.be.false;
        expect(order.cancelled).to.be.false;
    });

    it("should allow maker to cancel order", async function () {
        steps = 8;
        this.timeout(4 * 40000);

        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        progress("Creating order...");
        const orderInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.alice.address)
            .add64(BigInt(amountIn))
            .add64(BigInt(amountOut))
            .addAddress(takerAddr)
            .encrypt();

        await escrowContract
            .connect(signers.alice)
            .createOrder(
                tokenInAddress,
                tokenOutAddress,
                orderInput.handles[0],
                orderInput.handles[1],
                orderInput.handles[2],
                orderInput.inputProof,
                deadline,
                false
            );

        progress("Cancelling order...");
        const tx = await escrowContract
            .connect(signers.alice)
            .cancelOrder(0);
        await tx.wait();

        progress("Checking order is cancelled...");
        const order = await escrowContract.orders(0);
        expect(order.cancelled).to.be.true;
    });

    it("should allow taker to fill order", async function () {
        steps = 8;
        this.timeout(4 * 40000);

        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        progress("Creating order...");
        const orderInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.alice.address)
            .add64(BigInt(amountIn))
            .add64(BigInt(amountOut))
            .addAddress(takerAddr)
            .encrypt();

        await escrowContract
            .connect(signers.alice)
            .createOrder(
                tokenInAddress,
                tokenOutAddress,
                orderInput.handles[0],
                orderInput.handles[1],
                orderInput.handles[2],
                orderInput.inputProof,
                deadline,
                false
            );

        progress("Filling order...");
        const takerPayAmount = 100;
        const takerPayInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.bob.address)
            .add64(BigInt(takerPayAmount))
            .encrypt();

        const tx = await escrowContract
            .connect(signers.bob)
            .fillOrder(
                0,
                takerPayInput.handles[0],
                takerPayInput.inputProof,
                false // doTransferIn
            );
        await tx.wait();

        progress("Checking order has taker payment recorded...");
        const order = await escrowContract.orders(0);
        expect(order.takerPayEnc).to.not.equal(ethers.ZeroHash);
    });

    it("should allow gateway to finalize fill", async function () {
        steps = 10;
        this.timeout(5 * 40000);

        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        progress("Creating order...");
        const orderInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.alice.address)
            .add64(BigInt(amountIn))
            .add64(BigInt(amountOut))
            .addAddress(takerAddr)
            .encrypt();

        await escrowContract
            .connect(signers.alice)
            .createOrder(
                tokenInAddress,
                tokenOutAddress,
                orderInput.handles[0],
                orderInput.handles[1],
                orderInput.handles[2],
                orderInput.inputProof,
                deadline,
                false
            );

        progress("Filling order...");
        const takerPayAmount = 100;
        const takerPayInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.bob.address)
            .add64(BigInt(takerPayAmount))
            .encrypt();

        await escrowContract
            .connect(signers.bob)
            .fillOrder(
                0,
                takerPayInput.handles[0],
                takerPayInput.inputProof,
                false
            );

        progress("Finalizing fill...");
        const tx = await escrowContract
            .connect(signers.gateway)
            .finalizeFill(0, signers.bob.address);
        await tx.wait();

        progress("Checking order is filled...");
        const order = await escrowContract.orders(0);
        expect(order.filled).to.be.true;
    });

    it("should check if order is open", async function () {
        steps = 6;
        this.timeout(3 * 40000);

        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        progress("Creating order...");
        const orderInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.alice.address)
            .add64(BigInt(amountIn))
            .add64(BigInt(amountOut))
            .addAddress(takerAddr)
            .encrypt();

        await escrowContract
            .connect(signers.alice)
            .createOrder(
                tokenInAddress,
                tokenOutAddress,
                orderInput.handles[0],
                orderInput.handles[1],
                orderInput.handles[2],
                orderInput.inputProof,
                deadline,
                false
            );

        progress("Checking order is open...");
        expect(await escrowContract.isOpen(0)).to.be.true;

        progress("Cancelling order...");
        await escrowContract
            .connect(signers.alice)
            .cancelOrder(0);

        progress("Checking order is not open...");
        expect(await escrowContract.isOpen(0)).to.be.false;
    });
});
