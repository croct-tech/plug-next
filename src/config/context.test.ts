import type {cookies} from 'next/headers';
import {Token} from '@croct/sdk/token';
import {getRequestContext, RequestContext} from '@/config/context';
import {Header} from '@/config/http';
import {getUserTokenCookieOptions} from '@/config/cookie';

type ReadonlyCookies = ReturnType<typeof cookies>;

describe('getRequestContext', () => {
    const appId = '00000000-0000-0000-0000-000000000000';

    function createCookieJar(cookies: Record<string, string> = {}): ReadonlyCookies {
        const jar: Record<string, string> = {...cookies};

        return {
            get: jest.fn((name: string) => {
                if (jar[name] === undefined) {
                    return undefined;
                }

                return {
                    name: name,
                    value: jar[name],
                };
            }),
            has: jest.fn((name: string) => jar[name] !== undefined),
        } as Partial<ReadonlyCookies> as ReadonlyCookies;
    }

    it('should throw an error when the client ID is missing', () => {
        expect(() => getRequestContext(new Headers(), createCookieJar()))
            .toThrow('Croct\'s client ID is missing. Did you forget to configure Croct\'s middleware?');
    });

    it('should return a full request context', () => {
        const token = Token.issue(appId);

        const request = {
            clientId: '00000000-0000-0000-0000-000000000000',
            uri: 'http://localhost:3000',
            clientAgent: 'Mozilla/5.0',
            referrer: 'http://referrer.com',
            clientIp: '192.0.0.1',
            previewToken: 'ct.preview_token',
            userToken: token.toString(),
        } satisfies RequestContext;

        const headers = new Headers();

        headers.set(Header.CLIENT_ID, request.clientId);
        headers.set(Header.REQUEST_URI, request.uri);
        headers.set(Header.USER_AGENT, request.clientAgent);
        headers.set(Header.REFERRER, request.referrer);
        headers.set(Header.CLIENT_IP, request.clientIp);
        headers.set(Header.PREVIEW_TOKEN, request.previewToken);
        headers.set(Header.USER_TOKEN, token.toString());

        expect(getRequestContext(headers, createCookieJar())).toEqual(request);
    });

    it('should return a partial request context', () => {
        const request = {
            clientId: '00000000-0000-0000-0000-000000000000',
        } satisfies RequestContext;

        const headers = new Headers();

        headers.set(Header.CLIENT_ID, request.clientId);

        expect(getRequestContext(headers, createCookieJar())).toEqual(request);
    });

    it('should retrieve the user token from the cookies', () => {
        const token = Token.issue(appId);
        const userCookie = getUserTokenCookieOptions();
        const cookies = createCookieJar({
            [userCookie.name]: token.toString(),
        });

        const headers = new Headers([[Header.CLIENT_ID, '00000000-0000-0000-0000-000000000000']]);

        const context = getRequestContext(headers, cookies);

        expect(context.userToken).toEqual(token.toString());
    });

    it('should use the token from the headers when the token in the cookies is invalid', () => {
        const token = Token.issue(appId);
        const userCookie = getUserTokenCookieOptions();
        const cookies = createCookieJar({
            [userCookie.name]: 'invalid-token',
        });

        const headers = new Headers([[Header.CLIENT_ID, '00000000-0000-0000-0000-000000000000']]);

        headers.set(Header.USER_TOKEN, token.toString());

        const context = getRequestContext(headers, cookies);

        expect(context.userToken).toEqual(token.toString());
    });

    it('should use the token from the cookies when the token in the headers is invalid', () => {
        const token = Token.issue(appId);
        const userCookie = getUserTokenCookieOptions();
        const cookies = createCookieJar({
            [userCookie.name]: token.toString(),
        });

        const headers = new Headers([[Header.CLIENT_ID, '00000000-0000-0000-0000-000000000000']]);

        headers.set(Header.USER_TOKEN, 'invalid-token');

        const context = getRequestContext(headers, cookies);

        expect(context.userToken).toEqual(token.toString());
    });

    it('should give priority to the newest user token', () => {
        const oldToken = Token.issue(appId, null, 0);
        const newToken = Token.issue(appId, null, 1);

        const userCookie = getUserTokenCookieOptions();
        const cookies = createCookieJar({
            [userCookie.name]: newToken.toString(),
        });

        const headers = new Headers();

        headers.set(Header.CLIENT_ID, '00000000-0000-0000-0000-000000000000');
        headers.set(Header.USER_TOKEN, oldToken.toString());

        const context = getRequestContext(headers, cookies);

        expect(context.userToken).toEqual(newToken.toString());
    });
});
