import { ethers } from "hardhat";
import * as rlp from "rlp";
import { PAY_FROM_PRIV_KEY, EIP7702 } from "./utils/helper";

// const MOCKTEST_ADDR = "0x1f7d70f411C29D83Fd8F7816A0626fC72eA59DaB"; //bscTestnet
const MOCKTEST_ADDR = "0x571D806987bB6579d80002d49274d25A216c31da"; // sepolia

const MOCKTEST_ABI = [
    "function setValue(uint256 _value) external",
    "function getValue() external view returns (uint256)",
];
function encodeUint(value: bigint | number) {
    return ethers.stripZerosLeft(ethers.toBeHex(value)); /* Theo RLP rule, các số nguyên phải ở dạng tối giản, không được có byte 0x00 ở đầu. */
}
function encodeAddress(addr: string) {
    return ethers.getBytes(ethers.getAddress(addr)); // chuẩn hóa, luôn 20 bytes
}
function buildAuthHash(chainId: number, contract: string, nonce: bigint) {
    const rlpPayload = rlp.encode([
        ethers.toBeHex(chainId),
        contract,
        ethers.toBeHex(nonce),
    ]);
    const message = ethers.concat([EIP7702.MAGIC, rlpPayload]);
    return ethers.keccak256(message);
}

async function main() {
    const eoaWallet = new ethers.Wallet(PAY_FROM_PRIV_KEY, ethers.provider);
    const relayPrivKey = process.env.RELAY_PRIV_KEY;
    if (!relayPrivKey) throw new Error("Thiếu RELAY_PRIV_KEY trong .env");
    const relayWallet = new ethers.Wallet(relayPrivKey, ethers.provider);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const eoaNonce = await ethers.provider.getTransactionCount(eoaWallet.address);
    const relayNonce = await ethers.provider.getTransactionCount(relayWallet.address);

    console.log("EOA:", eoaWallet.address, "Nonce:", eoaNonce);
    console.log("Relay:", relayWallet.address, "Nonce:", relayNonce);
    // ----- Auth hash + chữ ký -----
    const authHash = buildAuthHash(Number(chainId), MOCKTEST_ADDR, BigInt(eoaNonce));
    const sig = eoaWallet.signingKey.sign(authHash);
    const yParity = sig.v - 27;
    const recovered = ethers.recoverAddress(authHash, sig);
    if (recovered.toLowerCase() !== eoaWallet.address.toLowerCase()) {
        throw new Error("Signature verification failed");
    }
    console.log("Authorization ký thành công từ:", recovered);
    // ----- Encode call -----
    const mock = new ethers.Contract(MOCKTEST_ADDR, MOCKTEST_ABI, relayWallet);
    const data = mock.interface.encodeFunctionData("setValue", [1234]);
    let gasEstimate = await mock.setValue.estimateGas(1234);
    gasEstimate += 30_000n;

    const { maxFeePerGas, maxPriorityFeePerGas } = await ethers.provider.getFeeData();
    const authorization = {
        authority: MOCKTEST_ADDR,
        chainId,
        nonce: eoaNonce,
        yParity,
        r: sig.r,
        s: sig.s,
    };
    // ----- Tx fields (chưa ký) -----
    const txFields = [
        encodeUint(chainId),
        encodeUint(relayNonce),
        maxPriorityFeePerGas ? encodeUint(maxPriorityFeePerGas) : "0x",
        maxFeePerGas ? encodeUint(maxFeePerGas) : "0x",
        encodeUint(gasEstimate),
        encodeAddress(MOCKTEST_ADDR), // to
        "0x",                         // value
        data,                         // calldata
        [],                           // accessList
        [[
            encodeAddress(authorization.authority),
            encodeUint(chainId),
            encodeUint(eoaNonce),
            encodeUint(yParity),
            ethers.zeroPadValue(sig.r, 32),           // chuẩn hóa 32 bytes
            ethers.zeroPadValue(sig.s, 32),
        ]],
    ];
    const unsignedSerialized = ethers.concat(["0x04", rlp.encode(txFields)]);
    const txHash = ethers.keccak256(unsignedSerialized);

    // ----- Relay ký tx -----
    const relaySig = relayWallet.signingKey.sign(txHash);
    const signedTxFields = [
        ...txFields,
        ethers.toBeHex(relaySig.v - 27),
        relaySig.r,
        relaySig.s,
    ];
    const signedSerialized = ethers.concat(["0x04", rlp.encode(signedTxFields)]);
    const rawTx = ethers.hexlify(signedSerialized);

    console.log("RawTx:", rawTx);

    // ----- Gửi tx -----
    const txHashResp = await ethers.provider.send("eth_sendRawTransaction", [rawTx]);
    console.log("Tx hash:", txHashResp);
    const value = await mock.getValue();
    console.log("MockTest.value =", value.toString());
}

main().catch((err) => {
    console.error("Lỗi:", err);
    process.exitCode = 1;
});
