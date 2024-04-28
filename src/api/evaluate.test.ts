import {evaluate as executeQuery, EvaluationOptions as ResolvedEvaluationOptions} from '@croct/plug-react/api';
import {cql, evaluate, EvaluationOptions} from './evaluate';
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
        evaluate: jest.fn(),
    }),
);

jest.mock(
    '@/utils/request',
    () => ({
        __esModule: true,
        getRequestContext: jest.fn(),
    }),
);

describe('evaluation', () => {
    const apiKey = '00000000-0000-0000-0000-000000000000';
    const request = {
        clientId: '12345678-1234-1234-1234-123456789012',
        uri: 'http://example.com',
        referrer: 'http://referrer.com',
        clientIp: '192.0.0.1',
        clientAgent: 'user-agent',
    } satisfies RequestContext;

    beforeEach(() => {
        process.env.CROCT_API_KEY = apiKey;
    });

    describe('evaluate', () => {
        afterEach(() => {
            jest.clearAllMocks();
        });

        type EvaluateScenario = {
            request: RequestContext,
            options: EvaluationOptions<any>,
            resolvedOptions: ResolvedEvaluationOptions,
        };

        it.each<[string, EvaluateScenario]>(Object.entries({
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
            'with full context': {
                request: request,
                options: {},
                resolvedOptions: {
                    apiKey: apiKey,
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
            'with override options': {
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
            const query = 'true';
            const result = true;

            jest.mocked(getRequestContext).mockReturnValue(scenario.request);
            jest.mocked(executeQuery).mockResolvedValue(result);

            await expect(evaluate(query, scenario.options)).resolves.toBe(result);

            expect(executeQuery).toHaveBeenCalledWith(query, scenario.resolvedOptions);
        });
    });

    describe('cql', () => {
        it('should evaluate a query with no arguments', async () => {
            const result = true;

            jest.mocked(getRequestContext).mockReturnValue(request);
            jest.mocked(executeQuery).mockResolvedValue(result);

            await expect(cql`true`).resolves.toBe(result);

            expect(executeQuery).toHaveBeenCalledWith('true', {
                apiKey: apiKey,
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
            });
        });

        it('should evaluate a query with arguments', async () => {
            const result = true;

            jest.mocked(getRequestContext).mockReturnValue(request);
            jest.mocked(executeQuery).mockResolvedValue(result);

            const variable = 'variable';

            const evaluation = cql`[${1}, ${true}, ${false}, ${variable}, ${['a', 'b']}, ${{foo: 'bar'}}]`;

            await expect(evaluation).resolves.toBe(result);

            expect(executeQuery).toHaveBeenCalledWith(
                '[1, true, false, "variable", context[\'arg4\'], context[\'arg5\']]',
                {
                    apiKey: apiKey,
                    clientId: request.clientId,
                    clientIp: request.clientIp,
                    clientAgent: request.clientAgent,
                    context: {
                        attributes: {
                            arg4: ['a', 'b'],
                            arg5: {foo: 'bar'},
                        },
                        page: {
                            url: request.uri,
                            referrer: request.referrer,
                        },
                    },
                    extra: {
                        cache: 'no-store',
                    },
                },
            );
        });
    });
});
