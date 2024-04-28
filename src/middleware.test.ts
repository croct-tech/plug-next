import {NextRequest, NextResponse, NextFetchEvent} from 'next/server';
import {uuid4} from '@croct/sdk/uuid';
import parseSetCookies, {Cookie} from 'set-cookie-parser';
import {Header, QueryParameter} from '@/utils/http';
import {config, withCroct} from '@/middleware';

jest.mock(
    'next/server',
    () => ({
        ...jest.requireActual('next/server'),
        NextResponse: {
            next: jest.fn(),
        },
    }),
);

describe('middleware', () => {
    const ENV_VARS = {...process.env};

    function createRequestMock(): NextRequest {
        const cookies: Record<string, string> = {};

        return {
            get nextUrl() {
                return new URL('https://example.com/');
            },
            get ip() {
                return undefined;
            },
            headers: new Headers(),
            cookies: {
                get: jest.fn(name => {
                    if (cookies[name] === undefined) {
                        return null;
                    }

                    return {
                        name: name,
                        value: cookies[name],
                    };
                }),
                set: jest.fn((name, value) => {
                    cookies[name] = value;
                }),
            },
        } as unknown as NextRequest;
    }

    function createResponseMock(): NextResponse {
        return {
            headers: new Headers(),
            cookies: {
                set: jest.fn(),
                delete: jest.fn(),
            },
        } as unknown as NextResponse;
    }

    const fetchEvent = {} as unknown as NextFetchEvent;

    type EnvVars = {
        cidDomain?: string,
        cidCookieName?: string,
        cidDuration?: string,
        previewCookieName?: string,
        previewCookieDuration?: string,
    };

    function setEnvVars(vars: EnvVars): void {
        if (vars.cidDomain !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DOMAIN = vars.cidDomain;
        }

        if (vars.cidCookieName !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_NAME = vars.cidCookieName;
        }

        if (vars.cidDuration !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION = vars.cidDuration;
        }

        if (vars.previewCookieName !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_NAME = vars.previewCookieName;
        }

        if (vars.previewCookieDuration !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_DURATION = vars.previewCookieName;
        }
    }

    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DOMAIN;
        delete process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_NAME;
        delete process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION;
        delete process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_NAME;
        delete process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_DURATION;
    });

    afterEach(() => {
        jest.clearAllMocks();
        process.env = {...ENV_VARS};
    });

    const previewToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwczovL2Nyb2N0LmlvIiwi'
        + 'YXVkIjoiaHR0cHM6Ly9jcm9jdC5pbyIsImlhdCI6MTQ0MDk3OTEwMCwiZXhwIjoxNDQwOTc5M'
        + 'jAwLCJtZXRhZGF0YSI6eyJleHBlcmllbmNlTmFtZSI6IkRldmVsb3BlcnMgZXhwZXJpZW5jZS'
        + 'IsImV4cGVyaW1lbnROYW1lIjoiRGV2ZWxvcGVycyBleHBlcmltZW50IiwiYXVkaWVuY2VOYW1l'
        + 'IjoiRGV2ZWxvcGVycyBhdWRpZW5jZSIsInZhcmlhbnROYW1lIjoiSmF2YVNjcmlwdCBEZXZlbG'
        + '9wZXJzIn19.';

    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    type CidScenario = {
        envVars: EnvVars,
        cookie: Omit<Cookie, 'value'>,
    };

    it.each<[string, CidScenario]>(Object.entries({
        'no environment variables': {
            envVars: {},
            cookie: {
                name: 'cid',
                secure: true,
                path: '/',
                sameSite: 'Strict',
                maxAge: 31536000,
            },
        },
        'empty environment variables': {
            envVars: {
                cidDomain: '',
                cidCookieName: '',
                cidDuration: '',
            },
            cookie: {
                name: 'cid',
                secure: true,
                path: '/',
                sameSite: 'Strict',
                maxAge: 31536000,
            },
        },
        'custom environment variables': {
            envVars: {
                cidDomain: 'croct.com',
                cidDuration: '60',
                cidCookieName: 'custom_cid',
                previewCookieDuration: '30',
                previewCookieName: 'custom_preview',
            },
            cookie: {
                name: 'custom_cid',
                secure: true,
                path: '/',
                sameSite: 'Strict',
                maxAge: 60,
                domain: 'croct.com',
            },
        },
    }))('should assign a new client ID if none is present with %s', async (_, scenario) => {
        const request = createRequestMock();
        const response = createResponseMock();

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        setEnvVars(scenario.envVars);

        await expect(withCroct()(request, fetchEvent)).resolves.toBe(response);

        const clientId = request.headers.get(Header.CLIENT_ID)!;

        expect(clientId).toEqual(expect.stringMatching(UUID_PATTERN));

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeSameMembers([
            {
                ...scenario.cookie,
                value: clientId,
            },
        ]);
    });

    it.each<[string, string]>(Object.entries({
        'not a number': 'invalid',
        'negative number': '-1',
    }))('should throw an error if the CID duration is %s', async (_, duration) => {
        const request = createRequestMock();
        const response = createResponseMock();

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        setEnvVars({
            cidDuration: duration,
        });

        await expect(withCroct()(request, fetchEvent)).rejects.toThrow(
            `Environment variable NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION must be a positive integer, got ${duration}`,
        );
    });

    it('should forward the URL through the request headers', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const nextMiddleware = jest.fn().mockResolvedValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(request.headers.get(Header.REQUEST_URI)).toEqual(request.nextUrl.toString());
    });

    it('should forward the URL without the preview token through the request headers', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const baseUrl = 'https://example.com/';
        const url = new URL(baseUrl);

        url.searchParams.set(QueryParameter.PREVIEW_TOKEN, '1234');

        jest.spyOn(request, 'nextUrl', 'get').mockReturnValue(url as NextRequest['nextUrl']);

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware = jest.fn().mockResolvedValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(request.headers.get(Header.REQUEST_URI)).toEqual(baseUrl);
    });

    it('should extend the client ID cookie', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const clientId = uuid4();
        const cookieName = 'custom_cid';

        setEnvVars({
            cidCookieName: cookieName,
        });

        request.cookies.set(cookieName, clientId);

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        await expect(withCroct()(request, fetchEvent)).resolves.toBe(response);

        expect(request.headers.get(Header.CLIENT_ID)).toBe(clientId);

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeSameMembers([
            {
                name: 'custom_cid',
                maxAge: 31536000,
                secure: true,
                path: '/',
                sameSite: 'Strict',
                value: clientId,
            },
        ]);
    });

    it('should forward the user-agent through the request headers', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

        request.headers.set('user-agent', userAgent);

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware = jest.fn().mockResolvedValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(request.headers.get(Header.USER_AGENT)).toBe(userAgent);
    });

    it('should forward the client IP through the request headers', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const ip = '127.0.0.1';

        jest.spyOn(request, 'ip', 'get').mockReturnValue(ip);

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware = jest.fn().mockResolvedValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(request.headers.get(Header.CLIENT_IP)).toBe(ip);
    });

    it('should store preview tokens in cookies and forward them through the request headers', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_preview';
        const duration = '30';

        setEnvVars({
            previewCookieName: cookieName,
            previewCookieDuration: duration,
        });

        const url = new URL('https://example.com/');

        url.searchParams.set(QueryParameter.PREVIEW_TOKEN, previewToken);

        jest.spyOn(request, 'nextUrl', 'get').mockReturnValue(url as NextRequest['nextUrl']);

        jest.useFakeTimers({now: 0});

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware = jest.fn().mockResolvedValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(request.headers.get(Header.PREVIEW_TOKEN)).toBe(previewToken);

        const cookies = parseSetCookies(response.headers.getSetCookie())
            .find(({name}) => name === cookieName);

        expect(cookies).toEqual({
            name: 'custom_preview',
            sameSite: 'Strict',
            httpOnly: true,
            secure: true,
            value: previewToken,
        });
    });

    it('should remove the preview token cookie when leaving the preview', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_preview';
        const duration = '30';

        setEnvVars({
            previewCookieName: cookieName,
            previewCookieDuration: duration,
        });

        const url = new URL('https://example.com/');

        url.searchParams.set(QueryParameter.PREVIEW_TOKEN, 'exit');

        jest.spyOn(request, 'nextUrl', 'get').mockReturnValue(url as NextRequest['nextUrl']);

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware = jest.fn().mockReturnValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(request.headers.get(Header.PREVIEW_TOKEN)).toBeNull();

        const cookie = parseSetCookies(response.headers.getSetCookie())
            .find(({name}) => name === cookieName);

        expect(cookie).toEqual({
            name: cookieName,
            maxAge: 0,
            secure: true,
            httpOnly: true,
            value: '',
        });
    });

    it('should ignore expired preview tokens', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_preview';
        const duration = '30';

        setEnvVars({
            previewCookieName: cookieName,
            previewCookieDuration: duration,
        });

        const url = new URL('https://example.com/');

        url.searchParams.set(QueryParameter.PREVIEW_TOKEN, previewToken);

        jest.spyOn(request, 'nextUrl', 'get').mockReturnValue(url as NextRequest['nextUrl']);

        jest.useFakeTimers({now: Number.MAX_SAFE_INTEGER});

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware = jest.fn().mockReturnValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        const cookie = parseSetCookies(response.headers.getSetCookie())
            .find(({name}) => name === cookieName);

        expect(cookie).toEqual({
            name: cookieName,
            maxAge: 0,
            secure: true,
            httpOnly: true,
            value: '',
        });
    });

    it('should ignore invalid preview tokens', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_preview';
        const duration = '30';

        setEnvVars({
            previewCookieName: cookieName,
            previewCookieDuration: duration,
        });

        const url = new URL('https://example.com/');

        url.searchParams.set(QueryParameter.PREVIEW_TOKEN, 'invalid');

        jest.spyOn(request, 'nextUrl', 'get').mockReturnValue(url as NextRequest['nextUrl']);

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware = jest.fn().mockReturnValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(request.headers.get(Header.PREVIEW_TOKEN)).toBeNull();

        const cookie = parseSetCookies(response.headers.getSetCookie())
            .find(({name}) => name === cookieName);

        expect(cookie).toEqual({
            name: cookieName,
            maxAge: 0,
            secure: true,
            httpOnly: true,
            value: '',
        });
    });

    it.each<string>([
        'foo',
        'foo/bar',
        'foo/bar/baz',
        'foo/bar/baz/qux',
    ])('should intercept requests to "%s"', url => {
        expect(config.matcher).toHaveLength(1);
        expect(new RegExp(config.matcher[0]).test(url)).toBe(true);
    });

    it.each<string>([
        '/api',
        '/_next/static',
        '/_next/image',
        '/favicon.ico',
    ])('should not intercept requests to "%s"', url => {
        expect(config.matcher).toHaveLength(1);
        expect(new RegExp(config.matcher[0]).test(url)).toBe(false);
    });
});
