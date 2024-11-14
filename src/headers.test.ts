import {NextRequest, NextResponse} from 'next/server';
import {NextApiRequest} from 'next';
import {CookieOptions, getCookies, getHeaders, isAppRouter, PartialRequest, PartialResponse} from '@/headers';

const mockHeaders = jest.fn();
const mockCookies = jest.fn();

jest.mock(
    'next/headers',
    () => ({
        __esModule: true,
        headers: mockHeaders,
        cookies: mockCookies,
    }),
);

describe('getHeaders', () => {
    beforeEach(() => {
        mockHeaders.mockReset();
    });

    it('should use next/headers if available', () => {
        const get = jest.fn(() => 'test');

        mockHeaders.mockReturnValue({
            get: get,
        });

        const header = getHeaders();

        expect(header.get('test')).toBe('test');

        expect(get).toHaveBeenCalledWith('test');
    });

    it('should require the request context if next/headers is not available', () => {
        const error = new Error('next/headers requires app router');

        mockHeaders.mockImplementation(() => {
            throw error;
        });

        let actualError: unknown;

        try {
            getHeaders();
        } catch (caughtError) {
            actualError = caughtError;
        }

        // Ensure it rethrows the exact same error.
        // It is important because Next uses the error type to detect dynamic routes based
        // on usage of headers or cookies
        expect(actualError).toBe(error);
    });

    type RequestContextScenario = {
        name: string,
        request: PartialRequest,
        response: PartialResponse,
    };

    it.each<RequestContextScenario>([
        ((): RequestContextScenario => {
            const request = {
                headers: new Headers(),
                cookies: {} as NextRequest['cookies'],
            } satisfies PartialRequest;

            const response: PartialResponse = {
                headers: new Headers(),
                cookies: {} as NextResponse['cookies'],
            } satisfies PartialResponse;

            request.headers.set('foo', 'bar');
            request.headers.append('bar', 'baz');
            request.headers.append('bar', 'qux');

            // Ensure it uses the request headers
            response.headers.set('foo', 'baz');

            return {
                name: 'NextRequest',
                request: request,
                response: response,
            };
        })(),
        ((): RequestContextScenario => {
            const request = {
                headers: {
                    foo: 'bar',
                    bar: ['baz', 'qux'],
                },
                cookies: {} as NextApiRequest['cookies'],
            } satisfies PartialRequest;

            const response: PartialResponse = {
                getHeader: jest.fn(() => 'baz'),
                setHeader: jest.fn(),
            } satisfies PartialResponse;

            return {
                name: 'NextApiRequest/PageRouteRequest',
                request: request,
                response: response,
            };
        })(),
    ])('should use the $name if specified', scenario => {
        const {request, response} = scenario;

        mockHeaders.mockImplementation(() => {
            throw new Error('next/headers requires app router');
        });

        const headers = getHeaders({
            req: request,
            res: response,
        });

        expect(headers.get('foo')).toBe('bar');
        expect(headers.get('bar')).toBe('baz, qux');
        expect(headers.get('test')).toBeNull();
    });
});

