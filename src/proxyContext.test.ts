import {AsyncLocalStorage} from 'node:async_hooks';
import {NextResponse} from 'next/server';
import {runWithProxyContext} from '@/proxyContext';

describe('runWithProxyContext', () => {
    const originalNext = NextResponse.next;
    const globalStorage = Object.getOwnPropertyDescriptor(globalThis, 'AsyncLocalStorage');
    const registryKey = Symbol.for('@croct/plug-next/proxy-context');
    const warning = jest.fn();

    beforeEach(() => {
        warning.mockClear();
        jest.spyOn(console, 'warn').mockImplementation(warning);
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
            (_, index) => runWithProxyContext(
                new Headers({'x-visitor': `${index}`}),
                async () => {
                    await Promise.resolve();
                    methods.add(NextResponse.next);

                    return NextResponse.next();
                },
            ),
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
        const response = await runWithProxyContext(requestHeaders, async () => {
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

    it.each<[string, Error | undefined]>([
        ['successful', undefined],
        ['failing', new Error('Application failure')],
    ])('should stop forwarding headers in detached work after a %s callback', async (_, error) => {
        let release = (): void => {};
        const barrier = new Promise<void>(resolve => {
            release = resolve;
        });
        let detached = Promise.resolve(NextResponse.next());
        const execution = runWithProxyContext(new Headers({'x-preview-token': 'private'}), () => {
            detached = barrier.then(() => NextResponse.next());

            expect(NextResponse.next().headers.get('x-middleware-request-x-preview-token')).toBe('private');

            if (error !== undefined) {
                throw error;
            }
        });

        await expect(execution.catch((reason: unknown) => reason)).resolves.toBe(error);

        release();

        expect((await detached).headers.get('x-middleware-request-x-preview-token')).toBeNull();
    });

    it('should clear nested contexts and restore the parent context', async () => {
        const outer = await runWithProxyContext(new Headers({'x-visitor': 'outer'}), async () => {
            const inner = await runWithProxyContext(null, () => NextResponse.next());

            expect(inner.headers.get('x-middleware-request-x-visitor')).toBeNull();

            return NextResponse.next();
        });

        expect(outer.headers.get('x-middleware-request-x-visitor')).toBe('outer');
    });

    it('should preserve native argument forwarding outside a context', async () => {
        const spy = jest.spyOn(NextResponse, 'next');

        await runWithProxyContext(null, () => {});
        NextResponse.next();

        expect(spy).toHaveBeenLastCalledWith();

        const init = {request: {headers: new Headers({'x-explicit': 'value'})}};

        NextResponse.next(init);

        expect(spy).toHaveBeenLastCalledWith(init);
    });

    it('should fall back without automatic headers when the store is unavailable and warn only once', async () => {
        Reflect.deleteProperty(globalThis, 'AsyncLocalStorage');
        const handler = jest.fn(
            () => NextResponse.next({
                request: {headers: new Headers({'x-explicit': 'preserved'})},
            }),
        );

        for (let index = 0; index < 2; index++) {
            const response = await runWithProxyContext(new Headers({'x-preview-token': 'private'}), handler);

            expect(response.headers.get('x-middleware-request-x-preview-token')).toBeNull();
            expect(response.headers.get('x-middleware-request-x-explicit')).toBe('preserved');
        }

        expect(handler).toHaveBeenCalledTimes(2);
        expect(warning).toHaveBeenCalledTimes(1);
        expect(warning.mock.calls.flat().join(' ')).not.toContain('private');
        expect(NextResponse.next).toBe(originalNext);
    });

    it.each(['throws', 'rejects'])('should not retry a callback that %s', async outcome => {
        const error = new Error('Application failure');
        const handler = jest.fn(() => {
            if (outcome === 'throws') {
                throw error;
            }

            return Promise.reject(error);
        });

        await expect(runWithProxyContext(null, handler)).rejects.toBe(error);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should fall back when storage construction fails', async () => {
        Object.defineProperty(globalThis, 'AsyncLocalStorage', {
            value: jest.fn(() => {
                throw new Error('Unavailable');
            }),
            configurable: true,
        });

        const response = await runWithProxyContext(
            new Headers({'x-preview-token': 'private'}),
            () => NextResponse.next(),
        );

        expect(response.headers.get('x-middleware-request-x-preview-token')).toBeNull();
        expect(NextResponse.next).toBe(originalNext);
        expect(warning).toHaveBeenCalledTimes(1);
    });

    it('should not overwrite an incompatible registry', async () => {
        const incompatible = {version: 2};

        Object.defineProperty(NextResponse, registryKey, {value: incompatible, configurable: true});

        await runWithProxyContext(null, () => {});

        expect(Reflect.get(NextResponse, registryKey)).toBe(incompatible);
        expect(NextResponse.next).toBe(originalNext);
    });

    it('should fall back when the response factory cannot be intercepted', async () => {
        Object.defineProperty(NextResponse, 'next', {writable: false});

        await expect(runWithProxyContext(null, () => NextResponse.next())).resolves.toBeInstanceOf(NextResponse);
        expect(NextResponse.next).toBe(originalNext);
    });

    it.each<[string, () => undefined]>([
        ['missing', () => undefined],
        ['unreadable', () => {
            throw new Error('Context unavailable');
        }],
    ])('should fall back when the current context is %s', async (_, readContext) => {
        const storage = new AsyncLocalStorage();

        Object.defineProperty(globalThis, 'AsyncLocalStorage', {
            value: jest.fn(() => storage),
            configurable: true,
        });

        const response = await runWithProxyContext(new Headers({'x-preview-token': 'private'}), () => {
            // Mock only this instance, not AsyncLocalStorage's shared prototype.
            jest.spyOn(storage, 'getStore').mockImplementationOnce(readContext);

            return NextResponse.next();
        });

        expect(response.headers.get('x-middleware-request-x-preview-token')).toBeNull();
    });

    it('should fall back when the registry cannot be installed', async () => {
        const {defineProperty} = Object;

        jest.spyOn(Object, 'defineProperty').mockImplementation((target, property, attributes) => {
            if (target === NextResponse && property === registryKey) {
                throw new Error('Cannot register');
            }

            return defineProperty(target, property, attributes);
        });

        await expect(runWithProxyContext(null, () => NextResponse.next())).resolves.toBeInstanceOf(NextResponse);
        expect(NextResponse.next).toBe(originalNext);
        expect(Reflect.get(NextResponse, registryKey)).toBeUndefined();
    });
});
