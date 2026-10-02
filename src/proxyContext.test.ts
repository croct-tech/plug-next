import {AsyncLocalStorage} from 'node:async_hooks';
import {NextResponse} from 'next/server';
import {runWithProxyContext} from '@/proxyContext';

describe('The proxy request context', () => {
    const originalNext = NextResponse.next;
    const globalStorage = Object.getOwnPropertyDescriptor(globalThis, 'AsyncLocalStorage');
    const registryKey = Symbol.for('@croct/plug-next/proxy-context');

    beforeEach(() => {
        Object.defineProperty(globalThis, 'AsyncLocalStorage', {
            value: AsyncLocalStorage,
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Object.defineProperty(NextResponse, 'next', {
            value: originalNext,
            writable: true,
            configurable: true,
        });
        Reflect.deleteProperty(NextResponse, registryKey);

        if (globalStorage === undefined) {
            Reflect.deleteProperty(globalThis, 'AsyncLocalStorage');
        } else {
            Object.defineProperty(globalThis, 'AsyncLocalStorage', globalStorage);
        }
    });

    it('should initialize once for concurrent first requests and keep the interceptor stable', async () => {
        const methods = new Set<typeof NextResponse.next>();
        const responses = await Promise.all(Array.from(
            {length: 100},
            (_, index) => runWithProxyContext(async scope => {
                Object.assign(scope, {headers: new Headers({'x-visitor': `${index}`})});
                await Promise.resolve();
                methods.add(NextResponse.next);

                return NextResponse.next();
            }),
        ));

        expect(methods.size).toBe(1);
        expect(methods.has(originalNext)).toBe(false);

        responses.forEach((response, index) => {
            expect(response.headers.get('x-middleware-request-x-visitor')).toBe(`${index}`);
        });

        expect(NextResponse.next().headers.get('x-middleware-override-headers')).toBeNull();
        expect(Object.getOwnPropertyDescriptor(NextResponse, registryKey)?.enumerable).toBe(false);
    });

    it('should preserve explicit header precedence and response options without modifying inputs', async () => {
        const requestHeaders = new Headers({'x-preview-token': 'preview', 'x-language': 'pt'});
        const explicitHeaders = new Headers({'x-language': 'en', 'x-other': 'value'});
        const response = await runWithProxyContext(async scope => {
            Object.assign(scope, {headers: requestHeaders});
            await Promise.resolve();
            requestHeaders.set('x-late', 'added-by-handler');

            return NextResponse.next({
                status: 202,
                headers: {'x-response': 'preserved'},
                request: {headers: explicitHeaders},
            });
        });

        expect(response.status).toBe(202);
        expect(response.headers.get('x-response')).toBe('preserved');
        expect(response.headers.get('x-middleware-request-x-language')).toBe('en');
        expect(response.headers.get('x-middleware-request-x-preview-token')).toBe('preview');
        expect(response.headers.get('x-middleware-request-x-late')).toBe('added-by-handler');
        expect(requestHeaders.get('x-language')).toBe('pt');
        expect(explicitHeaders.get('x-preview-token')).toBeNull();
        expect(response.headers.get('x-preview-token')).toBeNull();
    });

    it.each([false, true])('should release headers retained by detached work even after failure: %s', async fail => {
        let release = (): void => {};
        const barrier = new Promise<void>(resolve => {
            release = resolve;
        });
        let detached = Promise.resolve(NextResponse.next());
        const error = new Error('Application failure');
        const execution = runWithProxyContext(scope => {
            Object.assign(scope, {headers: new Headers({'x-preview-token': 'private'})});
            detached = barrier.then(() => NextResponse.next());

            if (fail) {
                throw error;
            }

            return NextResponse.next();
        });

        const failure = await execution.then(() => null, (reason: unknown) => reason);

        expect(failure).toBe(fail ? error : null);

        release();

        expect((await detached).headers.get('x-middleware-request-x-preview-token')).toBeNull();
    });

    it('should clear nested contexts and restore the parent context', async () => {
        const outer = await runWithProxyContext(async scope => {
            Object.assign(scope, {headers: new Headers({'x-visitor': 'outer'})});
            const inner = await runWithProxyContext(() => NextResponse.next());

            expect(inner.headers.get('x-middleware-request-x-visitor')).toBeNull();

            return NextResponse.next();
        });

        expect(outer.headers.get('x-middleware-request-x-visitor')).toBe('outer');
    });

    it('should preserve native argument forwarding outside a context', async () => {
        const spy = jest.spyOn(NextResponse, 'next');

        await runWithProxyContext(() => {});
        NextResponse.next();

        expect(spy).toHaveBeenLastCalledWith();

        const init = {request: {headers: new Headers({'x-explicit': 'value'})}};

        NextResponse.next(init);

        expect(spy).toHaveBeenLastCalledWith(init);
    });

    it('should fall back without automatic headers when the store is unavailable and warn only once', async () => {
        Reflect.deleteProperty(globalThis, 'AsyncLocalStorage');
        const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const handler = jest.fn(
            () => NextResponse.next({
                request: {headers: new Headers({'x-explicit': 'preserved'})},
            }),
        );

        for (let index = 0; index < 2; index++) {
            const response = await runWithProxyContext(scope => {
                Object.assign(scope, {headers: new Headers({'x-preview-token': 'private'})});

                return handler();
            });

            expect(response.headers.get('x-middleware-request-x-preview-token')).toBeNull();
            expect(response.headers.get('x-middleware-request-x-explicit')).toBe('preserved');
        }

        expect(handler).toHaveBeenCalledTimes(2);
        expect(warning).toHaveBeenCalledTimes(1);
        expect(warning.mock.calls.flat().join(' ')).not.toContain('private');
        expect(NextResponse.next).toBe(originalNext);
    });

    it('should not retry a rejecting callback', async () => {
        const error = new Error('Application failure');
        const handler = jest.fn(() => {
            throw error;
        });

        await expect(runWithProxyContext(handler)).rejects.toBe(error);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should fall back when storage loses its context', async () => {
        class LostContextStorage<T> extends AsyncLocalStorage<T> {
            public static lost = false;

            public getStore(): T | undefined {
                return LostContextStorage.lost ? undefined : super.getStore();
            }
        }

        Object.defineProperty(globalThis, 'AsyncLocalStorage', {value: LostContextStorage, configurable: true});

        const response = await runWithProxyContext(scope => {
            Object.assign(scope, {headers: new Headers({'x-preview-token': 'private'})});
            LostContextStorage.lost = true;

            return NextResponse.next();
        });

        expect(response.headers.get('x-middleware-request-x-preview-token')).toBeNull();
    });

    it('should fall back when storage construction fails', async () => {
        Object.defineProperty(globalThis, 'AsyncLocalStorage', {
            value: class {
                public constructor() {
                    throw new Error('Unavailable');
                }
            },
            configurable: true,
        });

        const response = await runWithProxyContext(scope => {
            Object.assign(scope, {headers: new Headers({'x-preview-token': 'private'})});

            return NextResponse.next();
        });

        expect(response.headers.get('x-middleware-request-x-preview-token')).toBeNull();
        expect(NextResponse.next).toBe(originalNext);
    });

    it('should reject a store that does not preserve its own scope', async () => {
        class IncompatibleStorage<T> extends AsyncLocalStorage<T> {
            public getStore(): undefined {
                return undefined;
            }
        }

        Object.defineProperty(globalThis, 'AsyncLocalStorage', {value: IncompatibleStorage, configurable: true});

        const response = await runWithProxyContext(scope => {
            Object.assign(scope, {headers: new Headers({'x-preview-token': 'private'})});

            return NextResponse.next();
        });

        expect(response.headers.get('x-middleware-request-x-preview-token')).toBeNull();
        expect(NextResponse.next).toBe(originalNext);
    });

    it('should not overwrite an incompatible registry', async () => {
        const incompatible = {version: 2};

        Object.defineProperty(NextResponse, registryKey, {value: incompatible, configurable: true});

        await runWithProxyContext(() => {});

        expect(Reflect.get(NextResponse, registryKey)).toBe(incompatible);
        expect(NextResponse.next).toBe(originalNext);
    });

    it('should fall back when the response factory cannot be intercepted', async () => {
        Object.defineProperty(NextResponse, 'next', {writable: false});

        await expect(runWithProxyContext(() => NextResponse.next())).resolves.toBeInstanceOf(NextResponse);
        expect(NextResponse.next).toBe(originalNext);
    });

    it('should release the scope reference after completion', async () => {
        const scope = await runWithProxyContext(current => {
            Object.assign(current, {headers: new Headers({'x-preview-token': 'private'})});

            return current;
        });

        expect(scope.headers).toBeNull();
    });

    it('should fall back when reading the current store fails', async () => {
        class UnavailableStorage<T> extends AsyncLocalStorage<T> {
            public static unavailable = false;

            public getStore(): T | undefined {
                if (UnavailableStorage.unavailable) {
                    throw new Error('Context unavailable');
                }

                return super.getStore();
            }
        }

        Object.defineProperty(globalThis, 'AsyncLocalStorage', {value: UnavailableStorage, configurable: true});

        const response = await runWithProxyContext(scope => {
            Object.assign(scope, {headers: new Headers({'x-preview-token': 'private'})});
            UnavailableStorage.unavailable = true;

            return NextResponse.next();
        });

        expect(response.headers.get('x-middleware-request-x-preview-token')).toBeNull();
    });

    it('should not overwrite a method replaced during initialization', async () => {
        const pending = runWithProxyContext(() => NextResponse.next());
        const replacement = jest.fn(originalNext);

        NextResponse.next = replacement;

        await pending;

        expect(NextResponse.next).toBe(replacement);
        expect(replacement).toHaveBeenCalledTimes(1);
        expect(replacement).toHaveBeenCalledWith();
    });

    it('should fall back when the registry cannot be installed', async () => {
        const {defineProperty} = Object;

        jest.spyOn(Object, 'defineProperty').mockImplementation((target, property, attributes) => {
            if (target === NextResponse && property === registryKey) {
                throw new Error('Cannot register');
            }

            return defineProperty(target, property, attributes);
        });

        await expect(runWithProxyContext(() => NextResponse.next())).resolves.toBeInstanceOf(NextResponse);
        expect(NextResponse.next).toBe(originalNext);
        expect(Reflect.get(NextResponse, registryKey)).toBeUndefined();
    });
});
