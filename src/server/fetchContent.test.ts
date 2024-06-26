/* eslint-disable testing-library/no-debugging-utils -- Needed for testing */
import {fetchContent as loadContent, FetchOptions as ResolvedFetchOptions} from '@croct/plug-react/api';
import {FetchResponse} from '@croct/plug/plug';
import {ApiKey, ApiKey as MockApiKey} from '@croct/sdk/apiKey';
import {FilteredLogger} from '@croct/sdk/logging/filteredLogger';
import {fetchContent, FetchOptions} from './fetchContent';
import {getRequestContext, RequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';
import {getApiKey} from '@/config/security';

jest.mock(
    'server-only',
    () => ({
        __esModule: true,
    }),
);

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
        getRequestContext: jest.fn(),
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
        previewToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwczovL2Nyb2N0LmlvIiwi'
            + 'YXVkIjoiaHR0cHM6Ly9jcm9jdC5pbyIsImlhdCI6MTQ0MDk3OTEwMCwiZXhwIjoxNDQwOTc5M'
            + 'jAwLCJtZXRhZGF0YSI6eyJleHBlcmllbmNlTmFtZSI6IkRldmVsb3BlcnMgZXhwZXJpZW5jZS'
            + 'IsImV4cGVyaW1lbnROYW1lIjoiRGV2ZWxvcGVycyBleHBlcmltZW50IiwiYXVkaWVuY2VOYW1l'
            + 'IjoiRGV2ZWxvcGVycyBhdWRpZW5jZSIsInZhcmlhbnROYW1lIjoiSmF2YVNjcmlwdCBEZXZlbG'
            + '9wZXJzIn19.',
    } satisfies RequestContext;

    afterEach(() => {
        jest.mocked(getRequestContext).mockReset();
        jest.mocked(getDefaultFetchTimeout).mockReset();
        jest.mocked(loadContent).mockReset();
    });

    type FetchScenario = {
        request: RequestContext,
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
            },
            options: {
                extra: {
                    cache: 'force-cache',
                },
            },
            resolvedOptions: {
                apiKey: ApiKey.from(apiKey),
                clientId: request.clientId,
                clientIp: '127.0.0.1',
                extra: {
                    cache: 'force-cache',
                },
                logger: expect.any(FilteredLogger),
            },
        },
    }))('should forward the call %s to the fetchContent function', async (_, scenario) => {
        const slotId = 'slot-id';
        const content: FetchResponse<any> = {
            content: {
                _component: 'component',
            },
        };

        jest.mocked(getRequestContext).mockReturnValue(scenario.request);
        jest.mocked(loadContent).mockResolvedValue(content);

        await expect(fetchContent<any, any>(slotId, scenario.options)).resolves.toEqual(content.content);

        expect(loadContent).toHaveBeenCalledWith(slotId, scenario.resolvedOptions);
    });

    it('should use the default fetch timeout', async () => {
        const defaultTimeout = 1000;
        const slotId = 'slot-id';
        const content: FetchResponse<any> = {
            content: {
                _component: 'component',
            },
        };

        jest.mocked(getRequestContext).mockReturnValue({
            clientId: request.clientId,
        });

        jest.mocked(getDefaultFetchTimeout).mockReturnValue(defaultTimeout);

        jest.mocked(loadContent).mockResolvedValue(content);

        await fetchContent<any, any>(slotId);

        expect(loadContent).toHaveBeenCalledWith(slotId, expect.objectContaining({
            timeout: defaultTimeout,
        }));
    });

    it('should override the default fetch timeout', async () => {
        const defaultTimeout = 1000;
        const timeout = 2000;
        const slotId = 'slot-id';
        const content: FetchResponse<any> = {
            content: {
                _component: 'component',
            },
        };

        jest.mocked(getRequestContext).mockReturnValue({
            clientId: request.clientId,
        });

        jest.mocked(getDefaultFetchTimeout).mockReturnValue(defaultTimeout);

        jest.mocked(loadContent).mockResolvedValue(content);

        await fetchContent<any, any>(slotId, {
            timeout: timeout,
        });

        expect(loadContent).toHaveBeenCalledWith(slotId, expect.objectContaining({
            timeout: timeout,
        }));
    });

    it('should log warnings and errors', async () => {
        jest.spyOn(console, 'warn').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'info').mockImplementation();

        jest.mocked(loadContent).mockResolvedValue({
            content: {
                _component: 'component',
            },
        });

        jest.mocked(getRequestContext).mockReturnValue(request);

        await fetchContent<any, any>('slot-id');

        const {logger} = jest.mocked(loadContent).mock.calls[0][1] as ResolvedFetchOptions;

        expect(logger).toBeInstanceOf(FilteredLogger);

        logger?.info('log');
        logger?.debug('debug');
        logger?.warn('warning');
        logger?.error('error');

        expect(console.log).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('warning');
        expect(console.error).toHaveBeenCalledWith('error');
    });
});
