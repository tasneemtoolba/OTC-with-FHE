// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Confidential OTC Escrow - OpenZeppelin ERC-7984 + Zama FHEVM
 *
 * - This contract combines Zama's FHE primitives (handles, fromExternal, allow, makePubliclyDecryptable)
 *   with confidential-token flows (OpenZeppelin ERC-7984 style).
 *
 * - Flow:
 *   1) Maker prepares ciphertexts (amountIn, amountOut) using a relayer/Gateway and either:
 *        a) moves the amountOut ciphertext into this contract via the confidential token's
 *           `confidentialTransferFrom(maker -> this)` before calling createOrder, OR
 *        b) lets createOrder call the token's `confidentialTransferFrom` itself.
 *   2) Maker calls createOrder(...) giving external handles + attestation.
 *   3) Taker prepares a ciphertext for pay-in and calls fillOrder(...) (records taker handle).
 *   4) This emits FillRequested. The FHE execution layer / Gateway validates equality (amountIn == takerPay)
 *      and performs the confidential token movement (takerPay -> maker, amountOut -> taker).
 *   5) After that off-chain step, the Gateway calls finalizeFill(...) on-chain to mark the order filled.
 *
 * NOTE: adapt IERC7984 method names / signatures to match your installed OpenZeppelin confidential-contracts version.
 */

import {FHE, euint64, externalEuint64, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// Minimal ERC-7984-like interface for confidential tokens.
/// Replace / remove this interface and import the real OZ interface if available in your project.
interface IERC7984Minimal {
    /// Confidential transfer where caller moves `amountExt` ciphertext from `from` to `to`.
    /// The exact signature in OZ may differ; adapt accordingly.
    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 amountExt,
        bytes calldata attestation
    ) external;

    /// Confidential transfer that moves an already-owned ciphertext (internal handle) to `to`.
    /// Some token implementations may instead expose different APIs — adapt when needed.
    function confidentialTransferTo(address to, externalEuint64 amountExt, bytes calldata attestation) external;
}

/// Public interface for the OTC escrow (so external tools/tests can import it).
interface IConfidentialOtcEscrow {
    // Events
    event OrderCreated(uint256 indexed id, address indexed maker, address tokenIn, address tokenOut, uint64 deadline);
    event FillRequested(uint256 indexed id, address indexed taker);
    event OrderFinalized(uint256 indexed id, address indexed taker);
    event OrderCancelled(uint256 indexed id);
    event TermsRevealed(uint256 indexed id);

    // Core functions
    function createOrder(
        address tokenIn,
        address tokenOut,
        externalEuint64 amountInExt,
        externalEuint64 amountOutExt,
        externalEaddress maybeTakerExt,
        bytes calldata attestation,
        uint64 deadline,
        bool doTransferOut // if true, contract attempts tokenOut.confidentialTransferFrom(maker -> contract)
    ) external returns (uint256 id);

    function fillOrder(
        uint256 id,
        externalEuint64 takerPayExt,
        bytes calldata attestation,
        bool doTransferIn // if true, contract attempts tokenIn.confidentialTransferFrom(taker -> contract) before requesting fill
    ) external;

    function finalizeFill(uint256 id, address taker) external;

    function cancelOrder(uint256 id) external;

    function revealTerms(uint256 id) external;

    function isOpen(uint256 id) external view returns (bool);
}

