import { privateKeyToAccount } from "viem/accounts";
import { hexToBytes, keccak256, numberToHex, concatHex, toRlp } from "viem";

const PAY_FROM_PRIV_KEY = process.env.PAY_FROM_PRIV_KEY!;
if (!PAY_FROM_PRIV_KEY) throw new Error("Missing PAY_FROM_PRIV_KEY in .env");
const account = privateKeyToAccount(PAY_FROM_PRIV_KEY);
const PAY_FROM_ADDRESS = account.address;

const EIP7702 = {
  MAGIC: "0x05" as const,
  TX_TYPE: 0x04,
};

// Build hash cho authList (chuẩn 7702)
function buildAuthHash(chainId: number, contract: string, nonce: number | bigint) {
  const rlpPayload = toRlp([
    numberToHex(chainId),
    contract,
    nonce ? numberToHex(nonce) : "0x",
  ]);
  const message = concatHex([EIP7702.MAGIC, rlpPayload]);
  return keccak256(message);
}

export {
  PAY_FROM_PRIV_KEY,
  PAY_FROM_ADDRESS,
  EIP7702,
  buildAuthHash,
};
