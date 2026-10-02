import {AsyncLocalStorage} from 'node:async_hooks';
import {NextRequest, NextResponse} from 'next/server';
import type {NextFetchEvent, NextMiddleware} from 'next/server';
import {withCroct} from '@/proxy';

function createGate(): {promise: Promise<void>, open: () => void} {
    let open = (): void => {};
    const promise = new Promise<void>(resolve => {
        open = resolve;
    });

    return {promise: promise, open: open};
}

function createPreviewToken(id: string): string {
    const payload = Buffer.from(JSON.stringify({exp: Math.floor(Date.now() / 1000) + 3600, id: id}));

    return `header.${payload.toString('base64url')}.signature`;
}

function createRequest(id: string, token?: string): NextRequest {
    return new NextRequest(`https://example.com/${id}`, {
        headers: {
            'x-test-visitor': id,
            ...(token !== undefined ? {cookie: `ct.preview_token=${token}`} : {}),
        },
    });
}

function getResponse(response: Response | undefined | null | void): Response {
    if (!(response instanceof Response)) {
        throw new Error('Expected a proxy response.');
    }

    return response;
}

function getForwardedHeader(response: Response | undefined | null | void, name: string): string | null {
    return getResponse(response).headers.get(`x-middleware-request-${name}`);
}

