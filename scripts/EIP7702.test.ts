import { ethers } from "hardhat";
import * as rlp from "rlp";
import SwapRouterABI from "./abi/SwapRouter.json";
import { PAY_FROM_PRIV_KEY, PAY_FROM_ADDRESS, EIP7702 } from "./utils/helper";

function buildAuthHash(chainId: number, contract: string, nonce: bigint) {
    const rlpPayload = rlp.encode([
        ethers.toBeHex(chainId),
        contract,
        ethers.toBeHex(nonce),
    ]);
    const message = ethers.concat([EIP7702.MAGIC, rlpPayload]);
    return ethers.keccak256(message);
}


const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481"; // Uniswap V3 SwapRouter

// const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
// const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
// const SWAP_ROUTER = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";
const WETH_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
];

const SWAP_ROUTER_ABI = SwapRouterABI;
async function main() {
    const eoaWallet = new ethers.Wallet(PAY_FROM_PRIV_KEY, ethers.provider);
    const EOA_ADDRESS = eoaWallet.address; // Nên khớp với PAY_FROM_ADDRESS
    const relayPrivKey = process.env.RELAY_PRIV_KEY;
    if (!relayPrivKey) throw new Error("Missing RELAY_PRIV_KEY in .env");
    const relayWallet = new ethers.Wallet(relayPrivKey, ethers.provider);
    const RELAY_ADDRESS = relayWallet.address;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const eoaNonce = await ethers.provider.getTransactionCount(EOA_ADDRESS);
    const relayNonce = await ethers.provider.getTransactionCount(RELAY_ADDRESS);

    console.log("EOA:", EOA_ADDRESS);
    console.log("EOA Nonce:", eoaNonce);
    console.log("Relay:", RELAY_ADDRESS);
    console.log("Relay Nonce:", relayNonce);
    const weth = await ethers.getContractAt(WETH_ABI, WETH);
    const relayWethBal = await weth.balanceOf(RELAY_ADDRESS);
    console.log("Relay WETH Balance:", ethers.formatEther(relayWethBal));
    //   if (relayWethBal.lt(ethers.parseEther("0.001"))) {
    //     throw new Error("Relay không đủ WETH. Cần ít nhất 0.001 WETH.");
    //   }

    // Cấp phép WETH cho SwapRouter từ Relay
    console.log("Approving WETH for SwapRouter...");
    const approveTx = await weth
        .connect(relayWallet)
        .approve(SWAP_ROUTER, ethers.parseEther("0.001"));
    await approveTx.wait();
    console.log("Approval successful.");

    const authHash = buildAuthHash(Number(chainId), SWAP_ROUTER, BigInt(eoaNonce));
    const eoaSigningKey = eoaWallet.signingKey;
    const sig = eoaWallet.signingKey.sign(authHash);
    const v = sig.v;
    const r = sig.r;
    const s = sig.s;
    const yParity = v - 27; // yParity 0 or 1
    const recovered = ethers.recoverAddress(authHash, { r, s, v });
    if (recovered.toLowerCase() !== EOA_ADDRESS.toLowerCase()) {
        throw new Error("Signature verification failed");
    }
    console.log("Recovered Address:", recovered);
    const routerInterface = new ethers.Interface(SWAP_ROUTER_ABI);
    const swapParams = {
        tokenIn: WETH,
        tokenOut: USDC,
        fee: 500,
        recipient: EOA_ADDRESS,
        deadline: Math.floor(Date.now() / 1000) + 60 * 30, // 30 phút
        amountIn: ethers.parseEther("0.001"),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
    };
    const data = routerInterface.encodeFunctionData("exactInputSingle", [swapParams]);
    const router = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, relayWallet);
    let gasEstimate;
    try {
        gasEstimate = await router.exactInputSingle.estimateGas(swapParams);
    } catch (error) {
        console.error("Gas estimation failed:", error);
        throw error;
    }
    gasEstimate = gasEstimate + 30_000n; // BigInt
    console.log("Estimated Gas:", gasEstimate.toString());
    const feeData = await ethers.provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    const authorization = {
        authority: SWAP_ROUTER,
        chainId: ethers.toBeHex(chainId),
        nonce: ethers.toBeHex(eoaNonce),
        yParity: ethers.toBeHex(yParity),
        r,
        s,
    };

    // Authorization list RLP
    const authListRlp = rlp.encode([
        rlp.encode([
            authorization.authority,
            authorization.chainId,
            authorization.nonce,
            authorization.yParity,
            authorization.r,
            authorization.s,
        ]),
    ]);

    // Tx fields cho EIP-7702 (type 0x04)
    const txFields = [
        ethers.toBeHex(chainId),
        ethers.toBeHex(relayNonce),
        maxPriorityFeePerGas ? ethers.toBeHex(maxPriorityFeePerGas) : "0x",
        maxFeePerGas ? ethers.toBeHex(maxFeePerGas) : "0x",
        ethers.toBeHex(gasEstimate),
        EOA_ADDRESS, // to
        "0x", // value 0
        data, // data
        [], // accessList (empty)
        ethers.hexlify(authListRlp), // authorizationList
    ];

    // Serialize unsigned tx: 0x04 || rlp(fields)
    const unsignedSerialized = ethers.concat(["0x04", rlp.encode(txFields)]);
    const txHash = ethers.keccak256(unsignedSerialized);
    const relaySigningKey = relayWallet.signingKey;
    const relayerSig = relaySigningKey.sign(txHash);
    const relayerV = relayerSig.v;
    const relayerR = relayerSig.r;
    const relayerS = relayerSig.s;
    const signedTxFields = [
        ...txFields,
        ethers.toBeHex(relayerV - 27), // yParity
        relayerR,
        relayerS,
    ];
    const signedSerialized = ethers.concat(["0x04", rlp.encode(signedTxFields)]);
    console.log("Signed Tx (hex):", signedSerialized);
    const rawTxHex = ethers.hexlify(signedSerialized);
    console.log("RawTxHex:", rawTxHex.startsWith("0x")); // true
    const txResponse = await ethers.provider.broadcastTransaction(rawTxHex);
    // const txResponse = await ethers.provider.send("eth_sendRawTransaction", [rawTxHex]);
    console.log("Tx hash:", txResponse.hash);
    console.log("Done.");
}

main().catch((error) => {
    console.error("Lỗi:", error);
    process.exitCode = 1;
});