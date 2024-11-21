/* eslint-disable testing-library/no-debugging-utils -- Needed for testing */
import {evaluate as executeQuery, EvaluationOptions as ResolvedEvaluationOptions} from '@croct/plug-react/api';
import {ApiKey, ApiKey as MockApiKey} from '@croct/sdk/apiKey';
import {FilteredLogger} from '@croct/sdk/logging/filteredLogger';
import {headers} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';
import {cql, evaluate, EvaluationOptions} from './evaluate';
import {resolveRequestContext, RequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';
import {getApiKey} from '@/config/security';
import {RouteContext} from '@/headers';

jest.mock(
    'next/headers',
    () => ({
        __esModule: true,
        headers: jest.fn(),
        cookies: jest.fn(),
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

describe('evaluation', () => {
    const apiKey = getApiKey().getIdentifier();
    const request = {
        clientId: '12345678-1234-1234-1234-123456789012',
        uri: 'http://example.com',
        referrer: 'http://referrer.com',
        clientIp: '192.0.0.1',
        clientAgent: 'user-agent',
    } satisfies RequestContext;

    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_DEBUG;
        delete process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL;
    });

    afterEach(() => {
        jest.mocked(headers).mockReset();
        jest.mocked(resolveRequestContext).mockReset();
        jest.mocked(executeQuery).mockReset();
        jest.mocked(getDefaultFetchTimeout).mockReset();
    });

    describe('evaluate', () => {
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
                    apiKey: ApiKey.from(apiKey),
                    clientId: request.clientId,
                    clientIp: '127.0.0.1',
                    extra: {
                        cache: 'force-cache',
                    },
                    logger: expect.any(FilteredLogger),
                },
            },
        }))('should forward the call %s to the evaluate function', async (_, scenario) => {
            const query = 'true';
            const result = true;

            jest.mocked(resolveRequestContext).mockReturnValue(scenario.request);
            jest.mocked(executeQuery).mockResolvedValue(result);

            await expect(evaluate(query, scenario.options)).resolves.toBe(result);

            expect(executeQuery).toHaveBeenCalledWith(query, scenario.resolvedOptions);
        });

        it('should forward the route context', async () => {
            const route: RouteContext = {
                req: {} as NextRequest,
                res: {} as NextResponse,
            };

            jest.mocked(resolveRequestContext).mockReturnValue(request);
            jest.mocked(executeQuery).mockResolvedValue(true);

            await expect(evaluate('true', {route: route})).resolves.toBe(true);

            expect(resolveRequestContext).toHaveBeenCalledWith(route);
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

            await expect(evaluate('true')).rejects.toBe(error);
        });

        it('should report an error if the route context is missing', async () => {
            jest.mocked(resolveRequestContext).mockImplementation(() => {
                throw new Error('next/headers requires app router');
            });

            await expect(evaluate('true')).rejects.toThrow(
                'Error resolving request context: next/headers requires app router. '
                + 'This error typically occurs when evaluate() is called outside of app routes '
                + 'without specifying the `route` option. '
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

            await expect(evaluate('true', {route: route})).rejects.toBe(error);
        });

        it('should log warnings and errors', async () => {
            jest.spyOn(console, 'log').mockImplementation();
            jest.spyOn(console, 'debug').mockImplementation();
            jest.spyOn(console, 'warn').mockImplementation();
            jest.spyOn(console, 'error').mockImplementation();
            jest.spyOn(console, 'info').mockImplementation();

            jest.mocked(executeQuery).mockResolvedValue(true);
            jest.mocked(resolveRequestContext).mockReturnValue(request);

            await evaluate('true');

            const {logger} = jest.mocked(executeQuery).mock.calls[0][1];

            expect(logger).not.toBeUndefined();

            logger?.info('info');
            logger?.debug('debug');
            logger?.warn('warning');
            logger?.error('error');

            expect(console.info).not.toHaveBeenCalled();
            expect(console.debug).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalledWith('warning');
            expect(console.error).toHaveBeenCalledWith('error');

            expect(console.log).not.toHaveBeenCalled();
        });

        it('should log all messages if the debug mode is enabled', async () => {
            process.env.NEXT_PUBLIC_CROCT_DEBUG = 'true';

            jest.spyOn(console, 'log').mockImplementation();
            jest.spyOn(console, 'debug').mockImplementation();
            jest.spyOn(console, 'warn').mockImplementation();
            jest.spyOn(console, 'error').mockImplementation();
            jest.spyOn(console, 'info').mockImplementation();

            jest.mocked(executeQuery).mockResolvedValue(true);
            jest.mocked(resolveRequestContext).mockReturnValue(request);

            await evaluate('true');

            const {logger} = jest.mocked(executeQuery).mock.calls[0][1];

            expect(logger).not.toBeUndefined();

            logger?.info('info');
            logger?.debug('debug');
            logger?.warn('warning');
            logger?.error('error');

            expect(console.info).toHaveBeenCalledWith('info');
            expect(console.debug).toHaveBeenCalledWith('debug');
            expect(console.warn).toHaveBeenCalledWith('warning');
            expect(console.error).toHaveBeenCalledWith('error');

            expect(console.log).not.toHaveBeenCalled();
        });

        it('should use the base endpoint URL from the environment', async () => {
            process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL = 'https://example.com';

            jest.mocked(resolveRequestContext).mockReturnValue(request);
            jest.mocked(executeQuery).mockResolvedValue(true);

            await evaluate('true');

            expect(executeQuery).toHaveBeenCalledWith('true', expect.objectContaining({
                baseEndpointUrl: process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL,
            }));
        });

        it('should use the default fetch timeout', async () => {
            const query = 'true';
            const result = true;
            const defaultTimeout = 1000;

            jest.mocked(resolveRequestContext).mockReturnValue(request);
            jest.mocked(getDefaultFetchTimeout).mockReturnValue(defaultTimeout);
            jest.mocked(executeQuery).mockResolvedValue(result);

            await expect(evaluate(query)).resolves.toBe(result);

            expect(executeQuery).toHaveBeenCalledWith(query, expect.objectContaining({
                timeout: defaultTimeout,
            }));
        });

        it('should override the default fetch timeout', async () => {
            const query = 'true';
            const result = true;
            const defaultTimeout = 1000;
            const timeout = 2000;

            jest.mocked(resolveRequestContext).mockReturnValue(request);
            jest.mocked(getDefaultFetchTimeout).mockReturnValue(defaultTimeout);
            jest.mocked(executeQuery).mockResolvedValue(result);

            await expect(evaluate(query, {timeout: timeout})).resolves.toBe(result);

            expect(executeQuery).toHaveBeenCalledWith(query, {
                apiKey: ApiKey.from(apiKey),
                clientId: request.clientId,
                clientIp: request.clientIp,
                clientAgent: request.clientAgent,
                timeout: timeout,
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
            });
        });
    });

    describe('cql', () => {
        beforeEach(() => {
            jest.mocked(headers).mockReset();
        });

        it('should throw an error if used outside the App Router', async () => {
            jest.mocked(headers).mockImplementation(() => {
                throw new Error('next/headers requires app router');
            });

            await expect(cql`true`).rejects.toThrow(
                'cql() can only be used with App Router. '
                + 'For help, see https://croct.help/sdk/nextjs/missing-route-context',
            );
        });

        it('should evaluate a query with no arguments', async () => {
            const result = true;

            jest.mocked(resolveRequestContext).mockReturnValue(request);
            jest.mocked(executeQuery).mockResolvedValue(result);

            await expect(cql`true`).resolves.toBe(result);

            expect(executeQuery).toHaveBeenCalledWith('true', {
                apiKey: ApiKey.from(apiKey),
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
            });
        });

        it('should evaluate a query with arguments', async () => {
            const result = true;

            jest.mocked(resolveRequestContext).mockReturnValue(request);
            jest.mocked(executeQuery).mockResolvedValue(result);

            const variable = 'variable';

            const evaluation = cql`[${1}, ${true}, ${false}, ${variable}, ${['a', 'b']}, ${{foo: 'bar'}}]`;

            await expect(evaluation).resolves.toBe(result);

            expect(executeQuery).toHaveBeenCalledWith(
                '[1, true, false, "variable", context[\'arg4\'], context[\'arg5\']]',
                {
                    apiKey: ApiKey.from(apiKey),
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
                    logger: expect.any(FilteredLogger),
                },
            );
        });
    });
});
