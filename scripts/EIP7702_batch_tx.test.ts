import {
    Hex, concatHex, numberToHex, encodeFunctionData, keccak256, serializeTransaction,
    TransactionSerializableEIP7702
} from "viem";
import { sepolia } from "viem/chains";
import { publicClient } from "./client";
import { privateKeyToAccount, sign } from "viem/accounts";
import "dotenv/config";
const MOCKTEST_ADDR: Hex = "0x0eeC4608D4b713202b28009B4B0cA3A0e376B16C"; // sepolia
const MOCKTEST_ABI = [
    {
        "inputs": [],
        "name": "getValue",
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
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "increaseValue",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
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
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "setValue",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "value",
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
                "components": [
                    { "internalType": "address", "name": "to", "type": "address" },
                    { "internalType": "uint256", "name": "value", "type": "uint256" },
                    { "internalType": "bytes", "name": "data", "type": "bytes" }
                ],
                "internalType": "struct MockTest.Call[]",
                "name": "calls",
                "type": "tuple[]"
            }
        ],
        "name": "excuteCall",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
] as const;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function main() {
    const EOA_PRIV = process.env.PAY_FROM_PRIV_KEY as Hex;
    const RELAY_PRIV = process.env.RELAY_PRIV_KEY as Hex;
    if (!EOA_PRIV || !RELAY_PRIV) throw new Error("Thiếu PAY_FROM_PRIV_KEY hoặc RELAY_PRIV_KEY trong .env");

    const eoaAccount = privateKeyToAccount(EOA_PRIV);
    const relayAccount = privateKeyToAccount(RELAY_PRIV);

    // === Nonces ===
    const eoaNonce = await publicClient.getTransactionCount({ address: eoaAccount.address });
    const relayNonce = await publicClient.getTransactionCount({ address: relayAccount.address });

    // === Authorization ===
    const rlpPayload = [numberToHex(sepolia.id), MOCKTEST_ADDR, numberToHex(eoaNonce)];
    const { toRlp } = await import("viem");
    const message = concatHex(["0x05", toRlp(rlpPayload)]);
    const authHash = keccak256(message);
    const authSig = await sign({ hash: authHash, privateKey: EOA_PRIV });

    console.log("Authorization ký từ:", eoaAccount.address);
    /* encode */
    const callSet = encodeFunctionData({
        abi: MOCKTEST_ABI,
        functionName: "setValue",
        args: [8n],
    });
    const callInc = encodeFunctionData({
        abi: MOCKTEST_ABI,
        functionName: "increaseValue",
        args: [1n],
    });
    const calls = [
        { to: MOCKTEST_ADDR, value: 0n, data: callSet },
        { to: MOCKTEST_ADDR, value: 0n, data: callInc },
    ];
    // encode multicall
    const batchData = encodeFunctionData({
        abi: MOCKTEST_ABI,
        functionName: "excuteCall",
        args: [calls],
    });


    // === Estimate gas ===
    let gasLimit = await publicClient.estimateContractGas({
        account: relayAccount.address,
        address: MOCKTEST_ADDR,
        abi: MOCKTEST_ABI,
        functionName: "excuteCall",
        args: [calls],
    });
    gasLimit += 80_000n;

    const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

    const tx: TransactionSerializableEIP7702 = {
        type: "eip7702",
        chainId: sepolia.id,
        nonce: relayNonce,
        to: MOCKTEST_ADDR,
        gas: gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasPrice: undefined,
        maxFeePerBlobGas: undefined,
        value: 0n,
        data: batchData,
        authorizationList: [
            {
                address: MOCKTEST_ADDR,
                chainId: sepolia.id,
                nonce: eoaNonce,
                r: authSig.r,
                s: authSig.s,
                v: authSig.v,
                yParity: authSig.yParity!,
            },
        ],
    };

    const unsignedSerialized = serializeTransaction(tx);
    const txHash = keccak256(unsignedSerialized);

    const relaySig = await sign({ hash: txHash, privateKey: RELAY_PRIV });
    const signedTx: Hex = serializeTransaction({
        ...tx,
        r: relaySig.r,
        s: relaySig.s,
        v: relaySig.v,
    });

    console.log("RawTx:", signedTx);

    const sentHash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx });
    await publicClient.waitForTransactionReceipt({ hash: sentHash });

    console.log("Tx hash:", sentHash);
    await sleep(15_000);
    const value = await publicClient.readContract({
        address: MOCKTEST_ADDR,
        abi: MOCKTEST_ABI,
        functionName: "getValue",
    });
    console.log("MockTest.value =", value.toString());
}

main().catch((err) => {
    console.error("Lỗi:", err);
    process.exit(1);
});
