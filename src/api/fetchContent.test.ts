import {fetchContent as loadContent, FetchOptions as ResolvedFetchOptions} from '@croct/plug-react/api';
import {FetchResponse} from '@croct/plug/plug';
import {fetchContent, FetchOptions} from './fetchContent';
import {getRequestContext, RequestContext} from '@/utils/request';

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
    '@/utils/request',
    () => ({
        __esModule: true,
        getRequestContext: jest.fn(),
    }),
);

describe('fetchContent', () => {
    const apiKey = '00000000-0000-0000-0000-000000000000';
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
        jest.clearAllMocks();
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
                apiKey: apiKey,
                clientId: request.clientId,
                clientIp: '127.0.0.1',
                extra: {
                    cache: 'no-store',
                },
            },
        },
        'with full contex': {
            request: request,
            options: {},
            resolvedOptions: {
                apiKey: apiKey,
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
            },
        },
        'with URL and without referrer': {
            request: {
                clientId: request.clientId,
                uri: request.uri,
            },
            options: {},
            resolvedOptions: {
                apiKey: apiKey,
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
                apiKey: apiKey,
                clientId: request.clientId,
                clientIp: '127.0.0.1',
                extra: {
                    cache: 'force-cache',
                },
            },
        },
    }))('should forward the call %s to the fetchContent function', async (_, scenario) => {
        process.env.CROCT_API_KEY = apiKey;

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
});
