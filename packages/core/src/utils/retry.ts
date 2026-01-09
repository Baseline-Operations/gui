import { Logger } from "./logger.js";

export interface RetryOptions {
	maxAttempts?: number;
	delayMs?: number;
	backoff?: boolean;
	onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Utility class for retrying operations with exponential backoff.
 * Useful for network operations that may fail due to temporary issues.
 */
export class RetryUtil {
	/**
	 * Executes an async operation with retry logic.
	 * @param fn The async function to execute
	 * @param options Retry configuration options
	 * @returns The result of the operation
	 * @throws The last error if all retries fail
	 */
	static async retry<T>(
		fn: () => Promise<T>,
		options: RetryOptions = {}
	): Promise<T> {
		const {
			maxAttempts = 3,
			delayMs = 1000,
			backoff = true,
			onRetry,
		} = options;

		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				return await fn();
			} catch (error) {
				lastError =
					error instanceof Error ? error : (
						new Error(String(error))
					);

				if (attempt < maxAttempts) {
					const delay =
						backoff ?
							delayMs * Math.pow(2, attempt - 1)
						:	delayMs;

					if (onRetry) {
						onRetry(attempt, lastError);
					} else {
						Logger.dim(
							`  Retrying (${attempt}/${maxAttempts - 1}) in ${delay}ms...`
						);
					}

					await new Promise((resolve) =>
						setTimeout(resolve, delay)
					);
				}
			}
		}

		if (lastError) {
			throw lastError;
		}

		throw new Error("Retry failed with unknown error");
	}

	/**
	 * Checks if an error is retryable (network-related errors).
	 * @param error The error to check
	 * @returns True if the error is retryable
	 */
	static isRetryableError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false;
		}

		const message = error.message.toLowerCase();
		const retryablePatterns = [
			"network",
			"timeout",
			"econnreset",
			"enotfound",
			"etimedout",
			"eai_again",
			"temporary",
			"connection",
			"fetch",
			"clone",
			"pull",
			"push",
		];

		return retryablePatterns.some((pattern) =>
			message.includes(pattern)
		);
	}

	/**
	 * Executes an async operation with retry logic, but only retries on retryable errors.
	 * @param fn The async function to execute
	 * @param options Retry configuration options
	 * @returns The result of the operation
	 * @throws The last error if all retries fail or error is not retryable
	 */
	static async retryOnRetryable<T>(
		fn: () => Promise<T>,
		options: RetryOptions = {}
	): Promise<T> {
		const {
			maxAttempts = 3,
			delayMs = 1000,
			backoff = true,
			onRetry,
		} = options;

		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				return await fn();
			} catch (error) {
				lastError =
					error instanceof Error ? error : (
						new Error(String(error))
					);

				// Don't retry if error is not retryable
				if (!this.isRetryableError(lastError)) {
					throw lastError;
				}

				if (attempt < maxAttempts) {
					const delay =
						backoff ?
							delayMs * Math.pow(2, attempt - 1)
						:	delayMs;

					if (onRetry) {
						onRetry(attempt, lastError);
					} else {
						Logger.dim(
							`  Retrying (${attempt}/${maxAttempts - 1}) in ${delay}ms...`
						);
					}

					await new Promise((resolve) =>
						setTimeout(resolve, delay)
					);
				}
			}
		}

		if (lastError) {
			throw lastError;
		}

		throw new Error("Retry failed with unknown error");
	}
}
