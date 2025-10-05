import type { WorkerMessage } from './agentRunManager.types';

interface WorkerSubscription {
  worker: Worker;
  subscriberCount: number;
  isInitialized: boolean;
}

/**
 * Singleton manager for worker subscriptions per agentId.
 * Ensures only one worker subscription exists per agent, regardless of how many hook instances.
 */
class WorkerSubscriptionManager {
  private static instance: WorkerSubscriptionManager;
  private subscriptions = new Map<string, WorkerSubscription>();
  private worker: Worker | null = null;

  private constructor() {}

  static getInstance(): WorkerSubscriptionManager {
    if (!WorkerSubscriptionManager.instance) {
      WorkerSubscriptionManager.instance = new WorkerSubscriptionManager();
    }
    return WorkerSubscriptionManager.instance;
  }

  private getWorker(): Worker | null {
    if (!this.worker && typeof Worker !== 'undefined') {
      this.worker = new Worker(
        new URL('./agentRunManager.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.worker;
  }

  /**
   * Subscribe to an agent's run messages
   * Returns whether this is the first subscriber (should initialize)
   */
  subscribe(
    agentId: string,
    baseUrl: string,
    headers: Record<string, string>
  ): { worker: Worker; shouldInitialize: boolean } | null {
    const worker = this.getWorker();
    if (!worker) {
      return null;
    }

    const existing = this.subscriptions.get(agentId);

    if (existing) {
      // Already subscribed, just increment count
      existing.subscriberCount++;
      return { worker, shouldInitialize: false };
    }

    // First subscriber
    this.subscriptions.set(agentId, {
      worker,
      subscriberCount: 1,
      isInitialized: false,
    });

    // Set API config
    const setConfigMessage: WorkerMessage = {
      type: 'SET_API_CONFIG',
      agentId,
      baseUrl,
      headers,
    };
    worker.postMessage(setConfigMessage);

    // Initialize manager
    const initMessage: WorkerMessage = {
      type: 'INIT',
      agentId,
    };
    worker.postMessage(initMessage);

    // Initialize run monitor
    const initRunMonitorMessage: WorkerMessage = {
      type: 'INIT_RUN_MONITOR',
      agentId,
    };
    worker.postMessage(initRunMonitorMessage);

    // Subscribe to updates
    const subscribeMessage: WorkerMessage = {
      type: 'SUBSCRIBE',
      agentId,
    };
    worker.postMessage(subscribeMessage);

    // Mark as initialized
    const subscription = this.subscriptions.get(agentId);
    if (subscription) {
      subscription.isInitialized = true;
    }

    return { worker, shouldInitialize: true };
  }

  /**
   * Unsubscribe from an agent's run messages
   * Returns whether this was the last subscriber (cleanup was performed)
   */
  unsubscribe(agentId: string): boolean {
    const subscription = this.subscriptions.get(agentId);

    if (!subscription) {
      return false;
    }

    subscription.subscriberCount--;

    if (subscription.subscriberCount <= 0) {
      // Last subscriber, clean up
      const unsubscribeMessage: WorkerMessage = {
        type: 'UNSUBSCRIBE',
        agentId,
      };
      subscription.worker.postMessage(unsubscribeMessage);

      const flushMessage: WorkerMessage = {
        type: 'FLUSH',
        agentId,
      };
      subscription.worker.postMessage(flushMessage);

      this.subscriptions.delete(agentId);
      return true;
    }

    return false;
  }

  /**
   * Get the worker instance (for sending messages)
   */
  getWorkerForAgent(agentId: string): Worker | null {
    const subscription = this.subscriptions.get(agentId);
    return subscription?.worker || null;
  }
}

export const workerSubscriptionManager = WorkerSubscriptionManager.getInstance();
