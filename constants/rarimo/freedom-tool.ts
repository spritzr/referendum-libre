/**
 * Shared FreedomTool instantiation. The SDK class is dynamically imported so
 * its native deps aren't pulled into bundles that never touch voting.
 *
 * Always rebuild — don't cache an instance across calls/renders. A prior
 * version of the home-screen cached the instance in a ref, which raced with
 * the network-flip effect at mount time and left a stale testnet FreedomTool
 * servicing mainnet proposal-id requests, returning testnet's #47 bytes for
 * mainnet's #47 lookup. Instantiation is cheap, so the per-call rebuild is
 * the accepted tradeoff.
 */

import { getFreedomToolConfig, type Network } from './config';

export async function createFreedomTool(network: Network) {
  const { FreedomTool } = await import('@rarimo/rarime-rn-sdk');
  return new FreedomTool(getFreedomToolConfig(network));
}
