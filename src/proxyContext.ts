import type {AsyncLocalStorage} from 'node:async_hooks';
import {NextResponse} from 'next/server';

/** @internal */
export type ProxyScope = {
    headers: Headers | null,
};

type Storage = AsyncLocalStorage<ProxyScope>;
type Registry = {
    version: 1,
    run: <T>(scope: ProxyScope, callback: (scope: ProxyScope) => T | Promise<T>) => Promise<T>,
};

// ESM, CJS, and compatible copies of the package must use the same storage when
// they share NextResponse. A module-local singleton would not provide that guarantee.
const REGISTRY_KEY = Symbol.for('@croct/plug-next/proxy-context');
let warned = false;

function warnUnavailable(): void {
    if (!warned) {
        warned = true;
        console.warn(
            'Croct could not initialize automatic request-header forwarding. '
            + 'Pass request headers explicitly to NextResponse.next() in this environment.',
        );
    }
}

function createStorage(): Storage | null {
    try {
        // Next supplies AsyncLocalStorage in its server runtime. Do not introduce
        // a separate runtime or polyfill when that request-context facility is absent.
        const constructor = (globalThis as typeof globalThis & {
            AsyncLocalStorage?: typeof AsyncLocalStorage,
        }).AsyncLocalStorage;

        if (constructor !== undefined) {
            const storage = new constructor<ProxyScope>();
            const probe: ProxyScope = {headers: null};

            if (storage.run(probe, () => storage.getStore() === probe) && storage.getStore() === undefined) {
                return storage;
            }
        }
    } catch {
        // An unavailable runtime must never fall back to shared request state.
    }

    warnUnavailable();

    return null;
}

function getRegistry(): Registry | null {
    const existing: unknown = Reflect.get(NextResponse, REGISTRY_KEY);

    if (existing !== undefined) {
        if (
            typeof existing === 'object'
            && existing !== null
            && 'version' in existing
            && existing.version === 1
            && 'run' in existing
            && typeof existing.run === 'function'
        ) {
            return existing as Registry;
        }

        warnUnavailable();

        return null;
    }

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Preserve the static method and its receiver.
    const originalNext = NextResponse.next;
    // Defer initialization until after registering. Concurrent first requests
    // share this promise instead of installing competing interceptors.
    const ready = Promise.resolve().then((): Storage | null => {
        if (Reflect.get(NextResponse, REGISTRY_KEY) !== registry) {
            return null;
        }

        const storage = createStorage();

        if (storage === null) {
            return null;
        }

        if (NextResponse.next !== originalNext) {
            warnUnavailable();

            return null;
        }

        try {
            NextResponse.next = function next(...args: Parameters<typeof NextResponse.next>): NextResponse {
                let headers: Headers | null = null;

                try {
                    headers = storage.getStore()?.headers ?? null;
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
        } catch {
            warnUnavailable();

            return null;
        }

        return storage;
    });

    const registry: Registry = {
        version: 1,
        run: async (scope, callback) => {
            const storage = await ready;

            // Deliberately do not catch callback errors or retry the callback.
            return storage === null ? callback(scope) : storage.run(scope, callback, scope);
        },
    };

    try {
        Object.defineProperty(NextResponse, REGISTRY_KEY, {
            value: registry,
            configurable: true,
        });
    } catch {
        warnUnavailable();

        return null;
    }

    return registry;
}

/**
 * Every invocation gets a scope, including excluded routes and requests without
 * a handler, so nested invocations cannot inherit another request's headers.
 *
 * @internal
 */
export async function runWithProxyContext<T>(callback: (scope: ProxyScope) => T | Promise<T>): Promise<T> {
    const scope: ProxyScope = {headers: null};

    try {
        const registry = getRegistry();

        return await (registry === null ? callback(scope) : registry.run(scope, callback));
    } finally {
        // Detached async work may retain the scope, but not its request headers.
        scope.headers = null;
    }
}
