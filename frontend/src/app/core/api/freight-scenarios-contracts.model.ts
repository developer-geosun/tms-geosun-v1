export interface ScenarioContractDto {
  id: string;
  name: string;
  description: string | null;
  rulesText: string;
  outputFormatHint: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateScenarioContractRequest {
  name: string;
  description?: string | null;
  rulesText: string;
  outputFormatHint?: string | null;
  isActive?: boolean;
}

export interface UpdateScenarioContractRequest {
  name: string;
  description?: string | null;
  rulesText: string;
  outputFormatHint?: string | null;
  isActive: boolean;
}
