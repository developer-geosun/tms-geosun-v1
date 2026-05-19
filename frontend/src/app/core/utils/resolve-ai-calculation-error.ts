import { extractApiError } from './api-error';

const BASE_KEY = 'pages.adminRouteRequests.aiErrors';

export interface AiCalculationErrorDisplay {
  messageKey: string;
  params?: Record<string, string>;
  detail?: string;
}

export function resolveAiCalculationError(error: unknown): AiCalculationErrorDisplay {
  const { code, message, status } = extractApiError(error);
  return resolveFromCodeAndMessage(code, message, status);
}

export function resolveAiCalculationFailure(
  errorMessage: string | null | undefined
): AiCalculationErrorDisplay | null {
  if (!errorMessage?.trim()) {
    return null;
  }
  return resolveFromCodeAndMessage(null, errorMessage.trim(), null);
}

function resolveFromCodeAndMessage(
  code: string | null,
  message: string | null,
  httpStatus: number | null
): AiCalculationErrorDisplay {
  const normalizedMessage = message?.toLowerCase() ?? '';

  if (code === 'GEMINI_TIMEOUT' || normalizedMessage.includes('timed out')) {
    return display('geminiTimeout', message);
  }

  if (code === 'RATE_LIMIT_EXCEEDED') {
    return display('rateLimitExceeded', message);
  }

  if (code === 'SCENARIO_NOT_FOUND') {
    if (normalizedMessage.includes('not active')) {
      return display('scenarioInactive', message);
    }
    return display('scenarioNotFound', message);
  }

  if (code === 'VALIDATION_ERROR') {
    return display('validationError', message);
  }

  if (code === 'NOT_FOUND') {
    return display('notFound', message);
  }

  if (code === 'VERTEX_AI_UNAVAILABLE' || normalizedMessage.includes('vertex ai project')) {
    return display('vertexAiNotConfigured', message);
  }

  if (
    code === 'GEMINI_PERMISSION_DENIED' ||
    (httpStatus === 403 && code !== 'FORBIDDEN')
  ) {
    return display('geminiPermissionDenied', message);
  }

  if (
    code === 'GEMINI_MODEL_NOT_FOUND' ||
    (httpStatus === 404 && normalizedMessage.includes('gemini'))
  ) {
    return display('geminiModelNotFound', message);
  }

  if (code === 'GEMINI_QUOTA_EXCEEDED' || httpStatus === 429) {
    return display('geminiQuotaExceeded', message);
  }

  if (code === 'GEMINI_UNAVAILABLE' || isGeminiFailureMessage(normalizedMessage)) {
    if (normalizedMessage.includes('api key')) {
      return display('geminiApiKeyNotConfigured', message);
    }
    if (normalizedMessage.includes('model is not configured') || normalizedMessage.includes('model')) {
      return display('geminiModelNotConfigured', message);
    }
    const apiStatus = extractGeminiHttpStatus(message);
    if (apiStatus) {
      return {
        messageKey: `${BASE_KEY}.geminiApiError`,
        params: { httpStatus: apiStatus },
        detail: message ?? undefined
      };
    }
    if (normalizedMessage.includes('after retry')) {
      return display('geminiUnavailableAfterRetry', message);
    }
    if (normalizedMessage.includes('call failed')) {
      return display('geminiCallFailed', message);
    }
    if (normalizedMessage.includes('ai calculation failed')) {
      return display('calculationUnexpected', message);
    }
    return display('geminiUnavailable', message);
  }

  if (httpStatus === 0) {
    return display('networkError', message);
  }

  if (httpStatus === 503) {
    return display('serviceUnavailable', message);
  }

  return {
    messageKey: 'pages.adminRouteRequests.aiCalculationFailed',
    detail: message ?? undefined
  };
}

function display(suffix: string, detail: string | null): AiCalculationErrorDisplay {
  return {
    messageKey: `${BASE_KEY}.${suffix}`,
    detail: detail ?? undefined
  };
}

function isGeminiFailureMessage(message: string): boolean {
  return (
    message.includes('gemini') ||
    message.includes('vertex ai') ||
    message.includes('ai calculation failed') ||
    message.includes('unexpected calculation')
  );
}

function extractGeminiHttpStatus(message: string | null): string | null {
  if (!message) {
    return null;
  }
  const match = message.match(/Gemini API error:\s*(\d{3})/i);
  return match?.[1] ?? null;
}
