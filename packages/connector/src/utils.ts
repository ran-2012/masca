import type { CreateCredentialRequestParams } from '@blockchain-lab-um/masca-types';
import { isError } from '@blockchain-lab-um/utils';
import { EthereumWebAuth, getAccountId } from '@didtools/pkh-ethereum';
import type {
  UnsignedCredential,
  UnsignedPresentation,
  VerifiableCredential,
  VerifiablePresentation,
} from '@veramo/core';
import { DIDSession } from 'did-session';
import { getEthTypesFromInputDoc } from 'eip-712-types-generation';

import type { Masca } from './snap.js';

/**
 * Function to check if there is a valid Ceramic session in Masca.
 * If not, it will try to get a new session from the user.
 * @param this - Masca instance
 */
export async function validateAndSetCeramicSession(this: Masca): Promise<void> {
  // Check if there is valid session in Masca
  const api = this.getMascaApi();

  const enabledCredentialStoresResult = await api.getCredentialStore();
  if (isError(enabledCredentialStoresResult)) {
    throw new Error('Failed to get enabled VC stores.');
  }

  // Check if ceramic is enabled
  if (enabledCredentialStoresResult.data.ceramic === false) {
    return;
  }

  const session = await api.validateStoredCeramicSession();
  if (!isError(session)) {
    return;
  }

  const provider = this.providerStore.getCurrentProvider()?.provider;
  if (!provider) {
    throw new Error('No provider found');
  }

  const addresses: string[] = await provider.request({
    method: 'eth_requestAccounts',
  });

  const accountId = await getAccountId(provider, addresses[0]);

  const authMethod = await EthereumWebAuth.getAuthMethod(provider, accountId);

  let newSession;
  try {
    newSession = await DIDSession.authorize(authMethod, {
      expiresInSecs: 60 * 60 * 24 * 7,
      resources: ['ceramic://*'],
    });
  } catch (e) {
    throw new Error('User failed to sign session.');
  }
  const serializedSession = newSession.serialize();
  const result = await api.setCeramicSession(serializedSession);
  if (isError(result)) {
    throw new Error('Failed to set session in Masca.');
  }
}

/**
 * Function to sign a Verifiable Presentation with EIP712Signature proof format
 * @param presentation - Unsigned Verifiable Presentation
 * @returns Signed Verifiable Presentation
 */
export async function signVerifiablePresentation(
  this: Masca,
  presentation: UnsignedPresentation
): Promise<VerifiablePresentation> {
  const provider = this.providerStore.getCurrentProvider()?.provider;
  if (!provider) throw new Error('No provider found');
  const addresses: `0x${string}`[] = await provider.request({
    method: 'eth_requestAccounts',
  });

  if (
    !presentation.holder.includes(addresses[0]) &&
    !presentation.holder.includes(
      await this.viemClient.getEns({ address: addresses[0] })
    )
  ) {
    throw new Error('Wrong holder');
  }
  const chainId = Number.parseInt(
    await provider.request({ method: 'eth_chainId' }),
    16
  );
  presentation.proof = {
    verificationMethod: `${presentation.holder}#controller`,
    created: presentation.issuanceDate,
    proofPurpose: 'assertionMethod',
    type: 'EthereumEip712Signature2021',
  };

  const message = presentation;

  const domain = {
    chainId,
    name: 'VerifiablePresentation',
    version: '1',
  };

  const primaryType = 'VerifiablePresentation';
  const types = getEthTypesFromInputDoc(presentation, primaryType);

  const data = JSON.stringify({ domain, types, message, primaryType });

  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [addresses[0] as any as `0x${string}`, data],
  });

  presentation.proof.proofValue = signature;

  presentation.proof.eip712 = {
    domain,
    types,
    primaryType,
  };

  return presentation as VerifiablePresentation;
}

/**
 * Function to sign a Verifiable Credential with EIP712Signature proof format
 * @param this - Masca instance
 * @param credential - Unsigned Verifiable Credential
 * @param params - Request params
 * @returns Signed Verifiable Credential
 */
export async function signVerifiableCredential(
  this: Masca,
  credential: UnsignedCredential,
  params: CreateCredentialRequestParams
): Promise<VerifiableCredential> {
  const provider = this.providerStore.getCurrentProvider()?.provider;
  if (!provider) throw new Error('No provider found');
  const addresses: string[] = await provider.request({
    method: 'eth_requestAccounts',
  });

  let issuer = '';
  if (typeof credential.issuer === 'string') {
    issuer = credential.issuer;
  } else {
    issuer = credential.issuer.id;
  }

  if (
    !issuer.includes(addresses[0]) &&
    !issuer.includes(
      await this.viemClient.getEns({ address: addresses[0] as `0x${string}` })
    )
  ) {
    throw new Error('Invalid Issuer');
  }

  const chainId = Number.parseInt(
    await provider.request({ method: 'eth_chainId' }),
    16
  );
  credential.proof = {
    verificationMethod: `${issuer}#controller`,
    created: credential.issuanceDate,
    proofPurpose: 'assertionMethod',
    type: 'EthereumEip712Signature2021',
  };

  const message = credential;

  const domain = {
    chainId,
    name: 'VerifiableCredential',
    version: '1',
  };

  const primaryType = 'VerifiableCredential';
  const allTypes = getEthTypesFromInputDoc(credential, primaryType);
  const types = { ...allTypes };

  const data = JSON.stringify({ domain, types, message, primaryType });

  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [addresses[0] as any as `0x${string}`, data],
  });

  credential.proof.proofValue = signature;

  credential.proof.eip712 = {
    domain,
    types: allTypes,
    primaryType,
  };

  if (params.options?.save) {
    const api = this.getMascaApi();
    const result = await api.saveCredential(
      credential as VerifiableCredential,
      {
        store: params.options.store,
      }
    );
    if (isError(result)) {
      throw new Error('Failed to save VC in Masca.');
    }
  }

  return credential as VerifiableCredential;
}
