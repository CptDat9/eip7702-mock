import { http, createPublicClient } from "viem";
import { base, sepolia } from "viem/chains";

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL as string),
});
export const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL as string),
});