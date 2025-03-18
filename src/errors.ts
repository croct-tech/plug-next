/**
 * @internal
 */
export declare class DynamicServerError extends Error {
    public readonly digest = 'DYNAMIC_SERVER_USAGE';
}

/**
 * @internal
 */
export function isDynamicServerError(error: unknown): error is DynamicServerError {
    return typeof error === 'object'
        && error !== null
        && 'digest' in error
        && error.digest === 'DYNAMIC_SERVER_USAGE';
}
