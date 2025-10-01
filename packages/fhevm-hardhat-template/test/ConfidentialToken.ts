import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialTokenExample, ConfidentialTokenExample__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
    deployer: HardhatEthersSigner;
    alice: HardhatEthersSigner;
    bob: HardhatEthersSigner;
};

async function deployFixture() {
    const factory = (await ethers.getContractFactory("ConfidentialTokenExample")) as ConfidentialTokenExample__factory;
    const tokenContract = (await factory.deploy(
        1000, // initial amount
        "Test Confidential Token",
        "TCT",
        "https://example.com/metadata"
    )) as ConfidentialTokenExample;
    const tokenContractAddress = await tokenContract.getAddress();

    return { tokenContract, tokenContractAddress };
}

describe("ConfidentialTokenExample", function () {
    let signers: Signers;
    let tokenContract: ConfidentialTokenExample;
    let tokenContractAddress: string;

    before(async function () {
        const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
        signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
    });

    beforeEach(async function () {
        // Check whether the tests are running against an FHEVM mock environment
        if (!fhevm.isMock) {
            console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
            this.skip();
        }

        ({ tokenContract, tokenContractAddress } = await deployFixture());
    });

    it("should have correct name, symbol, and tokenURI", async function () {
        expect(await tokenContract.name()).to.equal("Test Confidential Token");
        expect(await tokenContract.symbol()).to.equal("TCT");
        expect(await tokenContract.tokenURI()).to.equal("https://example.com/metadata");
    });

    it("should have correct owner", async function () {
        expect(await tokenContract.owner()).to.equal(signers.deployer.address);
    });

    it("should have initial encrypted balance for deployer", async function () {
        const encryptedBalance = await tokenContract.balanceOf(signers.deployer.address);
        expect(encryptedBalance).to.not.equal(ethers.ZeroHash);

        const clearBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            encryptedBalance,
            tokenContractAddress,
            signers.deployer,
        );
        expect(clearBalance).to.equal(1000);
    });

    it("should allow confidential transfer from deployer to alice", async function () {
        const transferAmount = 100;

        // Encrypt the transfer amount
        const encryptedAmount = await fhevm
            .createEncryptedInput(tokenContractAddress, signers.deployer.address)
            .add64(BigInt(transferAmount))
            .encrypt();

        // Get initial balances
        const initialDeployerBalance = await tokenContract.balanceOf(signers.deployer.address);
        const initialAliceBalance = await tokenContract.balanceOf(signers.alice.address);

        // Perform confidential transfer
        const tx = await tokenContract
            .connect(signers.deployer)
            .confidentialTransferFrom(
                signers.deployer.address,
                signers.alice.address,
                encryptedAmount.handles[0],
                encryptedAmount.inputProof
            );
        await tx.wait();

        // Check final balances
        const finalDeployerBalance = await tokenContract.balanceOf(signers.deployer.address);
        const finalAliceBalance = await tokenContract.balanceOf(signers.alice.address);

        // Decrypt balances
        const clearInitialDeployerBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            initialDeployerBalance,
            tokenContractAddress,
            signers.deployer,
        );
        const clearInitialAliceBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            initialAliceBalance,
            tokenContractAddress,
            signers.alice,
        );
        const clearFinalDeployerBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            finalDeployerBalance,
            tokenContractAddress,
            signers.deployer,
        );
        const clearFinalAliceBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            finalAliceBalance,
            tokenContractAddress,
            signers.alice,
        );

        expect(clearFinalDeployerBalance).to.equal(clearInitialDeployerBalance - transferAmount);
        expect(clearFinalAliceBalance).to.equal(clearInitialAliceBalance + transferAmount);
    });

    it("should allow minting new tokens", async function () {
        const mintAmount = 500;

        // Encrypt the mint amount
        const encryptedAmount = await fhevm
            .createEncryptedInput(tokenContractAddress, signers.deployer.address)
            .add64(BigInt(mintAmount))
            .encrypt();

        // Get initial balance
        const initialBalance = await tokenContract.balanceOf(signers.alice.address);

        // Mint tokens to alice
        const tx = await tokenContract
            .connect(signers.deployer)
            .mint(signers.alice.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
        await tx.wait();

        // Check final balance
        const finalBalance = await tokenContract.balanceOf(signers.alice.address);

        // Decrypt balances
        const clearInitialBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            initialBalance,
            tokenContractAddress,
            signers.alice,
        );
        const clearFinalBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            finalBalance,
            tokenContractAddress,
            signers.alice,
        );

        expect(clearFinalBalance).to.equal(clearInitialBalance + mintAmount);
    });

    it("should allow setting operator approval", async function () {
        // Set alice as operator for bob
        const tx = await tokenContract
            .connect(signers.bob)
            .setOperator(signers.alice.address, true);
        await tx.wait();

        // Check operator status
        const isOperator = await tokenContract.isOperator(signers.bob.address, signers.alice.address);
        expect(isOperator).to.be.true;
    });

    it("should allow operator to perform confidential transfer", async function () {
        const transferAmount = 50;

        // First, mint some tokens to bob
        const mintAmount = 200;
        const encryptedMintAmount = await fhevm
            .createEncryptedInput(tokenContractAddress, signers.deployer.address)
            .add64(BigInt(mintAmount))
            .encrypt();

        await tokenContract
            .connect(signers.deployer)
            .mint(signers.bob.address, encryptedMintAmount.handles[0], encryptedMintAmount.inputProof);

        // Set alice as operator for bob
        await tokenContract
            .connect(signers.bob)
            .setOperator(signers.alice.address, true);

        // Encrypt the transfer amount
        const encryptedAmount = await fhevm
            .createEncryptedInput(tokenContractAddress, signers.alice.address)
            .add64(BigInt(transferAmount))
            .encrypt();

        // Get initial balances
        const initialBobBalance = await tokenContract.balanceOf(signers.bob.address);
        const initialAliceBalance = await tokenContract.balanceOf(signers.alice.address);

        // Perform confidential transfer as operator
        const tx = await tokenContract
            .connect(signers.alice)
            .confidentialTransferFrom(
                signers.bob.address,
                signers.alice.address,
                encryptedAmount.handles[0],
                encryptedAmount.inputProof
            );
        await tx.wait();

        // Check final balances
        const finalBobBalance = await tokenContract.balanceOf(signers.bob.address);
        const finalAliceBalance = await tokenContract.balanceOf(signers.alice.address);

        // Decrypt balances
        const clearInitialBobBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            initialBobBalance,
            tokenContractAddress,
            signers.bob,
        );
        const clearInitialAliceBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            initialAliceBalance,
            tokenContractAddress,
            signers.alice,
        );
        const clearFinalBobBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            finalBobBalance,
            tokenContractAddress,
            signers.bob,
        );
        const clearFinalAliceBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            finalAliceBalance,
            tokenContractAddress,
            signers.alice,
        );

        expect(clearFinalBobBalance).to.equal(clearInitialBobBalance - transferAmount);
        expect(clearFinalAliceBalance).to.equal(clearInitialAliceBalance + transferAmount);
    });

    it("should revert when non-operator tries to transfer", async function () {
        const transferAmount = 50;

        // Mint some tokens to bob
        const mintAmount = 200;
        const encryptedMintAmount = await fhevm
            .createEncryptedInput(tokenContractAddress, signers.deployer.address)
            .add64(BigInt(mintAmount))
            .encrypt();

        await tokenContract
            .connect(signers.deployer)
            .mint(signers.bob.address, encryptedMintAmount.handles[0], encryptedMintAmount.inputProof);

        // Encrypt the transfer amount
        const encryptedAmount = await fhevm
            .createEncryptedInput(tokenContractAddress, signers.alice.address)
            .add64(BigInt(transferAmount))
            .encrypt();

        // Try to transfer from bob to alice without operator approval
        await expect(
            tokenContract
                .connect(signers.alice)
                .confidentialTransferFrom(
                    signers.bob.address,
                    signers.alice.address,
                    encryptedAmount.handles[0],
                    encryptedAmount.inputProof
                )
        ).to.be.reverted;
    });
});
