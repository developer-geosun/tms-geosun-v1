import { HttpErrorResponse } from '@angular/common/http';
import { resolveAiCalculationError } from './resolve-ai-calculation-error';

describe('resolveAiCalculationError', () => {
  it('maps missing Gemini API key', () => {
    const result = resolveAiCalculationError(
      new HttpErrorResponse({
        status: 503,
        error: {
          code: 'GEMINI_UNAVAILABLE',
          message: 'Gemini API key is not configured'
        }
      })
    );

    expect(result.messageKey).toBe('pages.adminRouteRequests.aiErrors.geminiApiKeyNotConfigured');
  });

  it('maps Gemini HTTP status from message', () => {
    const result = resolveAiCalculationError(
      new HttpErrorResponse({
        status: 503,
        error: {
          code: 'GEMINI_UNAVAILABLE',
          message: 'Gemini API error: 403'
        }
      })
    );

    expect(result.messageKey).toBe('pages.adminRouteRequests.aiErrors.geminiApiError');
    expect(result.params).toEqual({ httpStatus: '403' });
  });

  it('maps Gemini permission denied', () => {
    const result = resolveAiCalculationError(
      new HttpErrorResponse({
        status: 503,
        error: {
          code: 'GEMINI_PERMISSION_DENIED',
          message:
            'Gemini API error 403: Your project has been denied access. Please contact support.'
        }
      })
    );

    expect(result.messageKey).toBe('pages.adminRouteRequests.aiErrors.geminiPermissionDenied');
  });

  it('maps rate limit', () => {
    const result = resolveAiCalculationError(
      new HttpErrorResponse({
        status: 429,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'AI calculation rate limit exceeded'
        }
      })
    );

    expect(result.messageKey).toBe('pages.adminRouteRequests.aiErrors.rateLimitExceeded');
  });
});
