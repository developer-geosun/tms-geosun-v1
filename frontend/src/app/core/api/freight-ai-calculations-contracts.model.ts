export type AiCalculationStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL';

export interface RunAiCalculationContractRequest {
  scenarioId: string;
  calculationDate?: string;
}

export interface FreightAiCalculationContractDto {
  id: string;
  routeRequestId: number;
  scenarioId: string | null;
  scenarioName: string | null;
  status: AiCalculationStatus;
  responseText: string | null;
  responseStructured: Record<string, unknown> | null;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string | null;
}

export interface FreightAiCalculationSummaryContractDto {
  id: string;
  scenarioId: string | null;
  scenarioName: string | null;
  status: AiCalculationStatus;
  createdAt: string | null;
  latencyMs: number | null;
}
