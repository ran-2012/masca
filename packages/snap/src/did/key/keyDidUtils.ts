import { base58btc } from 'multiformats/bases/base58';

import { SSISnapState } from '../../interfaces';
import { addMulticodecPrefix } from '../../utils/formatUtils';
import { getCompressedPublicKey } from '../../utils/snapUtils';

export function getDidKeyIdentifier(
  state: SSISnapState,
  account: string
): string {
  const compressedKey = getCompressedPublicKey(
    state.accountState[account].publicKey
  );

  return Buffer.from(
    base58btc.encode(
      addMulticodecPrefix('secp256k1-pub', Buffer.from(compressedKey, 'hex'))
    )
  ).toString();
}
