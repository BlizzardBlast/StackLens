import type {
  AvailableDataSource,
  ExternalEvidence,
  PartialDataSource,
  PartialFailure,
  UnavailableDataSource,
} from "@stacklens/contracts";

export interface ProviderSuccess<TData> {
  readonly ok: true;
  readonly data: TData;
  readonly source: AvailableDataSource | PartialDataSource;
  readonly evidence: readonly ExternalEvidence[];
  readonly partialFailures: readonly PartialFailure[];
}

export interface ProviderFailure {
  readonly ok: false;
  readonly source: UnavailableDataSource;
  readonly failure: PartialFailure;
}

export type ProviderResult<TData> = ProviderSuccess<TData> | ProviderFailure;

export interface EvidenceProvider<TRequest, TData> {
  readonly id: string;
  fetch(request: TRequest): Promise<ProviderResult<TData>>;
}
