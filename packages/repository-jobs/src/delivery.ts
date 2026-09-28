import { randomUUID } from "node:crypto";

import type { AnalysisRepository, RepositoryAnalysisDelivery } from "@stacklens/persistence";

import type { RepositoryJobQueue } from "./enqueue.js";

const DELIVERY_BATCH_SIZE = 25;
const DELIVERY_LEASE_MS = 60_000;
const DELIVERY_RETRY_BASE_MS = 1_000;
const DELIVERY_RETRY_MAX_MS = 60_000;

export interface RepositoryAnalysisDeliveryDispatcher {
  dispatchReady(): Promise<void>;
}

export interface RepositoryAnalysisDeliveryPump {
  stop(): Promise<void>;
}

export interface RepositoryAnalysisDeliveryDispatcherOptions {
  readonly repository: AnalysisRepository;
  readonly queue: RepositoryJobQueue;
  readonly now?: () => string;
  readonly createLeaseToken?: () => string;
}

function nextDeliveryAttempt(attempts: number, now: string): string {
  const delay = Math.min(
    DELIVERY_RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1),
    DELIVERY_RETRY_MAX_MS,
  );
  return new Date(new Date(now).getTime() + delay).toISOString();
}

function defaultLeaseToken(): string {
  return `delivery-${randomUUID()}`;
}

export function createRepositoryAnalysisDeliveryDispatcher(
  options: RepositoryAnalysisDeliveryDispatcherOptions,
): RepositoryAnalysisDeliveryDispatcher {
  const now = options.now ?? (() => new Date().toISOString());
  const createLeaseToken = options.createLeaseToken ?? defaultLeaseToken;

  return {
    async dispatchReady() {
      const claimedAt = now();
      const leaseToken = createLeaseToken();
      const leaseExpiresAt = new Date(
        new Date(claimedAt).getTime() + DELIVERY_LEASE_MS,
      ).toISOString();
      const deliveries = await options.repository.claimPendingRepositoryAnalysisDeliveries(
        DELIVERY_BATCH_SIZE,
        leaseToken,
        claimedAt,
        leaseExpiresAt,
      );

      await Promise.all(
        deliveries.map(async (delivery) =>
          dispatchDelivery(options.repository, options.queue, delivery, now),
        ),
      );
    },
  };
}

async function dispatchDelivery(
  repository: AnalysisRepository,
  queue: RepositoryJobQueue,
  delivery: RepositoryAnalysisDelivery,
  now: () => string,
): Promise<void> {
  try {
    await queue.enqueue({
      analysisId: delivery.analysisId,
      repositoryUrl: delivery.repositoryUrl,
      ...(delivery.requestedRef === undefined ? {} : { ref: delivery.requestedRef }),
    });
    await repository.markRepositoryAnalysisDeliveryDelivered(
      delivery.analysisId,
      delivery.leaseToken,
      now(),
    );
  } catch {
    const retriedAt = now();
    await repository.retryRepositoryAnalysisDelivery(
      delivery.analysisId,
      delivery.leaseToken,
      nextDeliveryAttempt(delivery.attempts, retriedAt),
      retriedAt,
    );
  }
}

export function startRepositoryAnalysisDeliveryPump(
  dispatcher: RepositoryAnalysisDeliveryDispatcher,
  intervalMs = DELIVERY_RETRY_BASE_MS,
): RepositoryAnalysisDeliveryPump {
  let stopped = false;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (): void => {
    if (stopped) return;
    timer = setTimeout(() => {
      void run();
    }, intervalMs);
  };

  const run = async (): Promise<void> => {
    if (stopped || running !== undefined) return;
    running = dispatcher.dispatchReady().catch(() => undefined);
    try {
      await running;
    } finally {
      running = undefined;
      schedule();
    }
  };

  void run();

  return {
    async stop() {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      await running;
    },
  };
}
