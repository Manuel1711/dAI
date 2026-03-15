import type { Erc8004Manifest } from '@/types/erc8004/schema';

/**
 * Placeholder loader for ERC8004 data bundle.
 *
 * TODO:
 * - load manifest from canonical data path
 * - validate against schema
 * - normalize for UI consumption
 */
export async function loadErc8004Manifest(): Promise<Erc8004Manifest | null> {
  return null;
}
