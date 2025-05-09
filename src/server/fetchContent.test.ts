/* eslint-disable testing-library/no-debugging-utils -- Needed for testing */
import {fetchContent as loadContent, FetchOptions as ResolvedFetchOptions} from '@croct/plug-react/api';
import {FetchResponse} from '@croct/plug/plug';
import {ApiKey, ApiKey as MockApiKey} from '@croct/sdk/apiKey';
import {FilteredLogger} from '@croct/sdk/logging/filteredLogger';
import type {NextRequest, NextResponse} from 'next/server';
import {fetchContent, FetchOptions} from './fetchContent';
import {RequestContext, resolveRequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';
import {getApiKey} from '@/config/security';
import {RouteContext} from '@/headers';

jest.mock(
    'next/headers',
    () => ({
        __esModule: true,
        headers: jest.fn(() => new Headers()),
        cookies: jest.fn(() => ({})),
    }),
);

jest.mock(
    '@croct/plug-react/api',
    () => ({
        __esModule: true,
        ...jest.requireActual('@croct/plug-react/api'),
        fetchContent: jest.fn(),
    }),
);

jest.mock(
    '@/config/security',
    () => ({
        __esModule: true,
        ...jest.requireActual('@/config/security'),
        getApiKey: jest.fn(() => MockApiKey.of('00000000-0000-0000-0000-000000000000')),
    }),
);

jest.mock(
    '@/config/context',
    () => ({
        __esModule: true,
        ...jest.requireActual('@/config/context'),
        resolveRequestContext: jest.fn(),
    }),
);

jest.mock(
    '@/config/timeout',
    () => ({
        __esModule: true,
        ...jest.requireActual('@/config/timeout'),
        getDefaultFetchTimeout: jest.fn(),
    }),
);

describe('fetchContent', () => {
    const apiKey = getApiKey().getIdentifier();
    const request = {
        clientId: '12345678-1234-1234-1234-123456789012',
        uri: 'http://example.com',
        referrer: 'http://referrer.com',
        clientIp: '192.0.0.1',
        clientAgent: 'user-agent',
        preferredLocale: 'en',
        previewToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwczovL2Nyb2N0LmlvIiwi'
            + 'YXVkIjoiaHR0cHM6Ly9jcm9jdC5pbyIsImlhdCI6MTQ0MDk3OTEwMCwiZXhwIjoxNDQwOTc5M'
            + 'jAwLCJtZXRhZGF0YSI6eyJleHBlcmllbmNlTmFtZSI6IkRldmVsb3BlcnMgZXhwZXJpZW5jZS'
            + 'IsImV4cGVyaW1lbnROYW1lIjoiRGV2ZWxvcGVycyBleHBlcmltZW50IiwiYXVkaWVuY2VOYW1l'
            + 'IjoiRGV2ZWxvcGVycyBhdWRpZW5jZSIsInZhcmlhbnROYW1lIjoiSmF2YVNjcmlwdCBEZXZlbG'
            + '9wZXJzIn19.',
    } satisfies RequestContext;

    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_DEBUG;
        delete process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL;
        delete process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE;
    });

    afterEach(() => {
        jest.mocked(resolveRequestContext).mockReset();
        jest.mocked(getDefaultFetchTimeout).mockReset();
        jest.mocked(loadContent).mockReset();
    });

    type FetchScenario = {
        request?: RequestContext,
        preferredLocale?: string,
        options: FetchOptions<any>,
        resolvedOptions: ResolvedFetchOptions,
    };

    it.each<[string, FetchScenario]>(Object.entries({
        'with partial context': {
            request: {
                clientId: request.clientId,
            },
            options: {},
            resolvedOptions: {
                apiKey: ApiKey.from(apiKey),
                clientId: request.clientId,
                clientIp: '127.0.0.1',
                extra: {
                    cache: 'no-store',
                },
                logger: expect.any(FilteredLogger),
            },
        },
        'with full context': {
            request: request,
            options: {},
            resolvedOptions: {
                apiKey: ApiKey.from(apiKey),
                previewToken: request.previewToken,
                clientId: request.clientId,
                clientIp: request.clientIp,
                clientAgent: request.clientAgent,
                preferredLocale: request.preferredLocale,
                context: {
                    page: {
                        url: request.uri,
                        referrer: request.referrer,
                    },
                },
                extra: {
                    cache: 'no-store',
                },
                logger: expect.any(FilteredLogger),
            },
        },
        'with URL and without referrer': {
            request: {
                clientId: request.clientId,
                uri: request.uri,
            },
            options: {},
            resolvedOptions: {
                apiKey: ApiKey.from(apiKey),
                clientId: request.clientId,
                clientIp: '127.0.0.1',
                context: {
                    page: {
                        url: 'http://example.com',
                    },
                },
                extra: {
                    cache: 'no-store',
                },
                logger: expect.any(FilteredLogger),
            },
        },
        'with overridden options': {
            request: {
                clientId: request.clientId,
                preferredLocale: request.preferredLocale,
            },
            options: {
                preferredLocale: 'fr',
                extra: {
                    cache: 'force-cache',
                },
            },
            resolvedOptions: {
                apiKey: ApiKey.from(apiKey),
                clientId: request.clientId,
                clientIp: '127.0.0.1',
                preferredLocale: 'fr',
                extra: {
                    cache: 'force-cache',
                },
                logger: expect.any(FilteredLogger),
            },
        },
        'of static content': {
            options: {
                static: true,
            },
            resolvedOptions: {
                static: true,
                apiKey: ApiKey.from(apiKey),
                logger: expect.any(FilteredLogger),
            },
        },
        'of static content with preferred locale': {
            preferredLocale: request.preferredLocale,
            options: {
                static: true,
            },
            resolvedOptions: {
                static: true,
                apiKey: ApiKey.from(apiKey),
                logger: expect.any(FilteredLogger),
                preferredLocale: request.preferredLocale,
            },
        },
    }))('should forward the call %s to the fetchContent function', async (_, scenario) => {
        const slotId = 'slot-id';
        const content: FetchResponse<any> = {
            content: {
                _component: 'component',
            },
        };

        if (scenario.request === undefined) {
            jest.mocked(resolveRequestContext).mockImplementation(() => {
                throw new Error('next/headers requires app router');
            });
        } else {
            jest.mocked(resolveRequestContext).mockResolvedValue(scenario.request);
        }

        if (scenario.preferredLocale !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE = scenario.preferredLocale;
        }

        jest.mocked(loadContent).mockResolvedValue(content);

        await expect(fetchContent<any, any>(slotId, scenario.options)).resolves.toEqual(content);

        expect(loadContent).toHaveBeenCalledWith(slotId, scenario.resolvedOptions);
    });

    it.each([true, false])('should use the default fetch timeout (static: %s)', async staticContent => {
        const defaultTimeout = 1000;
        const slotId = 'slot-id';
        const content: FetchResponse<any> = {
            content: {
                _component: 'component',
            },
        };

        jest.mocked(resolveRequestContext).mockResolvedValue({
            clientId: request.clientId,
        });

        jest.mocked(getDefaultFetchTimeout).mockReturnValue(defaultTimeout);

        jest.mocked(loadContent).mockResolvedValue(content);

        await fetchContent<any, any>(slotId, {
            static: staticContent,
        });

        expect(loadContent).toHaveBeenCalledWith(slotId, expect.objectContaining({
            static: staticContent,
            timeout: defaultTimeout,
        }));
    });

    it('should forward the route context when requesting dynamic content', async () => {
        const route: RouteContext = {
            req: {} as NextRequest,
            res: {} as NextResponse,
        };

        jest.mocked(resolveRequestContext).mockResolvedValue(request);
        jest.mocked(loadContent).mockResolvedValue({
            content: {
                _component: 'component',
            },
        });

        await fetchContent('slot-id', {
            route: route,
        });

        expect(resolveRequestContext).toHaveBeenCalledWith(route);
    });

    it('should forward the route context when requesting static content', async () => {
        const route: RouteContext = {
            req: {} as NextRequest,
            res: {} as NextResponse,
        };

        jest.mocked(resolveRequestContext).mockResolvedValue(request);
        jest.mocked(loadContent).mockResolvedValue({
            content: {
                _component: 'component',
            },
        });

        await fetchContent('slot-id', {
            static: true,
            route: route,
        });
    });

    it('should rethrow dynamic server errors', async () => {
        const error = new class DynamicServerError extends Error {
            public readonly digest = 'DYNAMIC_SERVER_USAGE';

            public constructor() {
                super('cause');

                Object.setPrototypeOf(this, new.target.prototype);
            }
        }();

        jest.mocked(resolveRequestContext).mockImplementation(() => {
            throw error;
        });

        await expect(fetchContent('slot-id')).rejects.toBe(error);
    });

    it('should report an error if the route context is missing', async () => {
        jest.mocked(resolveRequestContext).mockImplementation(() => {
            throw new Error('next/headers requires app router');
        });

        await expect(fetchContent('slot-id')).rejects.toThrow(
            'Error resolving request context: next/headers requires app router. '
            + 'This error typically occurs when fetchContent() is called outside of app routes without '
            + 'specifying the `route` option. '
            + 'For help, see: https://croct.help/sdk/nextjs/missing-route-context',
        );
    });

    it('should report unexpected errors resolving the context', async () => {
        const error = new Error('unexpected error');

        jest.mocked(resolveRequestContext).mockImplementation(() => {
            throw error;
        });

        const route: RouteContext = {
            req: {} as NextRequest,
            res: {} as NextResponse,
        };

        await expect(fetchContent('true', {route: route})).rejects.toBe(error);
    });

    it.each([true, false])('should override the default fetch timeout', async staticContent => {
        const defaultTimeout = 1000;
        const timeout = 2000;
        const slotId = 'slot-id';
        const content: FetchResponse<any> = {
            content: {
                _component: 'component',
            },
        };

        jest.mocked(resolveRequestContext).mockResolvedValue({
            clientId: request.clientId,
        });

        jest.mocked(getDefaultFetchTimeout).mockReturnValue(defaultTimeout);

        jest.mocked(loadContent).mockResolvedValue(content);

        await fetchContent<any, any>(slotId, {
            static: staticContent,
            timeout: timeout,
        });

        expect(loadContent).toHaveBeenCalledWith(slotId, expect.objectContaining({
            static: staticContent,
            timeout: timeout,
        }));
    });

    it.each([true, false])('should log warnings and errors', async staticContent => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'info').mockImplementation();

        jest.mocked(loadContent).mockResolvedValue({
            content: {
                _component: 'component',
            },
        });

        jest.mocked(resolveRequestContext).mockResolvedValue(request);

        await fetchContent<any, any>('slot-id', {
            static: staticContent,
        });

        const {logger} = jest.mocked(loadContent).mock.calls[0][1] as ResolvedFetchOptions;

        expect(logger).not.toBeUndefined();

        logger?.info('log');
        logger?.debug('debug');
        logger?.warn('warning');
        logger?.error('error');

        expect(console.info).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('warning');
        expect(console.error).toHaveBeenCalledWith('error');

        expect(console.log).not.toHaveBeenCalled();
    });

    it.each([true, false])('should log all messages if the debug mode is enabled', async staticContent => {
        process.env.NEXT_PUBLIC_CROCT_DEBUG = 'true';

        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'info').mockImplementation();

        jest.mocked(loadContent).mockResolvedValue({
            content: {
                _component: 'component',
            },
        });

        jest.mocked(resolveRequestContext).mockResolvedValue(request);

        await fetchContent<any, any>('slot-id', {
            static: staticContent,
        });

        const {logger} = jest.mocked(loadContent).mock.calls[0][1] as ResolvedFetchOptions;

        expect(logger).not.toBeUndefined();

        logger?.info('log');
        logger?.debug('debug');
        logger?.warn('warning');
        logger?.error('error');

        expect(console.info).toHaveBeenCalledWith('log');
        expect(console.debug).toHaveBeenCalledWith('debug');
        expect(console.warn).toHaveBeenCalledWith('warning');
        expect(console.error).toHaveBeenCalledWith('error');

        expect(console.log).not.toHaveBeenCalled();
    });

    it.each([true, false])('should use the base endpoint URL from the environment', async staticContent => {
        process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL = 'https://example.com';

        const slotId = 'slot-id';

        const content: FetchResponse<any> = {
            content: {
                _component: 'component',
            },
        };

        jest.mocked(resolveRequestContext).mockResolvedValue({
            clientId: request.clientId,
        });

        jest.mocked(loadContent).mockResolvedValue(content);

        await fetchContent<any, any>(slotId, {
            static: staticContent,
        });

        expect(loadContent).toHaveBeenCalledWith(slotId, expect.objectContaining({
            static: staticContent,
            baseEndpointUrl: process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL,
        }));
    });
});
