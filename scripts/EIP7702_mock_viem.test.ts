import { Hex, concatHex, numberToHex, encodeFunctionData, keccak256, serializeTransaction, TransactionSerializableEIP7702 } from "viem";
import { sepolia } from "viem/chains";
import { publicClient } from "./client"; 
import { privateKeyToAccount, sign } from "viem/accounts";
import "dotenv/config";

const MOCKTEST_ADDR: Hex = "0x571D806987bB6579d80002d49274d25A216c31da"; //sepolia

const MOCKTEST_ABI = [
  {
    inputs: [{ name: "_value", type: "uint256" }],
    name: "setValue",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getValue",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  // === Load account ===
  const EOA_PRIV = process.env.PAY_FROM_PRIV_KEY as Hex;
  const RELAY_PRIV = process.env.RELAY_PRIV_KEY as Hex;
  if (!EOA_PRIV || !RELAY_PRIV) throw new Error("Thiếu PAY_FROM_PRIV_KEY hoặc RELAY_PRIV_KEY trong .env");

  const eoaAccount = privateKeyToAccount(EOA_PRIV);
  const relayAccount = privateKeyToAccount(RELAY_PRIV);

  // === Nonces ===
  const eoaNonce = await publicClient.getTransactionCount({ address: eoaAccount.address });
  const relayNonce = await publicClient.getTransactionCount({ address: relayAccount.address });
  console.log("EOA:", eoaAccount.address, "Nonce:", eoaNonce);
  console.log("Relay:", relayAccount.address, "Nonce:", relayNonce);

  // === Build & sign Authorization message ===
  const rlpPayload = [numberToHex(sepolia.id), MOCKTEST_ADDR, numberToHex(eoaNonce)];
  const message = concatHex(["0x05", (await import("viem")).toRlp(rlpPayload)]); // 0x05 = MAGIC
  const authHash = keccak256(message);
  const authSig = await sign({ hash: authHash, privateKey: EOA_PRIV });

  console.log("Authorization ký thành công từ:", eoaAccount.address);

  let gasLimit = await publicClient.estimateContractGas({
    account: relayAccount.address,
    address: MOCKTEST_ADDR,
    abi: MOCKTEST_ABI,
    functionName: "setValue",
    args: [1234n],
  });
  gasLimit += 30_000n; // overhead cho authorization payload

  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

  // === Tx chưa ký ===
  const tx: TransactionSerializableEIP7702 = {
    type: "eip7702",
    chainId: sepolia.id,
    nonce: relayNonce,
    to: eoaAccount.address, /*  tx gui toi EOA, EOA chi ki off chain */
    gas: gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    value: 0n,
    data: encodeFunctionData({
      abi: MOCKTEST_ABI,
      functionName: "setValue",
      args: [1234n],
    }),
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
  console.log("Tx hash:", sentHash);

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
