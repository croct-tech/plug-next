import type {cookies, headers} from 'next/headers';
import {Token} from '@croct/sdk/token';
import {Header} from '@/config/http';
import {getUserTokenCookieOptions} from '@/config/cookie';

type ReadonlyHeaders = ReturnType<typeof headers>;
type ReadonlyCookies = ReturnType<typeof cookies>;

export type RequestContext = {
    clientId: string,
    uri?: string,
    clientAgent?: string,
    referrer?: string,
    clientIp?: string,
    userToken?: string,
    previewToken?: string,
};

export function getRequestContext(headers: ReadonlyHeaders, cookies: ReadonlyCookies): RequestContext {
    const clientId = headers.get(Header.CLIENT_ID);

    if (clientId === null) {
        throw new Error('Croct\'s client ID is missing. Did you forget to configure Croct\'s middleware?');
    }

    const context: RequestContext = {
        clientId: clientId,
    };

    const uri = headers.get(Header.REQUEST_URI);

    if (uri !== null) {
        context.uri = uri;
    }

    const userAgent = headers.get(Header.USER_AGENT);

    if (userAgent !== null) {
        context.clientAgent = userAgent;
    }

    const referrer = headers.get(Header.REFERRER);

    if (referrer !== null) {
        context.referrer = referrer;
    }

    const clientIp = headers.get(Header.CLIENT_IP);

    if (clientIp !== null) {
        context.clientIp = clientIp;
    }

    const userToken = getUserToken(headers, cookies);

    if (userToken !== null) {
        context.userToken = userToken;
    }

    const previewToken = headers.get(Header.PREVIEW_TOKEN);

    if (previewToken !== null) {
        context.previewToken = previewToken;
    }

    return context;
}

/**
 * Get the user token from the headers or cookies.
 *
 * The cookie takes precedence over the header because it can be set in
 * an action or API route that happens after the middleware execution.
 *
 * @param headers The request headers.
 * @param cookies The request cookies.
 */
function getUserToken(headers: ReadonlyHeaders, cookies: ReadonlyCookies): string|null {
    const {name: cookieName} = getUserTokenCookieOptions();
    const cookie = cookies.get(cookieName);
    const cookieValue = cookie === undefined || cookie.value === '' ? null : cookie.value;
    const header = headers.get(Header.USER_TOKEN);
    const headerValue = header === null || header === '' ? null : header;

    if (cookieValue === null || headerValue === null) {
        return cookieValue ?? headerValue;
    }

    let cookieToken: Token;

    try {
        cookieToken = Token.parse(cookieValue);
    } catch {
        return headerValue;
    }

    let headerToken: Token;

    try {
        headerToken = Token.parse(headerValue);
    } catch {
        return cookieValue;
    }

    return headerToken.isNewerThan(cookieToken) ? headerValue : cookieValue;
}
