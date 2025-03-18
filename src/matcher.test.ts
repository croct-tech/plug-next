import type {NextRequest} from 'next/server';
import {createMatcher, getRequestInfo, RouterCriteria} from '@/matcher';

describe('createMatcher', () => {
    type RequestOptions = {
        path?: string,
        locale?: string,
        query?: Record<string, string>,
        headers?: Record<string, string>,
        cookies?: Record<string, string>,
    };

    function createRequestMock(options: RequestOptions = {}): NextRequest {
        const headers = options.headers ?? {};
        const cookies = options.cookies ?? {};
        const realUrl = new URL(options.path ?? '/', 'https://example.com');
        const nextUrl = new URL(realUrl.toString());

        for (const [name, value] of Object.entries(options.query ?? {})) {
            nextUrl.searchParams.set(name, value);
        }

        if (options.locale !== undefined) {
            if (nextUrl.pathname.startsWith(`/${options.locale}`)) {
                nextUrl.pathname = nextUrl.pathname.slice(options.locale.length + 2);
            }

            Object.defineProperty(nextUrl, 'locale', {
                value: options.locale,
                writable: false,
            });
        }

        return {
            url: realUrl.toString(),
            nextUrl: nextUrl,
            headers: new Headers(headers),
            cookies: {
                get: jest.fn(name => {
                    if (cookies[name] === undefined) {
                        return undefined;
                    }

                    return {
                        name: name,
                        value: cookies[name],
                    };
                }),
            },
        } as unknown as NextRequest;
    }

    type MatcherScenario = {
        name: string,
        criteria: RouterCriteria[],
        request?: RequestOptions,
        expected: boolean,
    };

    it('should fail if the source is an invalid pattern', () => {
        expect(() => createMatcher([{source: '(invalid'}]))
            .toThrow('Invalid source pattern: (invalid');
    });

    it('should fail if the condition value is an invalid pattern', () => {
        expect(() => createMatcher([{has: [{type: 'header', key: 'key', value: '[/invalid'}]}]))
            .toThrow('Invalid value pattern for header condition: [/invalid');
    });

    it.each<MatcherScenario>([
        {
            name: 'always match when no criteria is provided',
            expected: true,
            criteria: [],
        },
        {
            name: 'automatically add the locale to the criteria',
            expected: true,
            request: {
                locale: 'en',
                path: '/en/sub',
            },
            criteria: [
                {
                    source: '/sub',
                },
            ],
        },
        {
            name: 'not automatically add the locale to the criteria when locale is false',
            expected: true,
            request: {
                locale: 'en',
                path: '/en/sub',
            },
            criteria: [
                {
                    source: '/en/sub',
                    locale: false,
                },
            ],
        },
        {
            name: 'match routes matching the given pattern',
            expected: true,
            request: {
                path: '/sub/123',
            },
            criteria: [
                {
                    source: '/sub/:id',
                },
            ],
        },
        {
            name: 'not match routes not matching the given pattern',
            expected: false,
            request: {
                path: '/123',
            },
            criteria: [
                {
                    source: '/sub/:id',
                },
            ],
        },
        {
            name: 'not match a sub-path',
            expected: false,
            request: {
                path: 'prefix/sub/123',
            },
            criteria: [
                {
                    source: '/sub/:id',
                },
            ],
        },
        {
            name: 'match if the header is present',
            expected: true,
            request: {
                headers: {
                    'x-custom-header': 'value',
                },
            },
            criteria: [
                {
                    has: [
                        {
                            type: 'header',
                            key: 'x-custom-header',
                        },
                    ],
                },
            ],
        },
        {
            name: 'not match if the header is missing',
            expected: false,
            criteria: [
                {
                    has: [
                        {
                            type: 'header',
                            key: 'x-custom-header',
                        },
                    ],
                },
            ],
        },
        {
            name: 'match if the header is missing',
            expected: true,
            criteria: [
                {
                    missing: [
                        {
                            type: 'header',
                            key: 'x-custom-header',
                        },
                    ],
                },
            ],
        },
        {
            name: 'not match if the header is present',
            expected: false,
            request: {
                headers: {
                    'x-custom-header': 'value',
                },
            },
            criteria: [
                {
                    missing: [
                        {
                            type: 'header',
                            key: 'x-custom-header',
                        },
                    ],
                },
            ],
        },
        {
            name: 'match if the query parameter is present',
            expected: true,
            request: {
                query: {
                    'custom-query': 'value',
                },
            },
            criteria: [
                {
                    has: [
                        {
                            type: 'query',
                            key: 'custom-query',
                        },
                    ],
                },
            ],
        },
        {
            name: 'not match if the query parameter is missing',
            expected: false,
            criteria: [
                {
                    has: [
                        {
                            type: 'query',
                            key: 'custom-query',
                        },
                    ],
                },
            ],
        },
        {
            name: 'match if the query parameter is missing',
            expected: true,
            criteria: [
                {
                    missing: [
                        {
                            type: 'query',
                            key: 'custom-query',
                        },
                    ],
                },
            ],
        },
        {
            name: 'not match if the query parameter is present',
            expected: false,
            request: {
                query: {
                    'custom-query': 'value',
                },
            },
            criteria: [
                {
                    missing: [
                        {
                            type: 'query',
                            key: 'custom-query',
                        },
                    ],
                },
            ],
        },
        {
            name: 'match if the cookie is present',
            expected: true,
            request: {
                cookies: {
                    'custom-cookie': 'value',
                },
            },
            criteria: [
                {
                    has: [
                        {
                            type: 'cookie',
                            key: 'custom-cookie',
                        },
                    ],
                },
            ],
        },
        {
            name: 'not match if the cookie is missing',
            expected: false,
            criteria: [
                {
                    has: [
                        {
                            type: 'cookie',
                            key: 'custom-cookie',
                        },
                    ],
                },
            ],
        },
        {
            name: 'match if the cookie is missing',
            expected: true,
            criteria: [
                {
                    missing: [
                        {
                            type: 'cookie',
                            key: 'custom-cookie',
                        },
                    ],
                },
            ],
        },
        {
            name: 'not match if the cookie is present',
            expected: false,
            request: {
                cookies: {
                    'custom-cookie': 'value',
                },
            },
            criteria: [
                {
                    missing: [
                        {
                            type: 'cookie',
                            key: 'custom-cookie',
                        },
                    ],
                },
            ],
        },
        {
            name: 'match if the host matches',
            expected: true,
            criteria: [
                {
                    has: [
                        {
                            type: 'host',
                            value: 'example.com',
                        },
                    ],
                },
            ],
        },
        {
            name: 'not match if the host does not match',
            expected: false,
            criteria: [
                {
                    has: [
                        {
                            type: 'host',
                            value: 'example.org',
                        },
                    ],
                },
            ],
        },
        {
            name: 'match if all conditions are met',
            expected: true,
            request: {
                headers: {
                    'x-custom-header': 'value',
                },
                query: {
                    'custom-query': 'value',
                },
                cookies: {
                    'custom-cookie': 'value',
                },
            },
            criteria: [
                {
                    has: [
                        {
                            type: 'header',
                            key: 'x-custom-header',
                        },
                        {
                            type: 'query',
                            key: 'custom-query',
                        },
                        {
                            type: 'cookie',
                            key: 'custom-cookie',
                        },
                        {
                            type: 'host',
                            value: 'example.com',
                        },
                    ],
                },
            ],
        },
        {
            name: 'not match if any condition is not met',
            expected: false,
            request: {
                headers: {
                    'x-custom-header': 'value',
                },
                query: {
                    'custom-query': 'value',
                },
                cookies: {
                    'custom-cookie': 'value',
                },
            },
            criteria: [
                {
                    has: [
                        {
                            type: 'header',
                            key: 'x-custom-header',
                        },
                        {
                            type: 'query',
                            key: 'custom-query',
                        },
                        {
                            type: 'cookie',
                            key: 'custom-cookie',
                        },
                        {
                            type: 'host',
                            value: 'example.org',
                        },
                    ],
                },
            ],
        },
        {
            name: 'consider empty values as missing',
            expected: true,
            request: {
                headers: {
                    'x-custom-header': '',
                },
                cookies: {
                    'custom-cookie': '',
                },
                query: {
                    'custom-query': '',
                },
            },
            criteria: [
                {
                    missing: [
                        {
                            type: 'header',
                            key: 'x-custom-header',
                        },
                        {
                            type: 'cookie',
                            key: 'custom-cookie',
                        },
                        {
                            type: 'query',
                            key: 'custom-query',
                        },
                    ],
                },
            ],
        },
        {
            name: 'always match values with no condition value specified',
            expected: true,
            request: {
                headers: {
                    'x-custom-header': 'value',
                },
                cookies: {
                    'custom-cookie': 'value',
                },
                query: {
                    'custom-query': 'value',
                },
            },
            criteria: [
                {
                    has: [
                        {
                            type: 'header',
                            key: 'x-custom-header',
                        },
                        {
                            type: 'cookie',
                            key: 'custom-cookie',
                        },
                        {
                            type: 'query',
                            key: 'custom-query',
                        },
                    ],
                },
            ],
        },
        {
            name: 'match regex in the value',
            expected: true,
            request: {
                headers: {
                    'x-custom-header': 'value',
                },
                query: {
                    'custom-query': 'value',
                },
                cookies: {
                    'custom-cookie': 'value',
                },
            },
            criteria: [
                {
                    has: [
                        {
                            type: 'header',
                            key: 'x-custom-header',
                            value: 'value',
                        },
                        {
                            type: 'query',
                            key: 'custom-query',
                            value: 'value',
                        },
                        {
                            type: 'cookie',
                            key: 'custom-cookie',
                            value: 'value',
                        },
                    ],
                },
            ],
        },
    ])('should $name', scenario => {
        const {criteria, request, expected} = scenario;
        const matcher = createMatcher(criteria);

        expect(matcher(createRequestMock(request))).toBe(expected);
    });
});

