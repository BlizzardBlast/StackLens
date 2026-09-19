export interface JavaScriptOsvVulnerabilityMatch {
  readonly id: string;
}

export interface JavaScriptOsvQueryResult {
  readonly packageName: string;
  readonly version: string;
  readonly matches: readonly JavaScriptOsvVulnerabilityMatch[];
  readonly complete: boolean;
}

export interface JavaScriptOsvSeverity {
  readonly type: string;
  readonly score: string;
  readonly source?: string;
}

export interface JavaScriptOsvAffectedPackage {
  readonly packageName: string;
  readonly ecosystem: string;
  readonly severities: readonly JavaScriptOsvSeverity[];
}

export interface JavaScriptOsvVulnerability {
  readonly id: string;
  readonly withdrawnAt?: string;
  readonly severities: readonly JavaScriptOsvSeverity[];
  readonly affected: readonly JavaScriptOsvAffectedPackage[];
}

export interface JavaScriptOsvSnapshot {
  readonly queryResults: readonly JavaScriptOsvQueryResult[];
  readonly vulnerabilities: readonly JavaScriptOsvVulnerability[];
}

export interface JavaScriptAnalysisMetadata {
  readonly osv?: JavaScriptOsvSnapshot;
}
