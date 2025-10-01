import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { ConfidentialTokenExample } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
    deployer: HardhatEthersSigner;
    alice: HardhatEthersSigner;
};

describe("ConfidentialTokenSepolia", function () {
    let signers: Signers;
    let tokenContract: ConfidentialTokenExample;
    let tokenContractAddress: string;
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
            const ConfidentialTokenDeployment = await deployments.get("ConfidentialTokenExample");
            tokenContractAddress = ConfidentialTokenDeployment.address;
            tokenContract = await ethers.getContractAt("ConfidentialTokenExample", ConfidentialTokenDeployment.address);
        } catch (e) {
            (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
            throw e;
        }

        const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
        signers = { deployer: ethSigners[0], alice: ethSigners[1] };
    });

    beforeEach(async () => {
        step = 0;
        steps = 0;
    });

    it("should have correct name, symbol, and tokenURI", async function () {
        steps = 3;
        this.timeout(2 * 40000);

        progress("Checking token name...");
        expect(await tokenContract.name()).to.equal("Test Confidential Token");

        progress("Checking token symbol...");
        expect(await tokenContract.symbol()).to.equal("TCT");

        progress("Checking token URI...");
        expect(await tokenContract.tokenURI()).to.equal("https://example.com/metadata");
    });

    it("should have correct owner", async function () {
        steps = 1;
        this.timeout(40000);

        progress("Checking contract owner...");
        expect(await tokenContract.owner()).to.equal(signers.deployer.address);
    });

    it("should have initial encrypted balance for deployer", async function () {
        steps = 3;
        this.timeout(2 * 40000);

        progress("Getting encrypted balance...");
        const encryptedBalance = await tokenContract.balanceOf(signers.deployer.address);
        expect(encryptedBalance).to.not.equal(ethers.ZeroHash);

        progress("Decrypting balance...");
        const clearBalance = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            encryptedBalance,
            tokenContractAddress,
            signers.deployer,
        );
        progress(`Clear balance: ${clearBalance}`);
        expect(clearBalance).to.equal(1000);
    });

    it("should allow confidential transfer from deployer to alice", async function () {
        steps = 8;
        this.timeout(4 * 40000);

        const transferAmount = 100;

        progress("Encrypting transfer amount...");
        const encryptedAmount = await fhevm
            .createEncryptedInput(tokenContractAddress, signers.deployer.address)
            .add64(BigInt(transferAmount))
            .encrypt();

        progress("Getting initial balances...");
        const initialDeployerBalance = await tokenContract.balanceOf(signers.deployer.address);
        const initialAliceBalance = await tokenContract.balanceOf(signers.alice.address);

        progress("Performing confidential transfer...");
        const tx = await tokenContract
            .connect(signers.deployer)
            .confidentialTransferFrom(
                signers.deployer.address,
                signers.alice.address,
                encryptedAmount.handles[0],
                encryptedAmount.inputProof
            );
        await tx.wait();

        progress("Getting final balances...");
        const finalDeployerBalance = await tokenContract.balanceOf(signers.deployer.address);
        const finalAliceBalance = await tokenContract.balanceOf(signers.alice.address);

        progress("Decrypting initial balances...");
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

        progress("Decrypting final balances...");
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
        steps = 6;
        this.timeout(3 * 40000);

        const mintAmount = 500;

        progress("Encrypting mint amount...");
        const encryptedAmount = await fhevm
            .createEncryptedInput(tokenContractAddress, signers.deployer.address)
            .add64(BigInt(mintAmount))
            .encrypt();

        progress("Getting initial balance...");
        const initialBalance = await tokenContract.balanceOf(signers.alice.address);

        progress("Minting tokens...");
        const tx = await tokenContract
            .connect(signers.deployer)
            .mint(signers.alice.address, encryptedAmount.handles[0], encryptedAmount.inputProof);
        await tx.wait();

        progress("Getting final balance...");
        const finalBalance = await tokenContract.balanceOf(signers.alice.address);

        progress("Decrypting balances...");
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
        steps = 3;
        this.timeout(2 * 40000);

        progress("Setting alice as operator for deployer...");
        const tx = await tokenContract
            .connect(signers.deployer)
            .setOperator(signers.alice.address, true);
        await tx.wait();

        progress("Checking operator status...");
        const isOperator = await tokenContract.isOperator(signers.deployer.address, signers.alice.address);
        expect(isOperator).to.be.true;
    });
});