describe('proxy concurrency', () => {
    const environment = {...process.env};
    const originalNext = NextResponse.next;
    const globalStorage = Object.getOwnPropertyDescriptor(globalThis, 'AsyncLocalStorage');
    const event = {} as NextFetchEvent;

    beforeEach(() => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
        process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION = 'true';
        Object.defineProperty(globalThis, 'AsyncLocalStorage', {value: AsyncLocalStorage, configurable: true});
    });

    afterEach(() => {
        process.env = {...environment};
        NextResponse.next = originalNext;
        Reflect.deleteProperty(NextResponse, Symbol.for('@croct/plug-next/proxy-context'));

        if (globalStorage === undefined) {
            Reflect.deleteProperty(globalThis, 'AsyncLocalStorage');
        } else {
            Object.defineProperty(globalThis, 'AsyncLocalStorage', globalStorage);
        }
    });

    it.each(['preview-first', 'visitor-first'])(
        'should isolate preview and visitor headers when finishing %s',
        async order => {
            const entered = [createGate(), createGate()];
            const release = [createGate(), createGate()];
            const token = createPreviewToken('editor');
            const handler = withCroct(async incoming => {
                const index = incoming.nextUrl.pathname === '/editor' ? 0 : 1;

                entered[index].open();
                await release[index].promise;

                return NextResponse.next();
            });

            const editor = Promise.resolve(handler(createRequest('editor', token), event));

            await entered[0].promise;

            const visitor = Promise.resolve(handler(createRequest('visitor'), event));

            await entered[1].promise;

            const responses = [editor, visitor];
            const first = order === 'preview-first' ? 0 : 1;

            release[first].open();
            await responses[first];
            release[1 - first].open();

            const [editorResponse, visitorResponse] = await Promise.all(responses);
            const subsequent = await withCroct(() => NextResponse.next())(createRequest('subsequent'), event);

            expect(getForwardedHeader(editorResponse, 'x-preview-token')).toBe(token);
            expect(getForwardedHeader(editorResponse, 'x-test-visitor')).toBe('editor');
            expect(getForwardedHeader(visitorResponse, 'x-preview-token')).toBeNull();
            expect(getForwardedHeader(visitorResponse, 'cookie')).toBeNull();
            expect(getForwardedHeader(visitorResponse, 'x-test-visitor')).toBe('visitor');
            expect(getForwardedHeader(subsequent, 'x-preview-token')).toBeNull();
            expect(getForwardedHeader(subsequent, 'x-test-visitor')).toBe('subsequent');
        },
    );

    it('should not affect calls outside Croct while a preview request is pending', async () => {
        const entered = createGate();
        const release = createGate();
        const handler = withCroct(async () => {
            entered.open();
            await release.promise;

            return NextResponse.next();
        });
        const pending = handler(createRequest('editor', createPreviewToken('editor')), event);

        await entered.promise;

        const response = NextResponse.next();

        release.open();
        await pending;

        expect(getForwardedHeader(response, 'x-preview-token')).toBeNull();
        expect(response.headers.get('x-middleware-override-headers')).toBeNull();
    });

    it.each<NextMiddleware>([
        withCroct(),
        withCroct({matcher: '/other', next: () => NextResponse.next()}),
    ])('should isolate nested requests without a matching handler', async nested => {
        const handler = withCroct(async () => nested(createRequest('visitor'), event));
        const response = await handler(createRequest('editor', createPreviewToken('editor')), event);

        expect(getForwardedHeader(response, 'x-preview-token')).toBeNull();
        expect(getForwardedHeader(response, 'x-test-visitor')).toBe('visitor');
    });

    it('should isolate excluded routes nested inside a preview handler', async () => {
        const nested = withCroct(() => NextResponse.next());
        const handler = withCroct(async () => nested(new NextRequest('https://example.com/robots.txt'), event));
        const response = getResponse(await handler(createRequest('editor', createPreviewToken('editor')), event));

        expect(getForwardedHeader(response, 'x-preview-token')).toBeNull();
        expect(response.headers.get('x-middleware-override-headers')).toBeNull();
    });

    it('should isolate simultaneous previews and the no-response fallback', async () => {
        const entered = [createGate(), createGate()];
        const release = [createGate(), createGate()];
        const tokens = [createPreviewToken('first'), createPreviewToken('second')];
        const handler = withCroct(async incoming => {
            const index = incoming.nextUrl.pathname === '/first' ? 0 : 1;

            entered[index].open();
            await release[index].promise;
        });
        const first = handler(createRequest('first', tokens[0]), event);

        await entered[0].promise;

        const second = handler(createRequest('second', tokens[1]), event);

        await entered[1].promise;
        release[0].open();

        const firstResponse = await first;

        release[1].open();

        const secondResponse = await second;
        const firstClientId = getForwardedHeader(firstResponse, 'x-client-id');

        expect(getForwardedHeader(firstResponse, 'x-preview-token')).toBe(tokens[0]);
        expect(getForwardedHeader(secondResponse, 'x-preview-token')).toBe(tokens[1]);
        expect(firstClientId).not.toBe(getForwardedHeader(secondResponse, 'x-client-id'));
    });

    it('should not retain a rejecting request in another request or subsequent calls', async () => {
        const entered = createGate();
        const release = createGate();
        const error = new Error('Handler failed');
        const failing = withCroct(async () => {
            entered.open();
            await release.promise;
            throw error;
        });
        const failure = Promise.resolve(failing(createRequest('editor', createPreviewToken('editor')), event))
            .catch((reason: unknown) => reason);

        await entered.promise;

        const response = await withCroct(() => NextResponse.next())(createRequest('visitor'), event);

        release.open();
        await expect(failure).resolves.toBe(error);

        expect(getForwardedHeader(response, 'x-preview-token')).toBeNull();
        expect(getForwardedHeader(NextResponse.next(), 'x-preview-token')).toBeNull();
    });

    it.each([
        {
            kind: 'redirect',
            create: () => NextResponse.redirect('https://example.com/destination'),
            status: 307,
            location: 'https://example.com/destination',
            rewrite: null,
            explicit: null,
            body: '',
        },
        {
            kind: 'rewrite',
            create: () => NextResponse.rewrite('https://example.com/destination', {
                request: {headers: new Headers({'x-explicit': 'preserved'})},
            }),
            status: 200,
            location: null,
            rewrite: 'https://example.com/destination',
            explicit: 'preserved',
            body: '',
        },
        {
            kind: 'response',
            create: () => new Response('custom body', {status: 202}),
            status: 202,
            location: null,
            rewrite: null,
            explicit: null,
            body: 'custom body',
        },
    ])('should preserve a $kind response', async scenario => {
        const response = scenario.create();

        response.headers.set('x-custom-response', 'preserved');
        const handler = withCroct(() => response);
        const result = getResponse(await handler(createRequest('visitor'), event));

        expect(result).toBe(response);
        expect(result.headers.get('x-custom-response')).toBe('preserved');
        expect(result.headers.get('set-cookie')).toContain('ct.client_id=');

        expect(result.status).toBe(scenario.status);
        expect(result.headers.get('location')).toBe(scenario.location);
        expect(result.headers.get('x-middleware-rewrite')).toBe(scenario.rewrite);
        expect(getForwardedHeader(result, 'x-explicit')).toBe(scenario.explicit);
        await expect(result.text()).resolves.toBe(scenario.body);
    });
});
