import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { RunResponse } from './agentRunManager.types';

interface LoadingState {
  isLoadingRuns: boolean;
  isFetchingRuns: boolean;
  fetchingMessagesMap: Map<string, boolean>;
  isSendingMessage: boolean;
  isInitialLoad: boolean;
}

interface ErrorState {
  runsError: Error | null;
  messageErrorsMap: Map<string, Error>;
}

interface AgentRunMessagesState {
  agentId: string;
  runResponses: RunResponse[];
  loadingState: LoadingState;
  errorState: ErrorState;
}

// Atom family for per-agentId state
// atomFamily creates a function that takes agentId and returns an atom
export const agentRunMessagesAtomFamily = atomFamily((agentId: string) => {
  const initialState: AgentRunMessagesState = {
    agentId,
    runResponses: [],
    loadingState: {
      isLoadingRuns: false,
      isFetchingRuns: false,
      fetchingMessagesMap: new Map(),
      isSendingMessage: false,
      isInitialLoad: true,
    },
    errorState: {
      runsError: null,
      messageErrorsMap: new Map(),
    },
  };

  return atom<AgentRunMessagesState>(initialState);
});

// Lock system for managing worker subscriptions per agentId
interface LockInfo {
  ownerId: string; // Unique ID of the hook instance that holds the lock
  waitQueue: Array<() => void>; // Queue of callbacks waiting for the lock
}

const locks = new Map<string, LockInfo>();

/**
 * Try to acquire the lock for an agentId
 * @param agentId - The agent ID to lock
 * @param ownerId - Unique identifier for the hook instance
 * @returns true if lock was acquired, false if already locked
 */
export function tryAcquireLock(agentId: string, ownerId: string): boolean {
  const existingLock = locks.get(agentId);

  if (!existingLock) {
    // No lock exists, create and acquire it
    locks.set(agentId, {
      ownerId,
      waitQueue: [],
    });
    return true;
  }

  // Lock already held by someone
  return false;
}

/**
 * Register a callback to be notified when the lock becomes available
 * @param agentId - The agent ID to wait for
 * @param callback - Callback to invoke when lock is available
 */
export function waitForLock(agentId: string, callback: () => void): void {
  const lockInfo = locks.get(agentId);

  if (lockInfo) {
    lockInfo.waitQueue.push(callback);
  } else {
    // Lock is already available, invoke immediately
    callback();
  }
}

/**
 * Release the lock and notify next waiter
 * @param agentId - The agent ID to unlock
 * @param ownerId - The owner releasing the lock
 * @returns true if lock was released, false if not held by this owner
 */
export function releaseLock(agentId: string, ownerId: string): boolean {
  const lockInfo = locks.get(agentId);

  if (!lockInfo || lockInfo.ownerId !== ownerId) {
    // Lock not held by this owner
    return false;
  }

  // Check if anyone is waiting
  const nextCallback = lockInfo.waitQueue.shift();

  if (nextCallback) {
    // Transfer lock to next waiter
    nextCallback();
    return false; // Lock transferred, not fully released
  } else {
    // No one waiting, fully release the lock
    locks.delete(agentId);
    return true; // Lock fully released
  }
}

/**
 * Check if a lock exists for an agentId
 */
export function hasLock(agentId: string): boolean {
  return locks.has(agentId);
}

/**
 * Check if a specific owner holds the lock
 */
export function holdsLock(agentId: string, ownerId: string): boolean {
  const lockInfo = locks.get(agentId);
  return lockInfo?.ownerId === ownerId;
}
