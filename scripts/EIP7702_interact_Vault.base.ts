import {
  Abi, Hex, encodeFunctionData, keccak256, serializeTransaction,
  TransactionSerializableEIP7702
} from "viem";
import { base } from "viem/chains";
import { baseClient } from "./client";
import { privateKeyToAccount, sign } from "viem/accounts";
import "dotenv/config";

import USDC_JSON from "./abi/USDC.json";
import USDC_BASE_VAULT_ARTIFACT from "./abi/USDC_Omni_Vault_BASE.json";
import MULTICALL_HELPER_ARTIFACT from "./abi/MulticallHelper.json";

const USDC_ABI = USDC_JSON as Abi;
const USDC_BASE_VAULT_ABI = USDC_BASE_VAULT_ARTIFACT.abi as Abi;
const MulticallHelperABI = MULTICALL_HELPER_ARTIFACT.abi as Abi;

const MULTICALL_HELPER: Hex = "0x79F76759252480EC87A102F333516C34A8146B0d";
const THORN_USDC_BASE_VAULT: Hex = "0x2669DfA1D91c1dF9fe51DEAC6E5369C7D43242a8";
const USDC_BASE: Hex = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function encodeAuthMessage(chainId: number, address: Hex, nonce: bigint) {
  // EIP-7702 auth hash = keccak256(abi.encode(chainId, address, nonce))
  // spec chuẩn hơn có thêm domain separation, đây là simplified demo
  return keccak256(
    `0x${chainId.toString(16).padStart(64, "0")}${address.slice(2).padStart(64, "0")}${nonce.toString(16).padStart(64, "0")}`
  );
}

async function main() {
  const EOA_PRIV = process.env.PAY_FROM_PRIV_KEY as Hex;
  const RELAY_PRIV = process.env.RELAY_PRIV_KEY as Hex;
  if (!EOA_PRIV || !RELAY_PRIV) throw new Error("Thiếu PAY_FROM_PRIV_KEY hoặc RELAY_PRIV_KEY trong .env");

  const eoaAccount = privateKeyToAccount(EOA_PRIV);
  const relayAccount = privateKeyToAccount(RELAY_PRIV);

  const relayNonce = await baseClient.getTransactionCount({ address: relayAccount.address});
  const eoaNonce = await baseClient.getTransactionCount({ address: eoaAccount.address });
  console.log("EOA:", eoaAccount.address);
  console.log("Relay:", relayAccount.address, "Nonce:", relayNonce);

  // --- calls ---
  const approveCall = {
    to: USDC_BASE,
    value: 0n,
    data: encodeFunctionData({
      abi: USDC_ABI,
      functionName: "approve",
      args: [THORN_USDC_BASE_VAULT, 10_000n],
    }),
  };

  const depositCall = {
    to: THORN_USDC_BASE_VAULT,
    value: 0n,
    data: encodeFunctionData({
      abi: USDC_BASE_VAULT_ABI,
      functionName: "deposit",
      args: [10_000n, eoaAccount.address],
    }),
  };

  const multicallData = encodeFunctionData({
    abi: MulticallHelperABI,
    functionName: "execute",
    args: [[approveCall, depositCall]],
  });

  // --- gas estimate (as EOA) ---
  let gasLimitBatch = await baseClient.estimateContractGas({
    account: eoaAccount.address,
    address: MULTICALL_HELPER,
    abi: MulticallHelperABI,
    functionName: "execute",
    args: [[approveCall, depositCall]],
  });
  gasLimitBatch += 50_000n;

  const { maxFeePerGas, maxPriorityFeePerGas } = await baseClient.estimateFeesPerGas();
  const authMsgHash = encodeAuthMessage(base.id, eoaAccount.address as Hex, BigInt(eoaNonce));
  const authSig = await sign({ hash: authMsgHash, privateKey: EOA_PRIV });

  const batchTx: TransactionSerializableEIP7702 = {
    type: "eip7702",
    chainId: base.id,
    nonce: relayNonce,
    to: MULTICALL_HELPER,
    gas: gasLimitBatch,
    maxFeePerGas,
    maxPriorityFeePerGas,
    value: 0n,
    data: multicallData,
    authorizationList: [
      {
        address: eoaAccount.address,
        chainId: base.id,
        nonce: eoaNonce,
        r: authSig.r,
        s: authSig.s,
        yParity: authSig.yParity!,
      },
    ],
  };

  // --- Step3: Relay signs tx ---
    const unsignedSerialized = serializeTransaction(batchTx);
  const txHash = keccak256(unsignedSerialized);
const relaySig = await sign({ hash: txHash, privateKey: RELAY_PRIV });
  const signedBatchTx: Hex = serializeTransaction({
    ...batchTx,
    r: relaySig.r,
    s: relaySig.s,
    v: relaySig.v,
  });
  console.log("RawTx:", signedBatchTx);

  // --- send ---
  const sentBatchHash = await baseClient.sendRawTransaction({ serializedTransaction: signedBatchTx });
  console.log("Batch tx sent:", sentBatchHash);

  await baseClient.waitForTransactionReceipt({ hash: sentBatchHash });
  console.log("Approve + Deposit done in 1 tx!");
}

main().catch(err => {
  console.error("Lỗi:", err);
  process.exit(1);
});
