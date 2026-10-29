import OpenAI from 'openai';

let _client: OpenAI | null = null;

/**
 * Returns a singleton OpenAI client. Reads OPENAI_API_KEY from server-side
 * process.env — the key never leaves the backend.
 *
 * Throws a descriptive error when the key is missing so callers can relay
 * a safe message to the frontend.
 */
export function getOpenAIClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not configured in .env.local. ' +
      'Add OPENAI_API_KEY=sk-... to your .env.local file and restart the dev server.'
    );
  }

  _client = new OpenAI({ apiKey });
  return _client;
}

/**
 * Classifies an OpenAI SDK / API error into a safe, user-facing category
 * without leaking credentials or raw stack traces.
 */
export function classifyOpenAIError(err: unknown): {
  category: string;
  message: string;
  retryable: boolean;
} {
  if (err instanceof OpenAI.APIError) {
    const status = err.status;

    if (status === 401) {
      return {
        category: 'authentication',
        message:
          'OpenAI API key is invalid or has been revoked. Please check OPENAI_API_KEY in .env.local.',
        retryable: false,
      };
    }
    if (status === 403) {
      return {
        category: 'permissions',
        message:
          'OpenAI API key does not have permission to use the requested model. Check your OpenAI plan.',
        retryable: false,
      };
    }
    if (status === 429) {
      // Distinguish between rate limiting and exhausted credits
      const msg = err.message?.toLowerCase() || '';
      const code = (err as any).code || '';
      if (
        msg.includes('insufficient_quota') ||
        msg.includes('no credits') ||
        msg.includes('credit_balance') ||
        code === 'credit_balance_exhausted' ||
        code === 'insufficient_quota'
      ) {
        return {
          category: 'billing',
          message:
            'OpenAI billing issue — your account has run out of API credits. Add credits at platform.openai.com/settings/organization/billing.',
          retryable: false,
        };
      }
      return {
        category: 'rate_limit',
        message:
          'OpenAI rate limit exceeded. Please wait a moment and try again.',
        retryable: true,
      };
    }
    if (status === 402 || (err.message && err.message.toLowerCase().includes('billing'))) {
      return {
        category: 'billing',
        message:
          'OpenAI billing issue — your account may have run out of credits. Add a payment method at platform.openai.com.',
        retryable: false,
      };
    }
    if (status && status >= 500) {
      return {
        category: 'openai_server_error',
        message: 'OpenAI servers returned an error. Please retry in a few seconds.',
        retryable: true,
      };
    }

    return {
      category: 'api_error',
      message: `OpenAI API error (HTTP ${status}). Please try again.`,
      retryable: status ? status >= 500 : true,
    };
  }

  if (err instanceof Error) {
    if (err.message.includes('OPENAI_API_KEY')) {
      return {
        category: 'configuration',
        message: err.message,
        retryable: false,
      };
    }
    if (err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('ECONNREFUSED')) {
      return {
        category: 'network',
        message: 'Could not reach OpenAI API — please check your network connection and retry.',
        retryable: true,
      };
    }
  }

  return {
    category: 'unknown',
    message: 'An unexpected error occurred while generating AI recommendations. Please try again.',
    retryable: true,
  };
}

