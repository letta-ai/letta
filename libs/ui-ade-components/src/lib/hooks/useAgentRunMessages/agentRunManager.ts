import type { Run, SendMessageData } from '@letta-cloud/sdk-core';
import { fetchRuns, fetchMessagesForRun } from './messageFetcher';
import type { RunResponse, RunResponseMessage } from './agentRunManager.types';
import { createSendMessageFactory } from './createSendMessageFactory';
import { createRunMonitorFactory } from './createRunMonitorFactory';

export interface LoadingState {
  isLoadingRuns: boolean; // Initial load of runs
  isFetchingRuns: boolean; // Paginating more runs
  fetchingMessagesMap: Map<string, boolean>; // Per-run message fetching state
  isSendingMessage: boolean; // Sending a message to the agent
  isInitialLoad: boolean; // True if initial runs + messages are still loading
}

export interface ErrorState {
  runsError: Error | null;
  messageErrorsMap: Map<string, Error>; // Per-run message errors
}

type RunResponseSubscriber = (runResponses: RunResponse[]) => void;
type LoadingStateSubscriber = (state: LoadingState) => void;
type ErrorStateSubscriber = (state: ErrorState) => void;

/**
 * Manages agent run messages for a specific agent.
 * Implements singleton pattern based on agentId.
 */
class AgentRunManager {
  private static instances = new Map<string, AgentRunManager>();

  private agentId: string;
  private runResponses: RunResponse[] = []; // Array of runs with their messages
  private runResponseSubscribers: Set<RunResponseSubscriber> = new Set();
  private loadingStateSubscribers: Set<LoadingStateSubscriber> = new Set();
  private errorStateSubscribers: Set<ErrorStateSubscriber> = new Set();
  private lastRunCursor: string | null = null; // null = no more runs to fetch
  private isLoadingRuns: boolean = false; // Initial load
  private isFetchingRuns: boolean = false; // Paginating
  private isSendingMessage: boolean = false; // Sending message
  private isInitialized: boolean = false;
  private isInitialLoad: boolean = true; // True until first runs + messages are loaded
  private initialRunIds = new Set<string>(); // Track which runs are part of initial load
  // Track pagination state per run (null cursor = no more messages for that run)
  private runMessageCursors = new Map<string, string | null>();
  private fetchingMessagesMap = new Map<string, boolean>();
  // Abort controllers for request cancellation
  private runsAbortController: AbortController | null = null;
  private messageAbortControllers = new Map<string, AbortController>();
  private activeStream: { runId: string; controller: AbortController } | null = null;
  // Error tracking
  private runsError: Error | null = null;
  private messageErrorsMap = new Map<string, Error>();
  // API configuration
  private baseUrl: string = '';
  private headers: Record<string, string> = {};
  // Run monitor
  private runMonitor: ReturnType<typeof createRunMonitorFactory> | null = null;

