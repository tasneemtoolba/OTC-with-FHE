# Confidential OTC Escrow

This project implements a **Confidential OTC (Over-The-Counter) Escrow** smart contract that combines:

- **OpenZeppelin Confidential Contracts (ERC-7984)** for confidential token balances and transfers.
- **Zama FHEVM library** for encrypted values (`euint64`, `eaddress`) and confidential operations.
- **Gateway / Relayer SDK** for encrypted input generation, attestations, and finalization of trades.

---

## ✨ Features
- Confidential order creation: maker posts an order with encrypted amountIn, amountOut, and optional allowlisted taker.
- Confidential escrow: tokens are moved into the contract using ERC-7984 `confidentialTransferFrom`.
- Encrypted taker payments: taker pays in using confidential tokens.
- Off-chain equality checks: encrypted equality (`amountIn == takerPay`) is validated by the **Gateway**.
- Gateway finalization: once transfers are valid, the Gateway calls `finalizeFill(...)` on-chain.
- Optional post-trade reveal: maker can choose to make amounts/taker publicly decryptable for audit.

---

## 📜 Architecture

```
Maker                     OTC Escrow Contract                 Taker
 │  createEncryptedInput   │                                   │
 │ ───────────────────────▶│ OrderCreated (encrypted)          │
 │ confidentialTransferOut │                                   │
 │ ───────────────────────▶│                                   │
 │                         │                                   │ createEncryptedInput
 │                         │◀───────────────────────────────── │
 │                         │ FillRequested (takerPay handle)   │
 │                         │                                   │
 │                         ▼                                   │
 │                   FHE Execution Layer / Gateway             │
 │                   - validate attestations                   │
 │                   - check encrypted equality                │
 │                   - transfer confidential balances          │
 │                   - call finalizeFill on-chain              │
 │                                                             │
```

### Flow
1. Maker encrypts order terms (amountIn, amountOut, optional taker) and escrows `amountOut` tokens.
2. Maker calls `createOrder(...)` with external handles + attestation.
3. Taker encrypts payment (`takerPayEnc`) and calls `fillOrder(...)`.
4. Contract records taker handle, emits `FillRequested`.
5. Gateway validates `amountInEnc == takerPayEnc`, performs confidential transfers:
   - `takerPay` → maker
   - `amountOut` → taker
6. Gateway calls `finalizeFill(orderId, taker)`.
7. Maker may reveal terms post-trade.

---

### Gateway Responsibilities

![Gateway Flow](./docs/gateway_flow.png)

- **Issue attestations** for encrypted inputs created with the Relayer SDK.
- **Validate ciphertext equality** (e.g., `amountIn == takerPay`).
- **Update confidential balances** in ERC-7984 tokens.
- **Finalize escrow fills** by calling back into the smart contract with `finalizeFill`.

---

## 🛠 Installation

```bash
# install dependencies
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers typescript ts-node
npm install @zama-fhe/relayer-sdk @openzeppelin/confidential-contracts
```

---

## 🚀 Deployment (Base network example)

Update `hardhat.config.ts`:
```ts
networks: {
  base: {
    url: process.env.BASE_RPC,
    chainId: 8453,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY]
  },
  baseSepolia: {
    url: process.env.BASE_SEPOLIA_RPC,
    chainId: 84532,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY]
  }
}
```

Deploy:
```bash
npx hardhat run scripts/deploy.ts --network base
```

---

## 🔑 Usage

### Maker creates order
```ts
const enc = await createEncryptedInput(relayer);
enc.addUint64(amountIn);
enc.addUint64(amountOut);
enc.addAddress(taker);
const { handles, attestation } = enc.build();

await otc.createOrder(
  tokenIn,
  tokenOut,
  handles[0], // amountIn
  handles[1], // amountOut
  handles[2], // taker
  attestation,
  deadline,
  true // doTransferOut
);
```

### Taker fills order
```ts
const enc = await createEncryptedInput(relayer);
enc.addUint64(payIn);
const { handles, attestation } = enc.build();

await otc.fillOrder(
  orderId,
  handles[0], // takerPay
  attestation,
  true // doTransferIn
);
```

### Gateway finalizes
```solidity
// Only callable by gateway
function finalizeFill(uint256 id, address taker) external;
```

### Reveal terms
```solidity
function revealTerms(uint256 id) external;
```

---

## 📊 Diagram

![Architecture](./docs/architecture.png)

---

## 🔒 Security Notes
- Never try to `require` encrypted booleans on-chain — comparisons must be validated by the Gateway.
- Ensure the `gateway` address is properly governed (multisig or DAO).
- Always audit before mainnet deployment.

---

## 📚 References
- [Zama FHEVM](https://docs.zama.ai/fhevm)
- [OpenZeppelin Confidential Contracts](https://docs.openzeppelin.com/confidential-contracts)

