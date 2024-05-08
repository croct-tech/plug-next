import {NextRequest, NextResponse, NextFetchEvent, NextMiddleware} from 'next/server';
import parseSetCookies, {Cookie} from 'set-cookie-parser';
import {Token} from '@croct/sdk/token';
import {v4 as uuid} from 'uuid';
import {ApiKey} from '@croct/sdk/apiKey';
import {Header, QueryParameter} from '@/config/http';
import {config, withCroct} from '@/middleware';
import {getAppId} from '@/config/appId';

jest.mock(
    'uuid',
    () => ({
        v4: jest.fn(() => '00000000-0000-0000-0000-000000000000'),
    }),
);

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
                        return undefined;
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
        cidCookieDomain?: string,
        cidCookieName?: string,
        cidCookieDuration?: string,
        userTokenCookieDomain?: string,
        userTokenCookieName?: string,
        userTokenCookieDuration?: string,
        previewCookieName?: string,
        apiKey?: string,
        appId?: string,
        enableTokenAuthentication?: boolean,
    };

    function setEnvVars(vars: EnvVars): void {
        if (vars.cidCookieDomain !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DOMAIN = vars.cidCookieDomain;
        }

        if (vars.cidCookieName !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_NAME = vars.cidCookieName;
        }

        if (vars.cidCookieDuration !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION = vars.cidCookieDuration;
        }

        if (vars.userTokenCookieDomain !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DOMAIN = vars.userTokenCookieDomain;
        }

        if (vars.userTokenCookieName !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_NAME = vars.userTokenCookieName;
        }

        if (vars.userTokenCookieDuration !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION = vars.userTokenCookieDuration;
        }

        if (vars.previewCookieName !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_NAME = vars.previewCookieName;
        }

        if (vars.apiKey !== undefined) {
            process.env.CROCT_API_KEY = vars.apiKey;
        }

        if (vars.appId !== undefined) {
            process.env.NEXT_PUBLIC_CROCT_APP_ID = vars.appId;
        }

        if (vars.enableTokenAuthentication !== undefined) {
            process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION = vars.enableTokenAuthentication ? 'false' : 'true';
        }
    }

    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DOMAIN;
        delete process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_NAME;
        delete process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION;
        delete process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DOMAIN;
        delete process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_NAME;
        delete process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION;
        delete process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_NAME;
        delete process.env.CROCT_API_KEY;
        delete process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION;

        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
    });

    afterEach(() => {
        process.env = {...ENV_VARS};
        jest.useRealTimers();
    });

    const previewToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwczovL2Nyb2N0LmlvIiwi'
        + 'YXVkIjoiaHR0cHM6Ly9jcm9jdC5pbyIsImlhdCI6MTQ0MDk3OTEwMCwiZXhwIjoxNDQwOTc5M'
        + 'jAwLCJtZXRhZGF0YSI6eyJleHBlcmllbmNlTmFtZSI6IkRldmVsb3BlcnMgZXhwZXJpZW5jZS'
        + 'IsImV4cGVyaW1lbnROYW1lIjoiRGV2ZWxvcGVycyBleHBlcmltZW50IiwiYXVkaWVuY2VOYW1l'
        + 'IjoiRGV2ZWxvcGVycyBhdWRpZW5jZSIsInZhcmlhbnROYW1lIjoiSmF2YVNjcmlwdCBEZXZlbG'
        + '9wZXJzIn19.';

    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    type ClientIdEnvScenario = {
        envVars: EnvVars,
        cookie: Omit<Cookie, 'value'>,
    };

    it.each<[string, ClientIdEnvScenario]>(Object.entries({
        'no environment variables': {
            envVars: {},
            cookie: {
                name: 'ct.client_id',
                secure: true,
                path: '/',
                sameSite: 'Strict',
                maxAge: 31536000,
            },
        },
        'empty environment variables': {
            envVars: {
                cidCookieDomain: '',
                cidCookieName: '',
                cidCookieDuration: '',
            },
            cookie: {
                name: 'ct.client_id',
                secure: true,
                path: '/',
                sameSite: 'Strict',
                maxAge: 31536000,
            },
        },
        'custom environment variables': {
            envVars: {
                cidCookieDomain: 'croct.com',
                cidCookieDuration: '60',
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

        const clientId = request.headers.get(Header.CLIENT_ID);

        expect(clientId).toEqual(expect.stringMatching(UUID_PATTERN));

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            ...scenario.cookie,
            value: clientId,
        }]);
    });

    it.each<[string, string]>(Object.entries({
        'not a number': 'invalid',
        'negative number': '-1',
    }))('should throw an error if the CID duration is %s', async (_, duration) => {
        const request = createRequestMock();
        const response = createResponseMock();

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        setEnvVars({
            cidCookieDuration: duration,
        });

        await expect(withCroct()(request, fetchEvent)).rejects.toThrow(
            `Croct's cookie duration must be a positive integer, got '${duration}'.`
            + ' Please check the NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION environment variable.',
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

    it.each([
        ['00000000-0000-0000-0000-000000000001'],
        ['00000000000000000000000000000002'],
    ])('should extend the client ID %s', async clientId => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_cid';

        setEnvVars({
            cidCookieName: cookieName,
        });

        request.cookies.set(cookieName, clientId);

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        await expect(withCroct()(request, fetchEvent)).resolves.toBe(response);

        expect(request.headers.get(Header.CLIENT_ID)).toBe(clientId);

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            name: 'custom_cid',
            maxAge: 31536000,
            secure: true,
            path: '/',
            sameSite: 'Strict',
            value: clientId,
        }]);
    });

    it('should generate a new client ID if the value is invalid', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_cid';

        setEnvVars({
            cidCookieName: cookieName,
        });

        request.cookies.set(cookieName, 'invalid');

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        await expect(withCroct()(request, fetchEvent)).resolves.toBe(response);

        const clientId = request.headers.get(Header.CLIENT_ID);

        expect(clientId).toEqual(expect.stringMatching(UUID_PATTERN));

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            name: 'custom_cid',
            maxAge: 31536000,
            secure: true,
            path: '/',
            sameSite: 'Strict',
            value: clientId,
        }]);
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

        setEnvVars({
            previewCookieName: cookieName,
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

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            name: cookieName,
            path: '/',
            sameSite: 'Strict',
            secure: true,
            value: previewToken,
        }]);
    });

    it('should delete the preview token cookie when leaving the preview', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_preview';

        setEnvVars({
            previewCookieName: cookieName,
        });

        const url = new URL('https://example.com/');

        url.searchParams.set(QueryParameter.PREVIEW_TOKEN, 'exit');

        jest.spyOn(request, 'nextUrl', 'get').mockReturnValue(url as NextRequest['nextUrl']);

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware: NextMiddleware = jest.fn().mockReturnValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(request.headers.get(Header.PREVIEW_TOKEN)).toBeNull();

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            name: cookieName,
            maxAge: 0,
            secure: true,
            httpOnly: true,
            value: '',
        }]);
    });

    it('should ignore expired preview tokens', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_preview';

        setEnvVars({
            previewCookieName: cookieName,
        });

        const url = new URL('https://example.com/');

        url.searchParams.set(QueryParameter.PREVIEW_TOKEN, previewToken);

        jest.spyOn(request, 'nextUrl', 'get').mockReturnValue(url as NextRequest['nextUrl']);

        jest.useFakeTimers({now: Number.MAX_SAFE_INTEGER});

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware: NextMiddleware = jest.fn().mockReturnValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            name: cookieName,
            maxAge: 0,
            secure: true,
            httpOnly: true,
            value: '',
        }]);
    });

    it('should ignore invalid preview tokens', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_preview';

        setEnvVars({
            previewCookieName: cookieName,
        });

        const url = new URL('https://example.com/');

        url.searchParams.set(QueryParameter.PREVIEW_TOKEN, 'invalid');

        jest.spyOn(request, 'nextUrl', 'get').mockReturnValue(url as NextRequest['nextUrl']);

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const nextMiddleware: NextMiddleware = jest.fn().mockReturnValue(response);

        await expect(withCroct(nextMiddleware)(request, fetchEvent)).resolves.toBe(response);

        expect(nextMiddleware).toHaveBeenCalledWith(request, fetchEvent);

        expect(request.headers.get(Header.PREVIEW_TOKEN)).toBeNull();

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            name: cookieName,
            maxAge: 0,
            secure: true,
            httpOnly: true,
            value: '',
        }]);
    });

    type UserTokenEnvScenario = {
        envVars: EnvVars,
        cookie: Omit<Cookie, 'value'>,
    };

    it.each<[string, UserTokenEnvScenario]>(Object.entries({
        'no environment variables': {
            envVars: {},
            cookie: {
                name: 'ct.user_token',
                secure: true,
                path: '/',
                sameSite: 'Strict',
                maxAge: 604800,
            },
        },
        'empty environment variables': {
            envVars: {
                userTokenCookieDomain: '',
                userTokenCookieName: '',
                userTokenCookieDuration: '',
            },
            cookie: {
                name: 'ct.user_token',
                secure: true,
                path: '/',
                sameSite: 'Strict',
                maxAge: 604800,
            },
        },
        'custom environment variables': {
            envVars: {
                userTokenCookieDomain: 'croct.com',
                userTokenCookieDuration: '60',
                userTokenCookieName: 'custom_ut',
            },
            cookie: {
                name: 'custom_ut',
                secure: true,
                path: '/',
                sameSite: 'Strict',
                maxAge: 60,
                domain: 'croct.com',
            },
        },
    }))('should assign a new user token if none is present with %s', async (_, scenario) => {
        const request = createRequestMock();
        const response = createResponseMock();

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        setEnvVars(scenario.envVars);

        await expect(withCroct()(request, fetchEvent)).resolves.toBe(response);

        const userToken = request.headers.get(Header.USER_TOKEN);

        expect(userToken).not.toBeNull();

        const parsedToken = Token.parse(userToken!);

        expect(parsedToken.isAnonymous()).toBe(true);
        expect(parsedToken.getApplicationId()).toBe(getAppId());
        expect(parsedToken.getTokenId()).toEqual(expect.stringMatching(UUID_PATTERN));

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            ...scenario.cookie,
            value: userToken,
        }]);
    });

    it('should assign a new user token the current one is invalid', async () => {
        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_ut';

        setEnvVars({
            userTokenCookieName: cookieName,
        });

        request.cookies.set(cookieName, 'invalid');

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        await expect(withCroct()(request, fetchEvent)).resolves.toBe(response);

        const userToken = request.headers.get(Header.USER_TOKEN);

        expect(userToken).not.toBeNull();
        expect(userToken).not.toBe('invalid');

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            name: cookieName,
            maxAge: 604800,
            secure: true,
            path: '/',
            sameSite: 'Strict',
            value: userToken,
        }]);
    });

    type UserTokenChangeScenario = {
        now?: number,
        authentication: boolean,
        currentApiKey?: string,
        currentUserId?: string|null,
        requestToken?: {
            apiKey?: string,
            userId: string|null,
            expiration: number,
            issueTime: number,
            signed: boolean,
        },
        expectTokenChange: boolean,
        expectSignedToken: boolean,
    };

    it.each<[string, UserTokenChangeScenario]>(
        Object.entries<UserTokenChangeScenario>({
            'a new authenticated token if no token is present in the request': {
                authentication: true,
                currentUserId: null,
                expectTokenChange: true,
                expectSignedToken: true,
            },
            'a new unauthenticated token if no token is present in the request': {
                authentication: false,
                currentUserId: null,
                expectTokenChange: true,
                expectSignedToken: false,
            },
            'a new authenticated token if the request token is expired': {
                now: 1714881454,
                authentication: true,
                currentUserId: null,
                requestToken: {
                    expiration: 1714881454 - 1000,
                    issueTime: 1714881454 - 2000,
                    userId: null,
                    signed: false,
                },
                expectTokenChange: true,
                expectSignedToken: true,
            },
            'a new unauthenticated token if the request token is expired': {
                now: 1714881454,
                authentication: false,
                currentUserId: null,
                requestToken: {
                    expiration: 1714881454 - 1000,
                    issueTime: 1714881454 - 2000,
                    userId: null,
                    signed: true,
                },
                expectTokenChange: true,
                expectSignedToken: false,
            },
            'a new authenticated token if the request token is in the future': {
                now: 1714881454,
                authentication: true,
                currentUserId: null,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454 + 1000,
                    userId: null,
                    signed: false,
                },
                expectTokenChange: true,
                expectSignedToken: true,
            },
            'a new unauthenticated token if the request token is in the future': {
                now: 1714881454,
                authentication: false,
                currentUserId: null,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454 + 1000,
                    userId: null,
                    signed: true,
                },
                expectTokenChange: true,
                expectSignedToken: false,
            },
            'a new authenticated token if the request token is anonymous and there is a logged user': {
                now: 1714881454,
                authentication: true,
                currentUserId: '00000000-0000-0000-0000-000000000002',
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: null,
                    signed: true,
                },
                expectTokenChange: true,
                expectSignedToken: true,
            },
            'a new unauthenticated token if the request token is anonymous and there is a logged user': {
                now: 1714881454,
                authentication: false,
                currentUserId: '00000000-0000-0000-0000-000000000002',
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: null,
                    signed: true,
                },
                expectTokenChange: true,
                expectSignedToken: false,
            },
            'a new authenticated token if the request token is identified and the user is anonymous': {
                now: 1714881454,
                currentUserId: null,
                authentication: true,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: true,
                },
                expectTokenChange: true,
                expectSignedToken: true,
            },
            'a new unauthenticated token if the request token is identified and the user is anonymous': {
                now: 1714881454,
                authentication: false,
                currentUserId: null,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: false,
                },
                expectTokenChange: true,
                expectSignedToken: false,
            },
            'a new authenticated token if the user changes': {
                now: 1714881454,
                authentication: true,
                currentUserId: '00000000-0000-0000-0000-000000000002',
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: true,
                },
                expectTokenChange: true,
                expectSignedToken: true,
            },
            'a new unauthenticated token if the user changes': {
                now: 1714881454,
                authentication: false,
                currentUserId: '00000000-0000-0000-0000-000000000002',
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: false,
                },
                expectTokenChange: true,
                expectSignedToken: false,
            },
            'a new authenticated token if the API key changes': {
                now: 1714881454,
                authentication: true,
                currentApiKey: '00000000-0000-0000-0000-000000000002',
                currentUserId: '00000000-0000-0000-0000-000000000001',
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    apiKey: '00000000-0000-0000-0000-000000000001',
                    signed: true,
                },
                expectTokenChange: true,
                expectSignedToken: true,
            },
            'a new authenticated token if the token is unauthenticated': {
                now: 1714881454,
                authentication: true,
                currentUserId: '00000000-0000-0000-0000-000000000001',
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: false,
                },
                expectTokenChange: true,
                expectSignedToken: true,
            },
            'the same authenticated token the user is the same': {
                now: 1714881454,
                currentUserId: '00000000-0000-0000-0000-000000000001',
                authentication: true,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: true,
                },
                expectTokenChange: false,
                expectSignedToken: true,
            },
            'the same unauthenticated token the user is the same': {
                now: 1714881454,
                currentUserId: '00000000-0000-0000-0000-000000000001',
                authentication: false,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: false,
                },
                expectTokenChange: false,
                expectSignedToken: false,
            },
            'the same authenticated anonymous token if the user is anonymous': {
                now: 1714881454,
                currentUserId: null,
                authentication: true,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: null,
                    signed: true,
                },
                expectTokenChange: false,
                expectSignedToken: true,
            },
            'the same unauthenticated anonymous token if the user is anonymous': {
                now: 1714881454,
                currentUserId: null,
                authentication: false,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: null,
                    signed: false,
                },
                expectTokenChange: false,
                expectSignedToken: false,
            },
            'the same authenticated token even if token authentication is disabled': {
                now: 1714881454,
                currentUserId: '00000000-0000-0000-0000-000000000001',
                authentication: false,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: true,
                },
                expectTokenChange: false,
                expectSignedToken: true,
            },
            'the same authenticated token if the user is identified and no user ID resolver is provided': {
                now: 1714881454,
                authentication: true,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: true,
                },
                expectTokenChange: false,
                expectSignedToken: true,
            },
            'the same unauthenticated token if the user is identified and no user ID resolver is provided': {
                now: 1714881454,
                authentication: false,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: '00000000-0000-0000-0000-000000000001',
                    signed: false,
                },
                expectTokenChange: false,
                expectSignedToken: false,
            },
            'the same authenticated token if the user is anonymous and no user ID resolver is provided': {
                now: 1714881454,
                authentication: true,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: null,
                    signed: true,
                },
                expectTokenChange: false,
                expectSignedToken: true,
            },
            'the same unauthenticated token if the user is anonymous and no user ID resolver is provided': {
                now: 1714881454,
                authentication: false,
                requestToken: {
                    expiration: 1714881454 + 1000,
                    issueTime: 1714881454,
                    userId: null,
                    signed: false,
                },
                expectTokenChange: false,
                expectSignedToken: false,
            },
        }),
    )('should assign %s', async (_, scenario) => {
        jest.useFakeTimers({now: scenario.now !== undefined ? scenario.now * 1000 : undefined});

        const keyIdentifier = scenario.requestToken?.apiKey ?? '00000000-0000-0000-0000-000000000001';
        const privateKey = 'ES256;MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg3TbbvRM7DNwxY3XGWDmlSRPSfZ9b+ch9TO3'
            + 'jQ68Zyj+hRANCAASmJj/EiEhUaLAWnbXMTb/85WADkuFgoELGZ5ByV7YPlbb2wY6oLjzGkpF6z8iDrvJ4kV6EhaJ4n0HwSQckVLNE';

        const oldApiKey = ApiKey.of(keyIdentifier, privateKey);
        const currentApiKey = scenario.currentApiKey !== undefined
            ? ApiKey.of(scenario.currentApiKey, privateKey)
            : oldApiKey;

        const request = createRequestMock();
        const response = createResponseMock();

        const cookieName = 'custom_ut';

        setEnvVars({
            appId: '00000000-0000-0000-0000-000000000001',
            apiKey: currentApiKey.export(),
            userTokenCookieName: cookieName,
            enableTokenAuthentication: scenario.authentication,
        });

        const {requestToken} = scenario;

        const oldUnsignedToken = requestToken !== undefined
            ? Token.of(
                {
                    typ: 'JWT',
                    appId: getAppId(),
                    alg: 'none',
                },
                {
                    exp: requestToken.expiration,
                    iat: requestToken.issueTime,
                    iss: 'test',
                    aud: 'test',
                    ...(requestToken?.userId !== null ? {sub: requestToken.userId} : {}),
                },
            )
            : null;

        const oldUserToken = oldUnsignedToken !== null && requestToken?.signed === true
            ? await oldUnsignedToken.withTokenId(uuid())
                .signedWith(oldApiKey)
            : oldUnsignedToken;

        if (oldUserToken !== null) {
            request.cookies.set(cookieName, oldUserToken.toString());
        }

        jest.spyOn(NextResponse, 'next').mockReturnValue(response);

        const userIdResolver = scenario.currentUserId !== undefined
            ? jest.fn().mockResolvedValue(scenario.currentUserId)
            : undefined;

        await expect(withCroct({userIdResolver: userIdResolver})(request, fetchEvent)).resolves.toBe(response);

        const newUserToken = request.headers.get(Header.USER_TOKEN);

        expect(newUserToken).not.toBeNull();

        expect(newUserToken !== oldUserToken?.toString()).toBe(scenario.expectTokenChange);

        const parsedToken = Token.parse(newUserToken!);

        expect(parsedToken.isSigned()).toBe(scenario.expectSignedToken);
        expect(parsedToken.getSubject()).toBe(
            scenario.currentUserId !== undefined
                ? scenario.currentUserId
                : requestToken?.userId ?? null,
        );

        expect(parseSetCookies(response.headers.getSetCookie())).toIncludeAllMembers([{
            name: cookieName,
            maxAge: 604800,
            secure: true,
            path: '/',
            sameSite: 'Strict',
            value: newUserToken,
        }]);
    });

    it.each<string>([
        '/foo',
        '/foo/bar',
        '/foo/bar/baz',
        '/foo/bar/baz/qux',
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