describe('getRequestInfo', () => {
    type RequestOptions = {
        locale?: string,
        pathname?: string,
        basePath?: string,
    };

    function createRequestMock(url: string, options: RequestOptions = {}): NextRequest {
        const nextUrl = new URL(url);

        Object.defineProperty(nextUrl, 'pathname', {
            value: options.pathname ?? nextUrl.pathname,
            writable: false,
        });

        Object.defineProperty(nextUrl, 'basePath', {
            value: options.basePath ?? '',
            writable: false,
        });

        Object.defineProperty(nextUrl, 'locale', {
            value: options.locale,
            writable: false,
        });

        return {
            url: url,
            nextUrl: nextUrl,
        } as unknown as NextRequest;
    }

    type RequestInfoScenario = {
        locale: string,
        url: string,
        basePath: string,
        pathname: string,
        expected: {
            pathname: string,
            basePath: string,
            routePath: string,
        },
    };

    it.each<RequestInfoScenario>([
        {
            url: 'https://example.com/pt/app/pt',
            locale: 'pt',
            pathname: '/app/pt',
            basePath: '',
            expected: {
                pathname: '/app/pt',
                basePath: '/app',
                routePath: '/',
            },
        },
        {
            url: 'https://example.com/app/pt',
            locale: 'pt',
            pathname: '/app/pt',
            basePath: '/app',
            expected: {
                pathname: '/app/pt',
                basePath: '/app',
                routePath: '/app/pt',
            },
        },
        {
            url: 'https://example.com/sub',
            locale: 'en',
            pathname: '/sub',
            basePath: '',
            expected: {
                pathname: '/sub',
                basePath: '',
                routePath: '/sub',
            },
        },
        // Ensure that special characters are handled correctly
        {
            url: 'https://example.com/pt$/app/pt$',
            locale: 'pt$',
            pathname: '/app/pt$',
            basePath: '',
            expected: {
                pathname: '/app/pt$',
                basePath: '/app',
                routePath: '/',
            },
        },
    ])('extracts correct request information', ({url, locale, basePath, pathname, expected}) => {
        const request = createRequestMock(url, {
            locale: locale,
            basePath: basePath,
            pathname: pathname,
        });

        const info = getRequestInfo(request);

        expect(info.pathname).toBe(expected.pathname);
        expect(info.basePath).toBe(expected.basePath);
        expect(info.routePath).toBe(expected.routePath);

        expect(info.host).toBe(request.nextUrl.host);
        expect(info.query).toBe(request.nextUrl.searchParams);
        expect(info.headers).toBe(request.headers);
        expect(info.cookies).toBe(request.cookies);
        expect(info.locale).toBe(locale);
    });
});
