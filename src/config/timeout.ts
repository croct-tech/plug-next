const DEFAULT_FETCH_TIMEOUT = 2000;

/**
 * @internal
 */
export function getDefaultFetchTimeout(): number | undefined {
    const timeout = process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT;

    if (timeout === undefined || timeout === '') {
        return process.env.NODE_ENV === 'production'
            ? DEFAULT_FETCH_TIMEOUT
            : undefined;
    }

    const milliseconds = Number.parseInt(timeout, 10);

    if (Number.isNaN(milliseconds) || milliseconds < 0) {
        throw new Error(
            `Croct's default fetch timeout must be a non-negative integer, got '${timeout}'. `
            + 'Please check the environment variable `NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT`.',
        );
    }

    return milliseconds;
}
