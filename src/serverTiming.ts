import type {AsyncLocalStorage} from 'node:async_hooks';
import type {ServerResponse} from 'node:http';
import {getEnvFlag} from '@/config/env';

type TimedResponse = {
    response: ServerResponse,
    // Node.js replaces the trailers on every addTrailers() call, so they are accumulated here.
    trailers: string[],
};

type Storage = AsyncLocalStorage<TimedResponse>;

// The HTTP hook is process-wide, so the proxy and render bundles, as well as
// ESM and CJS copies of the package, must share a single subscription.
const STORAGE_KEY = Symbol.for('@croct/plug-next/server-timing');

/**
 * Starts tracking the response of every incoming request when timings are enabled.
 *
 * The proxy returns before rendering starts and never sees the final response, so the
 * raw Node.js response is the only place where a metric measured later can be written.
 *
 * @internal
 */
export function trackResponse(): Storage | null {
    if (!getEnvFlag(process.env.CROCT_SERVER_TIMING)) {
        return null;
    }

    const existing = Reflect.get(globalThis, STORAGE_KEY) as Storage | null | undefined;

    if (existing !== undefined) {
        return existing;
    }

    let storage: Storage | null = null;

    try {
        // Resolved at runtime to keep Node.js built-ins out of Edge bundles.
        const channel = globalThis.process.getBuiltinModule('node:diagnostics_channel');
        const requestStorage = new (globalThis as typeof globalThis & {
            AsyncLocalStorage: typeof AsyncLocalStorage,
        }).AsyncLocalStorage<TimedResponse>();

        // shortcut: requests received before this subscription are not timed, which in practice
        // is the first request after boot. Subscribe from instrumentation.ts if that ever matters.
        channel.subscribe('http.server.request.start', message => {
            requestStorage.enterWith({response: (message as {response: ServerResponse}).response, trailers: []});
        });

        storage = requestStorage;
    } catch {
        // Unavailable on the Edge runtime and on Node.js versions prior to 20.16.
    }

    Object.defineProperty(globalThis, STORAGE_KEY, {value: storage, configurable: true});

    return storage;
}

/**
 * Starts timing a call, returning the function that reports the elapsed time in the
 * Server-Timing of the current response, if any.
 *
 * @internal
 */
export function startTiming(description: string): (() => void) | undefined {
    const scope = trackResponse()?.getStore();

    if (scope === undefined) {
        return undefined;
    }

    const {response, trailers} = scope;

    const start = performance.now();

    return () => {
        const duration = (performance.now() - start).toFixed(1);
        // Descriptions may carry caller input, strip anything that could break out of the quoted string.
        const metric = `croct;desc="${description.replace(/[^\w@. -]/g, '')}";dur=${duration}`;

        if (response.headersSent) {
            // Ignored by Node.js unless the response is chunked, which is always
            // the case for streamed renders.
            trailers.push(metric);
            response.addTrailers({'Server-Timing': trailers.join(', ')});
        } else {
            response.appendHeader('Server-Timing', metric);
        }
    };
}
