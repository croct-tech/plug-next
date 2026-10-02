import type {AsyncLocalStorage} from 'node:async_hooks';
import {NextResponse} from 'next/server';

type ProxyScope = {
    headers: Headers | null,
};

type Storage = AsyncLocalStorage<ProxyScope>;
type Registry = {
    version: 1,
    run: <T>(scope: ProxyScope, callback: (scope: ProxyScope) => T | Promise<T>) => T | Promise<T>,
};

// ESM, CJS, and compatible copies of the package must use the same storage when
// they share NextResponse. A module-local singleton would not provide that guarantee.
const REGISTRY_KEY = Symbol.for('@croct/plug-next/proxy-context');

function getRegistry(): Registry | null {
    const existing = Reflect.get(NextResponse, REGISTRY_KEY) as Partial<Registry> | undefined;

    if (existing !== undefined) {
        return existing?.version === 1 && typeof existing.run === 'function' ? existing as Registry : null;
    }

    let storage: Storage | null = null;
    let warned = false;
    const registry: Registry = {
        version: 1,
        run: (scope, callback) => (storage === null ? callback(scope) : storage.run(scope, callback, scope)),
    };

    function warnUnavailable(): void {
        if (!warned) {
            warned = true;
            console.warn(
                'Croct could not initialize automatic request-header forwarding. '
                + 'Pass request headers explicitly to NextResponse.next() in this environment.',
            );
        }
    }

    try {
        // Registration and installation are synchronous: no request can interleave
        // here before the interceptor is ready. Cache failures in the same registry.
        Object.defineProperty(NextResponse, REGISTRY_KEY, {value: registry, configurable: true});

        const constructor = (globalThis as typeof globalThis & {
            AsyncLocalStorage?: typeof AsyncLocalStorage,
        }).AsyncLocalStorage;

        if (constructor === undefined) {
            warnUnavailable();

            return registry;
        }

        const requestStorage = new constructor<ProxyScope>();
        // eslint-disable-next-line @typescript-eslint/unbound-method -- Preserve the static method and its receiver.
        const originalNext = NextResponse.next;

        NextResponse.next = function next(...args: Parameters<typeof NextResponse.next>): NextResponse {
            let headers: Headers | null = null;

            try {
                headers = requestStorage.getStore()?.headers ?? null;
            } catch {
                warnUnavailable();
            }

            if (headers === null) {
                return originalNext.apply(this, args);
            }

            const {request: modifiedRequest = {}, ...init} = args[0] ?? {};
            const mergedHeaders = new Headers(headers);

            modifiedRequest.headers?.forEach((value, name) => {
                mergedHeaders.set(name, value);
            });

            return originalNext.call(this, {
                ...init,
                request: {
                    ...modifiedRequest,
                    headers: mergedHeaders,
                },
            });
        };

        storage = requestStorage;
    } catch {
        // Leave automatic forwarding disabled if initialization fails.
        warnUnavailable();
    }

    return registry;
}

/**
 * A null header set explicitly isolates invocations that must not inherit the
 * caller's headers, including excluded routes and requests without a handler.
 *
 * @internal
 */
export async function runWithProxyContext<T>(headers: Headers | null, callback: () => T | Promise<T>): Promise<T> {
    const scope: ProxyScope = {headers: headers};

    try {
        const registry = getRegistry();

        return await (registry === null ? callback() : registry.run(scope, callback));
    } finally {
        // Detached async work may retain the scope, but not its request headers.
        scope.headers = null;
    }
}
