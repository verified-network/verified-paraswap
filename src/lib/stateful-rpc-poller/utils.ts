import type { StatePollingManager } from './state-polling-manager';
import { PollingManagerControllersCb } from './types';

export function getIdentifierKeyForRpcPoller(
  poolIdentifier: string,
  network: number,
): string {
  return `${network}_${poolIdentifier}`.toLowerCase();
}

// Helper function to extract relevant call backs for later use
export function pollingManagerCbExtractor(
  statePollingManager: StatePollingManager,
): PollingManagerControllersCb {
  return {
    enableStateTracking:
      statePollingManager.enableStateTracking.bind(statePollingManager),
    disableStateTracking:
      statePollingManager.disableStateTracking.bind(statePollingManager),
    registerPendingPool:
      statePollingManager.registerPendingPool.bind(statePollingManager),
  };
}
