// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, externalEuint64, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC7984} from "https://github.com/OpenZeppelin/openzeppelin-confidential-contracts/blob/master/contracts/token/ERC7984/ERC7984.sol";

contract ERC7984MintableBurnable is ERC7984, Ownable {
    using FHE for *;

    constructor(
        address owner,
        string memory name,
        string memory symbol,
        string memory uri
    ) ERC7984(name, symbol, uri) Ownable(owner) {}

    function mint(address to, externalEuint64 amount, bytes memory inputProof) public onlyOwner {
        _mint(to, amount.fromExternal(inputProof));
    }

    function burn(address from, externalEuint64 amount, bytes memory inputProof) public onlyOwner {
        _burn(from, amount.fromExternal(inputProof));
    }
}