  private constructor(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * Get or create singleton instance for the given agentId
   */
  static getInstance(agentId: string): AgentRunManager {
    if (!AgentRunManager.instances.has(agentId)) {
      AgentRunManager.instances.set(agentId, new AgentRunManager(agentId));
    }
    const instance = AgentRunManager.instances.get(agentId);
    if (!instance) {
      throw new Error(`Failed to get or create instance for agentId: ${agentId}`);
    }
    return instance;
  }

  /**
   * Set API configuration for this manager
   */
  setApiConfig(baseUrl: string, headers: Record<string, string>): void {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  /**
   * Initialize the run monitor (should be called once by the lock holder)
   */
  initializeRunMonitor(): void {
    if (this.runMonitor) {
      return; // Already initialized
    }

    if (!this.baseUrl || !this.headers) {
      console.warn('Cannot initialize run monitor without API config');
      return;
    }

    this.isLoadingRuns = true;
    this.publishLoadingState();

    this.runMonitor = createRunMonitorFactory({
      agentId: this.agentId,
      baseUrl: this.baseUrl,
      headers: this.headers,
      onUpdate: (runs: Run[]) => {
        this.handleRunUpdates(runs);
      },
    });
    this.runMonitor.start();
  }

  /**
   * Handles run updates from the run monitor
   * This populates the initial runs and updates existing runs
   */
  private async handleRunUpdates(runs: Run[]): Promise<void> {
    const isInitialLoad = this.runResponses.length === 0;

    if (isInitialLoad) {
      // Initial population from run monitor
      const newRunResponses: RunResponse[] = runs.map(run => ({
        run,
        messages: [],
        requestError: null,
      }));

      this.runResponses = newRunResponses;
      this.isInitialized = true;
      this.isLoadingRuns = false;
      this.publishLoadingState();
      this.publishRunResponses();

      // Track initial run IDs and load messages for each initial run
      runs.forEach(run => {
        if (run.id) {
          this.initialRunIds.add(run.id);
          this.loadMoreMessagesFromRun(run.id);
        }
      });
    } else {
      // Update existing runs or add new ones
      const reconcilePromises: Promise<void>[] = [];

      runs.forEach((updatedRun) => {
        const existingIndex = this.runResponses.findIndex(
          (rr) => rr.run.id === updatedRun.id
        );

        if (existingIndex !== -1) {
          const existingRunResponse = this.runResponses[existingIndex];
          const wasRunning = existingRunResponse.run.status === 'running';
          const isNowComplete = updatedRun.status !== 'running';

          // Update existing run with new status
          this.runResponses[existingIndex] = {
            ...existingRunResponse,
            run: updatedRun,
          };

          // If run just completed, abort stream and reconcile messages
          if (wasRunning && isNowComplete && updatedRun.id) {
            // Abort the stream if this is the run that's currently streaming
            if (this.activeStream?.runId === updatedRun.id) {
              this.activeStream.controller.abort();
              this.activeStream = null;
            }

            // Reconcile messages with fresh data from API
            reconcilePromises.push(this.reconcileCompletedRunMessages(updatedRun.id));
          }
        } else {
          // Add new run at the beginning (most recent)
          const newRunResponse: RunResponse = {
            run: updatedRun,
            messages: [],
            requestError: null,
          };
          this.runResponses.unshift(newRunResponse);

          // Load messages for the new run
          if (updatedRun.id) {
            this.loadMoreMessagesFromRun(updatedRun.id);
          }
        }
      });

      this.publishRunResponses();

      // Wait for all reconciliations to complete
      if (reconcilePromises.length > 0) {
        await Promise.all(reconcilePromises);
      }
    }
  }

  /**
   * Subscribe to run response updates
   * @returns Unsubscribe function
   */
  subscribeToRunResponses(callback: RunResponseSubscriber): () => void {
    this.runResponseSubscribers.add(callback);
    // Immediately notify subscriber of current state
    callback(this.runResponses);

    return () => {
      this.runResponseSubscribers.delete(callback);
    };
  }

  /**
   * Subscribe to loading state updates
   * @returns Unsubscribe function
   */
  subscribeToLoadingState(callback: LoadingStateSubscriber): () => void {
    this.loadingStateSubscribers.add(callback);
    // Immediately notify subscriber of current state
    callback(this.getLoadingState());

    return () => {
      this.loadingStateSubscribers.delete(callback);
    };
  }

  /**
   * Subscribe to error state updates
   * @returns Unsubscribe function
   */
  subscribeToErrorState(callback: ErrorStateSubscriber): () => void {
    this.errorStateSubscribers.add(callback);
    // Immediately notify subscriber of current state
    callback(this.getErrorState());

    return () => {
      this.errorStateSubscribers.delete(callback);
    };
  }

  /**
   * Check if there are more runs to load
   */
  private canLoadMoreRuns(): boolean {
    // Can load more if we haven't initialized yet OR if we have a cursor
    // Note: On first load, lastRunCursor is null but we haven't fetched yet
    return !this.isInitialized || this.lastRunCursor !== null;
  }

  /**
   * Check if there are more messages to load for a specific run
   */
  private canLoadMoreMessagesFromRun(runId: string): boolean {
    const cursor = this.runMessageCursors.get(runId);
    // Can load more if we haven't fetched yet (no entry) OR if we have a cursor
    return cursor === undefined || cursor !== null;
  }

  /**
   * Get current loading state
   */
  private getLoadingState(): LoadingState {
    return {
      isLoadingRuns: this.isLoadingRuns,
      isFetchingRuns: this.isFetchingRuns,
      fetchingMessagesMap: new Map(this.fetchingMessagesMap),
      isSendingMessage: this.isSendingMessage,
      isInitialLoad: this.isInitialLoad,
    };
  }

  /**
   * Get current error state
   */
  private getErrorState(): ErrorState {
    return {
      runsError: this.runsError,
      messageErrorsMap: new Map(this.messageErrorsMap),
    };
  }

  /**
   * Reconcile messages for a completed run
   * Fetches all messages from the API and reconciles them with existing messages by otid
   * This ensures that step_id and other server-assigned properties are updated
   */
  private async reconcileCompletedRunMessages(runId: string): Promise<void> {
    try {
      // Fetch all messages for this run fresh from the API
      const allMessages = await this.fetchAllMessagesForRun(runId);

      // Find the run response
      const runResponse = this.runResponses.find(rr => rr.run.id === runId);
      if (!runResponse) {
        return;
      }

      // Create a map of existing messages by otid
      const existingMessagesByOtid = new Map<string, RunResponseMessage>();
      runResponse.messages.forEach(msg => {
        // Type guard to check if message has otid property
        if ('otid' in msg && msg.otid) {
          existingMessagesByOtid.set(msg.otid, msg);
        }
      });

      // Reconcile: use fresh messages from API, but preserve order and any messages without otid
      const reconciledMessages: RunResponseMessage[] = [];

      // First, add all messages from API (these have proper step_id)
      allMessages.forEach(apiMsg => {
        reconciledMessages.push(apiMsg);
      });

      // Then add any existing messages that don't have an otid (shouldn't happen but just in case)
      runResponse.messages.forEach(existingMsg => {
        const hasOtid = 'otid' in existingMsg && existingMsg.otid;
        if (!hasOtid) {
          reconciledMessages.push(existingMsg);
        }
      });

      // Update the run response with reconciled messages
      runResponse.messages = reconciledMessages;

      // Clear the cursor for this run to allow loading more if needed
      this.runMessageCursors.delete(runId);

      // Publish updated run responses
      this.publishRunResponses();
    } catch (error) {
      console.error('Error reconciling completed run messages:', error);
      // Don't throw - we don't want to break the polling loop
    }
  }

  /**
   * Fetch all messages for a run (handles pagination automatically)
   */
  private async fetchAllMessagesForRun(runId: string): Promise<RunResponseMessage[]> {
    const allMessages: RunResponseMessage[] = [];
    let cursor: string | null = null;
    const limit = 100;

    // Keep fetching until we get all messages
    while (true) {
      const messages = await fetchMessagesForRun({
        runId,
        after: cursor,
        limit,
        signal: undefined,
        baseUrl: this.baseUrl,
        headers: this.headers,
      });

      if (messages.length === 0) {
        break;
      }

      allMessages.push(...messages);

      // If we got fewer messages than the limit, we've reached the end
      if (messages.length < limit) {
        break;
      }

      // Update cursor to the last message's ID
      const lastMessage = messages[messages.length - 1];
      cursor = lastMessage.id || null;

      if (!cursor) {
        break;
      }
    }

    return allMessages;
  }

  /**
   * Reconcile and deduplicate run responses
   * Merges runs that have matching run.id or localRunId
   */
  private reconcileRunResponses(runResponses: RunResponse[]): RunResponse[] {
    const reconciled: RunResponse[] = [];
    const seenRunIds = new Set<string>();
    const seenLocalRunIds = new Set<string>();

    for (const runResponse of runResponses) {
      const runId = runResponse.run.id;
      const localRunId = runResponse.localRunId;

      // Skip runs without IDs
      if (!runId) continue;

      // Check if we've already seen this run (by either run.id or localRunId)
      const isDuplicateByRunId = seenRunIds.has(runId);
      const isDuplicateByLocalId = localRunId && seenLocalRunIds.has(localRunId);

      if (isDuplicateByRunId || isDuplicateByLocalId) {
        // Find the existing run to merge with
        const existingIndex = reconciled.findIndex(
          (rr) =>
            rr.run.id === runId ||
            (localRunId && rr.localRunId === localRunId)
        );

        if (existingIndex !== -1) {
          // Merge: prefer the one with more messages or the real run ID
          const existing = reconciled[existingIndex];

          // Prefer the response with the real run ID (not a temp UUID)
          // Check if runResponse has a real ID from server (will be different from localRunId)
          const runResponseHasRealId = runResponse.localRunId && runResponse.run.id !== runResponse.localRunId;
          const existingHasRealId = existing.localRunId && existing.run.id !== existing.localRunId;

          if (runResponseHasRealId && !existingHasRealId) {
            // Current has real ID, existing doesn't - replace with current
            reconciled[existingIndex] = runResponse;
          } else if (!runResponseHasRealId && existingHasRealId) {
            // Existing has real ID, current doesn't - keep existing
            // Do nothing
          } else if (runResponse.messages.length > existing.messages.length) {
            // Both have same ID status, prefer the one with more messages
            reconciled[existingIndex] = runResponse;
          }
          // Otherwise keep existing
        }
      } else {
        // Not a duplicate, add to reconciled list
        reconciled.push(runResponse);
        seenRunIds.add(runId);
        if (localRunId) {
          seenLocalRunIds.add(localRunId);
        }
      }
    }

    return reconciled;
  }

  /**
   * Notify all subscribers of run response updates
   */
  private publishRunResponses(): void {
    // Reconcile to remove duplicates before publishing
    const reconciled = this.reconcileRunResponses(this.runResponses);

    // Update internal state with reconciled data
    this.runResponses = reconciled;

    this.runResponseSubscribers.forEach(callback => callback(reconciled));
  }

  /**
   * Notify all subscribers of loading state updates
   */
  private publishLoadingState(): void {
    const state = this.getLoadingState();
    this.loadingStateSubscribers.forEach(callback => callback(state));
  }

  /**
   * Notify all subscribers of error state updates
   */
  private publishErrorState(): void {
    const state = this.getErrorState();
    this.errorStateSubscribers.forEach(callback => callback(state));
  }

  /**
   * Load more runs for the agent
   */
  async loadMoreRuns(): Promise<void> {
    // Check if API config has been set
    if (!this.baseUrl) {
      console.warn('API configuration not set. Call setApiConfig first before loading runs.');
      return;
    }

    const isInitialLoad = !this.isInitialized;

    // Check if we can load more and if we're not already loading
    if (!this.canLoadMoreRuns() || (isInitialLoad && this.isLoadingRuns) || (!isInitialLoad && this.isFetchingRuns)) {
      return;
    }

    // Abort any existing runs request
    if (this.runsAbortController) {
      this.runsAbortController.abort();
    }

    // Create new abort controller for this request
    this.runsAbortController = new AbortController();
    const signal = this.runsAbortController.signal;

    // Clear previous error
    this.runsError = null;
    this.publishErrorState();

    if (isInitialLoad) {
      this.isLoadingRuns = true;
    } else {
      this.isFetchingRuns = true;
    }
    this.publishLoadingState();

    try {
      const requestedLimit = 20;

      // Fetch N+1 to determine if there are more runs
      const fetchedRuns = await fetchRuns({
        agentId: this.agentId,
        after: this.lastRunCursor,
        limit: requestedLimit + 1,
        signal,
        baseUrl: this.baseUrl,
        headers: this.headers,
      });

      if (fetchedRuns.length === 0) {
        this.lastRunCursor = null; // No more runs
        return;
      }

      // Check if we got the +1 extra run
      const hasMore = fetchedRuns.length > requestedLimit;
      const runsToAdd = hasMore ? fetchedRuns.slice(0, requestedLimit) : fetchedRuns;

      // Create RunResponse objects for new runs
      const newRunResponses: RunResponse[] = runsToAdd.map(run => ({
        run,
        messages: [],
      }));

      this.runResponses.push(...newRunResponses);

      // Update cursor: set to last item's ID if more exist, null if no more
      this.lastRunCursor = hasMore ? (runsToAdd[runsToAdd.length - 1]?.id || null) : null;

      // Publish the updated run responses (with empty messages initially)
      this.publishRunResponses();

      // Automatically load messages for each new run
      await Promise.all(
        runsToAdd.map(async (run) => {
          if (run.id) {
            await this.loadMoreMessagesFromRun(run.id);
          }
        })
      );
    } catch (error) {
      // Don't log or store errors if request was aborted
      if (error instanceof Error && error.name !== 'CancelError') {
        console.error('Error loading runs:', error);
        this.runsError = error instanceof Error ? error : new Error(String(error));
        this.publishErrorState();
      }
      throw error;
    } finally {
      if (isInitialLoad) {
        this.isLoadingRuns = false;
      } else {
        this.isFetchingRuns = false;
      }
      this.publishLoadingState();
      this.runsAbortController = null;
    }
  }

  /**
   * Load more messages from a specific run
   */
  async loadMoreMessagesFromRun(runId: string): Promise<void> {
    // Check if API config has been set
    if (!this.baseUrl) {
      console.warn('API configuration not set. Call setApiConfig first before loading messages.');
      return;
    }

    const isFetching = this.fetchingMessagesMap.get(runId) ?? false;

    // Check if we can load more and if we're not already fetching
    if (!this.canLoadMoreMessagesFromRun(runId) || isFetching) {
      return;
    }

    const cursor = this.runMessageCursors.get(runId) || null;

    // Abort any existing request for this run
    const existingController = this.messageAbortControllers.get(runId);
    if (existingController) {
      existingController.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    this.messageAbortControllers.set(runId, abortController);
    const signal = abortController.signal;

    // Clear previous error for this run
    this.messageErrorsMap.delete(runId);
    this.publishErrorState();

    this.fetchingMessagesMap.set(runId, true);
    this.publishLoadingState();

    try {
      const requestedLimit = 50;

      // Fetch N+1 to determine if there are more messages
      const fetchedMessages = await fetchMessagesForRun({
        runId,
        after: cursor,
        limit: requestedLimit + 1,
        signal,
        baseUrl: this.baseUrl,
        headers: this.headers,
      });

      if (fetchedMessages.length === 0) {
        this.runMessageCursors.set(runId, null); // No more messages for this run
        return;
      }

      // Check if we got the +1 extra message
      const hasMore = fetchedMessages.length > requestedLimit;
      const messagesToAdd = hasMore ? fetchedMessages.slice(0, requestedLimit) : fetchedMessages;

      // Find the RunResponse for this run and add messages to it
      const runResponse = this.runResponses.find(rr => rr.run.id === runId);
      if (runResponse) {
        runResponse.messages.push(...messagesToAdd);
      }

      // Update cursor: set to last message's ID if more exist, null if no more
      const lastMessage = messagesToAdd[messagesToAdd.length - 1];
      this.runMessageCursors.set(runId, hasMore ? (lastMessage.id || null) : null);

      // Publish updated run responses
      this.publishRunResponses();
    } catch (error) {
      // Don't log or store errors if request was aborted
      if (error instanceof Error && error.name !== 'CancelError') {
        console.error('Error loading messages for run:', error);
        this.messageErrorsMap.set(runId, error instanceof Error ? error : new Error(String(error)));
        this.publishErrorState();
      }
      throw error;
    } finally {
      this.fetchingMessagesMap.set(runId, false);

      // Check if this was part of initial load and if all initial runs have finished loading
      if (this.isInitialLoad && this.initialRunIds.has(runId)) {
        this.initialRunIds.delete(runId);

        // If all initial runs have finished loading their first batch of messages
        if (this.initialRunIds.size === 0) {
          this.isInitialLoad = false;
        }
      }

      this.publishLoadingState();
      this.messageAbortControllers.delete(runId);
    }
  }

  /**
   * Send a message to the agent with streaming support
   */
  async sendMessage(payload: SendMessageData): Promise<void> {
    if (!this.baseUrl) {
      console.error('API configuration not set. Call setApiConfig first.');
      return;
    }

    // Abort any existing stream before starting a new one
    if (this.activeStream) {
      this.activeStream.controller.abort();
    }

    // Create abort controller for this send message request
    const controller = new AbortController();
    this.activeStream = { runId: '', controller };

    // Create the send message function using the factory
    const sendMessageFn = createSendMessageFactory({
      agentId: this.agentId,
      baseUrl: this.baseUrl,
      headers: this.headers,
      onUpdate: (runResponse: RunResponse) => {
        // Track the active stream run ID
        if (runResponse.run.id && runResponse.run.status === 'running' && this.activeStream) {
          this.activeStream.runId = runResponse.run.id;
        }

        // Find if this run already exists in our runResponses
        // Check both run.id and localRunId for matching
        const existingIndex = this.runResponses.findIndex(
          (rr) =>
            (runResponse.localRunId && rr.localRunId === runResponse.localRunId) ||
            rr.run.id === runResponse.run.id
        );

        if (existingIndex !== -1) {
          // Update existing run response
          this.runResponses[existingIndex] = runResponse;
        } else {
          // Add new run response at the beginning (most recent first)
          this.runResponses.unshift(runResponse);
        }

        // Publish updated run responses
        this.publishRunResponses();
      },
      signal: controller.signal,
    });

    try {
      this.isSendingMessage = true;
      this.publishLoadingState();

      await sendMessageFn(payload);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      this.isSendingMessage = false;
      this.publishLoadingState();
      // Clear stream tracking after completion
      this.activeStream = null;
    }
  }

  /**
   * Flush the manager - cleanup singleton data from memory
   */
  /**
   * Edit a message in local state (no remote call)
   * Finds the message by id and updates it
   * Only supports editing user_message, assistant_message, and reasoning_message
   */
  editMessage(message: RunResponseMessage): void {
    // Type guard: only messages with 'id' property can be edited
    if (!('id' in message) || !message.id) {
      console.warn('Cannot edit message without id');
      return;
    }

    let messageFound = false;

    // Search through all runs to find the message by id
    for (const runResponse of this.runResponses) {
      const messageIndex = runResponse.messages.findIndex(
        (msg) => 'id' in msg && msg.id === message.id
      );

      if (messageIndex !== -1) {
        // Replace the message at this index
        runResponse.messages[messageIndex] = message;
        messageFound = true;
        break;
      }
    }

    if (messageFound) {
      this.publishRunResponses();
    } else {
      console.warn(`Message with id ${message.id} not found in any run`);
    }
  }

  flush(): void {
    // Stop run monitor
    if (this.runMonitor) {
      this.runMonitor.stop();
      this.runMonitor = null;
    }

    // Abort all pending requests
    if (this.runsAbortController) {
      this.runsAbortController.abort();
      this.runsAbortController = null;
    }

    if (this.activeStream) {
      this.activeStream.controller.abort();
      this.activeStream = null;
    }

    this.messageAbortControllers.forEach((controller) => {
      controller.abort();
    });
    this.messageAbortControllers.clear();

    // Clear all state
    this.runResponses = [];
    this.runResponseSubscribers.clear();
    this.loadingStateSubscribers.clear();
    this.errorStateSubscribers.clear();
    this.lastRunCursor = null;
    this.isLoadingRuns = false;
    this.isFetchingRuns = false;
    this.isInitialized = false;
    this.runMessageCursors.clear();
    this.fetchingMessagesMap.clear();
    this.runsError = null;
    this.messageErrorsMap.clear();
    AgentRunManager.instances.delete(this.agentId);
  }

  /**
   * Get current run responses (for debugging/testing)
   */
  getRunResponses(): RunResponse[] {
    return [...this.runResponses];
  }
}

export default AgentRunManager;
