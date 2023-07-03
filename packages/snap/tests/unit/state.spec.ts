import { MetaMaskInpageProvider } from '@metamask/providers';
import type { SnapsGlobalObject } from '@metamask/snaps-types';

import { getInitialSnapState } from '../../src/utils/config';
import {
  getSnapState,
  getSnapStateUnchecked,
  initAccountState,
  initSnapState,
  updateSnapState,
} from '../../src/utils/stateUtils';
import { account } from '../data/constants';
import { getDefaultSnapState } from '../data/defaultSnapState';
import { createMockSnap, SnapMock } from '../helpers/snapMock';

describe('Utils [state]', () => {
  let snapMock: SnapsGlobalObject & SnapMock;
  let ethereumMock: MetaMaskInpageProvider;

  beforeEach(() => {
    snapMock = createMockSnap();
    snapMock.rpcMocks.snap_manageState({
      operation: 'update',
      newState: getDefaultSnapState(account),
    });
    ethereumMock = snapMock as unknown as MetaMaskInpageProvider;
  });

  describe('updateSnapState', () => {
    it('should succeed updating snap state with default state', async () => {
      const initialState = getDefaultSnapState(account);

      await expect(
        updateSnapState(snapMock, initialState)
      ).resolves.not.toThrow();

      expect(snapMock.rpcMocks.snap_manageState).toHaveBeenCalledWith({
        operation: 'update',
        newState: initialState,
      });

      expect.assertions(2);
    });

    it('should succeed updating snap state with empty state', async () => {
      const emptyState = {};

      await expect(
        updateSnapState(snapMock, emptyState as any)
      ).resolves.not.toThrow();

      expect(snapMock.rpcMocks.snap_manageState).toHaveBeenCalledWith({
        operation: 'update',
        newState: emptyState,
      });

      expect.assertions(2);
    });
  });

  describe('getSnapState', () => {
    it('should fail and throw not initialized error', async () => {
      snapMock.rpcMocks.snap_manageState({
        operation: 'clear',
      });

      await expect(getSnapState(snapMock)).rejects.toThrow(
        new Error('MascaState is not initialized!')
      );

      expect.assertions(1);
    });

    it('should succeed getting initial snap state', async () => {
      const initialState = getDefaultSnapState(account);

      await expect(getSnapState(snapMock)).resolves.toEqual(initialState);

      expect.assertions(1);
    });
  });

  describe('getSnapStateUnchecked', () => {
    it('should return null if state is not initialized', async () => {
      snapMock.rpcMocks.snap_manageState({
        operation: 'clear',
      });

      await expect(getSnapStateUnchecked(snapMock)).resolves.toBeNull();

      expect.assertions(1);
    });

    it('should succeed getting initial snap state', async () => {
      const initialState = getDefaultSnapState(account);

      await expect(getSnapStateUnchecked(snapMock)).resolves.toEqual(
        initialState
      );

      expect.assertions(1);
    });
  });

  describe('initSnapState', () => {
    it('should succeed initializing snap state', async () => {
      const initialState = getInitialSnapState();

      await expect(initSnapState(snapMock)).resolves.toEqual(initialState);

      expect(snapMock.rpcMocks.snap_manageState).toHaveBeenCalledWith({
        operation: 'update',
        newState: initialState,
      });

      expect.assertions(2);
    });
  });

  describe('initAccountState', () => {
    it('should succeed initializing empty account state', async () => {
      const initialState = getInitialSnapState();
      const defaultState = getDefaultSnapState(account);
      defaultState.accountState[account].publicKey = '';

      await expect(
        initAccountState({
          snap: snapMock,
          ethereum: ethereumMock,
          state: initialState,
          account,
          origin: 'localhost',
        })
      ).resolves.not.toThrow();

      expect(snapMock.rpcMocks.snap_manageState).toHaveBeenCalledWith({
        operation: 'update',
        newState: initialState,
      });

      expect.assertions(2);
    });
  });
});