/// Implementation
contract ConfidentialOtcEscrowWithOZ is IConfidentialOtcEscrow, SepoliaConfig {
    address public gateway; // authorized FHE execution layer / gateway

    constructor(address _gateway) {
        require(_gateway != address(0), "gateway=0");
        gateway = _gateway;
    }

    struct Order {
        address maker;
        address tokenIn; // address of confidential token (IERC7984-like)
        address tokenOut;
        euint64 amountInEnc; // internal handle
        euint64 amountOutEnc; // internal handle (escrow)
        eaddress takerEnc; // optional allowlist (0 => any)
        uint64 deadline;
        bool filled;
        bool cancelled;
        euint64 takerPayEnc; // recorded taker payment handle (initially empty)
    }

    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId;

    // ----------------------
    // Maker: create an order
    // ----------------------
    /// @param tokenIn  token taker will use to pay (confidential token)
    /// @param tokenOut token maker will escrow (confidential token)
    /// @param amountInExt external handle (relayer-produced) for required taker payment
    /// @param amountOutExt external handle for escrowed ciphertext (should be owned by maker prior to transfer)
    /// @param maybeTakerExt optional encrypted taker allowlist (external)
    /// @param attestation signatures from gateway/relayer verifying handles
    /// @param deadline unix seconds
    /// @param doTransferOut if true, the contract will call tokenOut.confidentialTransferFrom(msg.sender, address(this), amountOutExt, attestation)
    function createOrder(
        address tokenIn,
        address tokenOut,
        externalEuint64 amountInExt,
        externalEuint64 amountOutExt,
        externalEaddress maybeTakerExt,
        bytes calldata attestation,
        uint64 deadline,
        bool doTransferOut
    ) external override returns (uint256 id) {
        require(deadline > block.timestamp, "deadline past");
        require(tokenIn != address(0) && tokenOut != address(0), "token=0");

        // If caller asked the contract to perform the confidential transfer of amountOut into escrow,
        // call the token's confidentialTransferFrom. This is optional — frontends sometimes do the transfer
        // before calling createOrder. Ensure you adapt the token interface to your OZ version.
        if (doTransferOut) {
            IERC7984Minimal(tokenOut).confidentialTransferFrom(msg.sender, address(this), amountOutExt, attestation);
            // Note: confidentialTransferFrom will generate attestations / state the ciphertext now belongs to contract.
            // We still call FHE.fromExternal below to import the handle.
        }

        // Import external handles -> internal handles (validates attestation)
        euint64 amountIn = FHE.fromExternal(amountInExt, attestation);
        euint64 amountOut = FHE.fromExternal(amountOutExt, attestation);
        eaddress takerHandle = FHE.fromExternal(maybeTakerExt, attestation);

        id = nextOrderId++;
        orders[id] = Order({
            maker: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountInEnc: amountIn,
            amountOutEnc: amountOut,
            takerEnc: takerHandle,
            deadline: deadline,
            filled: false,
            cancelled: false,
            takerPayEnc: euint64.wrap(0)
        });

        // persistently allow this contract to reference the escrow handle (so later operations can use it)
        FHE.allow(amountOut, address(this));

        emit OrderCreated(id, msg.sender, tokenIn, tokenOut, deadline);
    }

    // ----------------------
    // Maker: cancel order
    // ----------------------
    function cancelOrder(uint256 id) external override {
        Order storage o = orders[id];
        require(o.maker == msg.sender, "only maker");
        require(!o.filled && !o.cancelled, "closed");

        o.cancelled = true;
        emit OrderCancelled(id);

        // The FHE execution layer / Gateway should observe this and revert the escrow ciphertext ownership
        // back to maker (or the UI can orchestrate doing confidentialTransferFrom(contract -> maker) with attestation).
    }

    // ----------------------
    // Taker: request fill
    // ----------------------
    /// takerPayExt: external handle produced by relayer (encrypted pay-in)
    /// attestation: signatures proving the handle was created for the taker and contract
    /// doTransferIn: if true, contract calls tokenIn.confidentialTransferFrom(taker -> contract) before recording request
    function fillOrder(
        uint256 id,
        externalEuint64 takerPayExt,
        bytes calldata attestation,
        bool doTransferIn
    ) external override {
        Order storage o = orders[id];
        require(!o.filled && !o.cancelled, "closed");
        require(block.timestamp <= o.deadline, "expired");

        if (doTransferIn) {
            // attempt to move the confidential ciphertext representing payment into this contract's custody
            IERC7984Minimal(o.tokenIn).confidentialTransferFrom(msg.sender, address(this), takerPayExt, attestation);
        }

        // Import taker handle (validates attestation)
        euint64 takerPay = FHE.fromExternal(takerPayExt, attestation);

        // Record it so off-chain FHE execution layer & Gateway can find it and do equality checks & transfers
        o.takerPayEnc = takerPay;

        // Allow transient access for this transaction (in case some immediate symbolic ops are executed)
        FHE.allowTransient(takerPay, address(this));

        emit FillRequested(id, msg.sender);
    }

    // ---------------------------------------
    // Gateway: finalize after FHE validation
    // ---------------------------------------
    /// Called by the authorized gateway once it has validated equality (amountInEnc == takerPayEnc)
    /// and performed the confidential-token movements off-chain / in the gateway's storage:
    ///   - taker payment ciphertext -> maker's confidential balance
    ///   - escrow ciphertext -> taker's confidential balance
    function finalizeFill(uint256 id, address taker) external override {
        require(msg.sender == gateway, "only gateway");
        Order storage o = orders[id];
        require(!o.filled && !o.cancelled, "closed");
        require(block.timestamp <= o.deadline, "expired");

        o.filled = true;
        emit OrderFinalized(id, taker);

        // Note: optionally, the gateway could provide attestations proving these confidential transfers
        // If you want the contract to call token confidentialTransferTo(...) to reflect movement on-chain,
        // you can add such token calls here — but in many FHEVM deployments, the gateway's storage is the
        // source of truth for ciphertext ownership and an on-chain call is not necessary.
    }

    // ----------------------
    // Maker: reveal terms (optional)
    // ----------------------
    function revealTerms(uint256 id) external override {
        Order storage o = orders[id];
        require(o.maker == msg.sender, "only maker");
        require(o.filled || o.cancelled, "only after close");

        FHE.makePubliclyDecryptable(o.amountInEnc);
        FHE.makePubliclyDecryptable(o.amountOutEnc);
        FHE.makePubliclyDecryptable(o.takerEnc);

        emit TermsRevealed(id);
    }

    // ----------------------
    // Helpers / admin
    // ----------------------
    function isOpen(uint256 id) external view override returns (bool) {
        Order storage o = orders[id];
        return (!o.filled && !o.cancelled && block.timestamp <= o.deadline);
    }

    /// Only current gateway can rotate gateway address (replace with multisig in production)
    function setGateway(address _gateway) external {
        require(msg.sender == gateway, "only gateway");
        require(_gateway != address(0), "gateway=0");
        gateway = _gateway;
    }
}
