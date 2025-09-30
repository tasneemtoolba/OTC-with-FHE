import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialOtcEscrowWithOZ, ConfidentialOtcEscrowWithOZ__factory, ConfidentialTokenExample, ConfidentialTokenExample__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
    deployer: HardhatEthersSigner;
    alice: HardhatEthersSigner;
    bob: HardhatEthersSigner;
    gateway: HardhatEthersSigner;
};

async function deployFixture() {
    // Deploy token contracts
    const tokenFactory = (await ethers.getContractFactory("ConfidentialTokenExample")) as ConfidentialTokenExample__factory;

    const tokenIn = (await tokenFactory.deploy(
        1000, // initial amount
        "Token In",
        "TIN",
        "https://example.com/tokenin"
    )) as ConfidentialTokenExample;

    const tokenOut = (await tokenFactory.deploy(
        1000, // initial amount
        "Token Out",
        "TOUT",
        "https://example.com/tokenout"
    )) as ConfidentialTokenExample;

    // Deploy OTC escrow contract
    const escrowFactory = (await ethers.getContractFactory("ConfidentialOtcEscrowWithOZ")) as ConfidentialOtcEscrowWithOZ__factory;
    const escrowContract = (await escrowFactory.deploy(ethers.ZeroAddress)) as ConfidentialOtcEscrowWithOZ; // Using zero address as gateway for testing

    const tokenInAddress = await tokenIn.getAddress();
    const tokenOutAddress = await tokenOut.getAddress();
    const escrowAddress = await escrowContract.getAddress();

    return {
        escrowContract,
        escrowAddress,
        tokenIn,
        tokenInAddress,
        tokenOut,
        tokenOutAddress
    };
}

describe("ConfidentialOtcEscrowWithOZ", function () {
    let signers: Signers;
    let escrowContract: ConfidentialOtcEscrowWithOZ;
    let escrowAddress: string;
    let tokenIn: ConfidentialTokenExample;
    let tokenInAddress: string;
    let tokenOut: ConfidentialTokenExample;
    let tokenOutAddress: string;

    before(async function () {
        const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
        signers = {
            deployer: ethSigners[0],
            alice: ethSigners[1],
            bob: ethSigners[2],
            gateway: ethSigners[3]
        };
    });

    beforeEach(async function () {
        // Check whether the tests are running against an FHEVM mock environment
        if (!fhevm.isMock) {
            console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
            this.skip();
        }

        ({
            escrowContract,
            escrowAddress,
            tokenIn,
            tokenInAddress,
            tokenOut,
            tokenOutAddress
        } = await deployFixture());

        // Set gateway for the escrow contract
        await escrowContract.setGateway(signers.gateway.address);
    });

    it("should have correct gateway set", async function () {
        expect(await escrowContract.gateway()).to.equal(signers.gateway.address);
    });

    it("should create an order successfully", async function () {
        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const takerAddr = signers.bob.address;

        // Encrypt order parameters
        const orderInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.alice.address)
            .add64(BigInt(amountIn))
            .add64(BigInt(amountOut))
            .addAddress(takerAddr)
            .encrypt();

        // Create order
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

        // Check order was created
        const order = await escrowContract.orders(0);
        expect(order.maker).to.equal(signers.alice.address);
        expect(order.tokenIn).to.equal(tokenInAddress);
        expect(order.tokenOut).to.equal(tokenOutAddress);
        expect(order.deadline).to.equal(deadline);
        expect(order.filled).to.be.false;
        expect(order.cancelled).to.be.false;
    });

    it("should create an order with doTransferOut=true", async function () {
        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        // First, mint tokens to alice
        const mintAmount = 500;
        const encryptedMintAmount = await fhevm
            .createEncryptedInput(tokenOutAddress, signers.deployer.address)
            .add64(BigInt(mintAmount))
            .encrypt();

        await tokenOut
            .connect(signers.deployer)
            .mint(signers.alice.address, encryptedMintAmount.handles[0], encryptedMintAmount.inputProof);

        // Set escrow as operator for alice's tokenOut
        await tokenOut
            .connect(signers.alice)
            .setOperator(escrowAddress, true);

        // Encrypt order parameters
        const orderInput = await fhevm
            .createEncryptedInput(escrowAddress, signers.alice.address)
            .add64(BigInt(amountIn))
            .add64(BigInt(amountOut))
            .addAddress(takerAddr)
            .encrypt();

        // Create order with doTransferOut=true
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

        // Check order was created
        const order = await escrowContract.orders(0);
        expect(order.maker).to.equal(signers.alice.address);
        expect(order.tokenIn).to.equal(tokenInAddress);
        expect(order.tokenOut).to.equal(tokenOutAddress);
        expect(order.deadline).to.equal(deadline);
        expect(order.filled).to.be.false;
        expect(order.cancelled).to.be.false;
    });

    it("should allow maker to cancel order", async function () {
        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        // Create order
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

        // Cancel order
        const tx = await escrowContract
            .connect(signers.alice)
            .cancelOrder(0);
        await tx.wait();

        // Check order is cancelled
        const order = await escrowContract.orders(0);
        expect(order.cancelled).to.be.true;
    });

    it("should allow taker to fill order", async function () {
        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        // Create order
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

        // Fill order
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

        // Check order has taker payment recorded
        const order = await escrowContract.orders(0);
        expect(order.takerPayEnc).to.not.equal(ethers.ZeroHash);
    });

    it("should allow gateway to finalize fill", async function () {
        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        // Create order
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

        // Fill order
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

        // Finalize fill
        const tx = await escrowContract
            .connect(signers.gateway)
            .finalizeFill(0, signers.bob.address);
        await tx.wait();

        // Check order is filled
        const order = await escrowContract.orders(0);
        expect(order.filled).to.be.true;
    });

    it("should check if order is open", async function () {
        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        // Create order
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

        // Check order is open
        expect(await escrowContract.isOpen(0)).to.be.true;

        // Cancel order
        await escrowContract
            .connect(signers.alice)
            .cancelOrder(0);

        // Check order is not open
        expect(await escrowContract.isOpen(0)).to.be.false;
    });

    it("should revert when non-maker tries to cancel order", async function () {
        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        // Create order
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

        // Try to cancel order as non-maker
        await expect(
            escrowContract
                .connect(signers.bob)
                .cancelOrder(0)
        ).to.be.revertedWith("only maker");
    });

    it("should revert when non-gateway tries to finalize fill", async function () {
        const amountIn = 100;
        const amountOut = 200;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const takerAddr = signers.bob.address;

        // Create order
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

        // Fill order
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

        // Try to finalize fill as non-gateway
        await expect(
            escrowContract
                .connect(signers.bob)
                .finalizeFill(0, signers.bob.address)
        ).to.be.revertedWith("only gateway");
    });
});