describe('getCookies', () => {
    beforeEach(() => {
        mockCookies.mockReset();
    });

    it('should use next/headers if available', () => {
        const get = jest.fn(() => ({value: 'foo'}));
        const set = jest.fn();

        mockCookies.mockReturnValue({
            get: get,
            set: set,
        });

        const cookies = getCookies();

        expect(cookies.get('test')).toEqual({value: 'foo'});

        const options: CookieOptions = {
            domain: 'example.com',
        };

        cookies.set('test', 'value', options);

        expect(set).toHaveBeenCalledWith('test', 'value', options);
    });

    it('should require the request context if next/headers is not available', () => {
        const error = new Error('next/headers requires app router');

        mockCookies.mockImplementation(() => {
            throw error;
        });

        let actualError: unknown;

        try {
            getCookies();
        } catch (caughtError) {
            actualError = caughtError;
        }

        // Ensure it rethrows the exact same error.
        // It is important because Next uses the error type to detect dynamic routes based
        // on usage of headers or cookies
        expect(actualError).toBe(error);
    });

    type RequestContextScenario = {
        name: string,
        request: PartialRequest,
        response: PartialResponse,
    };

    it.each<RequestContextScenario>([
        ((): RequestContextScenario => {
            const request = {
                headers: new Headers(),
                cookies: {
                    get: (name: string) => {
                        if (name === 'foo') {
                            return {value: 'bar'};
                        }

                        return undefined;
                    },
                } as NextRequest['cookies'],
            } satisfies PartialRequest;

            const response: PartialResponse = {
                headers: new Headers(),
                cookies: {
                    get: () => undefined,
                } as NextResponse['cookies'],
            } satisfies PartialResponse;

            return {
                name: 'NextRequest',
                request: request,
                response: response,
            };
        })(),
        ((): RequestContextScenario => {
            const request = {
                headers: new Headers(),
                cookies: {
                    get: () => undefined,
                } as NextRequest['cookies'],
            } satisfies PartialRequest;

            const response: PartialResponse = {
                headers: new Headers(),
                cookies: {
                    get: (name: string) => {
                        if (name === 'foo') {
                            return {value: 'bar'};
                        }

                        return undefined;
                    },
                } as NextResponse['cookies'],
            } satisfies PartialResponse;

            return {
                name: 'NextResponse',
                request: request,
                response: response,
            };
        })(),
        ((): RequestContextScenario => {
            const request = {
                headers: {
                    foo: 'bar',
                },
                cookies: {
                    foo: 'bar',
                } as NextApiRequest['cookies'],
            } satisfies PartialRequest;

            const response: PartialResponse = {
                getHeader: (): string | undefined => undefined,
                setHeader: jest.fn(),
            } satisfies PartialResponse;

            return {
                name: 'NextApiRequest/PageRouteRequest',
                request: request,
                response: response,
            };
        })(),
        ((): RequestContextScenario => {
            const request = {
                headers: {
                    foo: 'bar',
                },
                cookies: {} as NextApiRequest['cookies'],
            } satisfies PartialRequest;

            const response: PartialResponse = {
                getHeader: (name: string): string | undefined => {
                    if (name === 'Set-Cookie') {
                        return 'foo=bar';
                    }

                    return undefined;
                },
                setHeader: jest.fn(),
            } satisfies PartialResponse;

            return {
                name: 'NextApiResponse/ServerResponse',
                request: request,
                response: response,
            };
        })(),
        ((): RequestContextScenario => {
            const request = {
                headers: {
                    foo: 'bar',
                },
                cookies: {} as NextApiRequest['cookies'],
            } satisfies PartialRequest;

            const response: PartialResponse = {
                getHeader: (name: string): string[]|undefined => {
                    if (name === 'Set-Cookie') {
                        return ['foo=bar', 'bar=baz'];
                    }

                    return undefined;
                },
                setHeader: jest.fn(),
            } satisfies PartialResponse;

            return {
                name: 'NextApiResponse/ServerResponse with multiple cookies',
                request: request,
                response: response,
            };
        })(),
    ])('should use the $name if specified', scenario => {
        const {request, response} = scenario;

        mockCookies.mockImplementation(() => {
            throw new Error('next/headers requires app router');
        });

        const cookies = getCookies({
            req: request,
            res: response,
        });

        expect(cookies.get('foo')).toEqual({value: 'bar'});
        expect(cookies.get('test')).toBeUndefined();
    });

    it('should set a cookie to NextResponse', () => {
        mockCookies.mockImplementation(() => {
            throw new Error('next/headers requires app router');
        });

        const request = {
            headers: new Headers(),
            cookies: {} as NextRequest['cookies'],
        } satisfies PartialRequest;

        const response: PartialResponse = {
            headers: new Headers(),
            cookies: {
                set: jest.fn(),
            } as Partial<NextResponse['cookies']> as NextResponse['cookies'],
        } satisfies PartialResponse;

        const cookies = getCookies({
            req: request,
            res: response,
        });

        const options: CookieOptions = {
            domain: 'example.com',
        };

        cookies.set('test', 'value', options);

        expect(response.cookies.set).toHaveBeenCalledWith('test', 'value', options);
    });

    it('should set a cookie to NextApiResponse/ServerResponse', () => {
        mockCookies.mockImplementation(() => {
            throw new Error('next/headers requires app router');
        });

        const request = {
            headers: new Headers(),
            cookies: {} as NextRequest['cookies'],
        } satisfies PartialRequest;

        const response: PartialResponse = {
            getHeader: jest.fn(),
            setHeader: jest.fn(),
        } satisfies PartialResponse;

        const cookies = getCookies({
            req: request,
            res: response,
        });

        const options: CookieOptions = {
            domain: 'example.com',
        };

        cookies.set('test', 'value', options);

        expect(response.setHeader).toHaveBeenCalledWith('Set-Cookie', ['test=value; Domain=example.com']);
    });

    it('should preserve existing cookies when setting a new cookie', () => {
        mockCookies.mockImplementation(() => {
            throw new Error('next/headers requires app router');
        });

        const request = {
            headers: new Headers(),
            cookies: {} as NextRequest['cookies'],
        } satisfies PartialRequest;

        const response: PartialResponse = {
            getHeader: (name: string): string[]|undefined => {
                if (name === 'Set-Cookie') {
                    return [
                        'foo=bar',
                        'bar=baz',
                        'test=old; secure',
                    ];
                }

                return undefined;
            },
            setHeader: jest.fn(),
        } satisfies PartialResponse;

        const cookies = getCookies({
            req: request,
            res: response,
        });

        const now = Date.now();

        const options: CookieOptions = {
            domain: 'example.com',
            expires: now,
        };

        cookies.set('test', 'value', options);

        expect(response.setHeader).toHaveBeenCalledWith(
            'Set-Cookie',
            [
                'foo=bar',
                'bar=baz',
                `test=value; Domain=example.com; Expires=${new Date(now).toUTCString()}`,
            ],
        );
    });
});

describe('isAppRouter', () => {
    beforeEach(() => {
        mockHeaders.mockReset();
    });

    it('should return true if next/headers is available', () => {
        expect(isAppRouter()).toBe(true);
    });

    it('should return false if next/headers is not available', () => {
        mockHeaders.mockImplementation(() => {
            throw new Error('next/headers requires app router');
        });

        expect(isAppRouter()).toBe(false);
    });
});
