export const OTC_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_gateway",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "taker",
                "type": "address"
            }
        ],
        "name": "FillRequested",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "OrderCancelled",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "maker",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "address",
                "name": "tokenIn",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "address",
                "name": "tokenOut",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint64",
                "name": "deadline",
                "type": "uint64"
            }
        ],
        "name": "OrderCreated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "taker",
                "type": "address"
            }
        ],
        "name": "OrderFinalized",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "TermsRevealed",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "cancelOrder",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "tokenIn",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "tokenOut",
                "type": "address"
            },
            {
                "internalType": "externalEuint64",
                "name": "amountInExt",
                "type": "bytes32"
            },
            {
                "internalType": "externalEuint64",
                "name": "amountOutExt",
                "type": "bytes32"
            },
            {
                "internalType": "externalEaddress",
                "name": "maybeTakerExt",
                "type": "bytes32"
            },
            {
                "internalType": "bytes",
                "name": "attestation",
                "type": "bytes"
            },
            {
                "internalType": "uint64",
                "name": "deadline",
                "type": "uint64"
            },
            {
                "internalType": "bool",
                "name": "doTransferOut",
                "type": "bool"
            }
        ],
        "name": "createOrder",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "internalType": "externalEuint64",
                "name": "takerPayExt",
                "type": "bytes32"
            },
            {
                "internalType": "bytes",
                "name": "attestation",
                "type": "bytes"
            },
            {
                "internalType": "bool",
                "name": "doTransferIn",
                "type": "bool"
            }
        ],
        "name": "fillOrder",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "taker",
                "type": "address"
            }
        ],
        "name": "finalizeFill",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "gateway",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "isOpen",
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
    {
        "inputs": [],
        "name": "nextOrderId",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "orders",
        "outputs": [
            {
                "internalType": "address",
                "name": "maker",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "tokenIn",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "tokenOut",
                "type": "address"
            },
            {
                "internalType": "euint64",
                "name": "amountInEnc",
                "type": "bytes32"
            },
            {
                "internalType": "euint64",
                "name": "amountOutEnc",
                "type": "bytes32"
            },
            {
                "internalType": "eaddress",
                "name": "takerEnc",
                "type": "bytes32"
            },
            {
                "internalType": "uint64",
                "name": "deadline",
                "type": "uint64"
            },
            {
                "internalType": "bool",
                "name": "filled",
                "type": "bool"
            },
            {
                "internalType": "bool",
                "name": "cancelled",
                "type": "bool"
            },
            {
                "internalType": "euint64",
                "name": "takerPayEnc",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "revealTerms",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_gateway",
                "type": "address"
            }
        ],
        "name": "setGateway",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;
