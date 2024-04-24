import {NextRequest, NextResponse} from 'next/server';
import {NextMiddleware} from 'next/dist/server/web/types';
import cookie, {CookieSerializeOptions as CookieOptions} from 'cookie';
import {Cookie, Header, QueryParameter} from './utils/http';
import {generateCid} from './utils/cid';

const CID_DOMAIN = process.env.NEXT_PUBLIC_CROCT_COOKIE_DOMAIN ?? '';
const DEFAULT_CLIENT_ID_DURATION = 60 * 60 * 24 * 365; // 1 year
const CLIENT_ID_DURATION = ((): number => {
    const duration = process.env.NEXT_PUBLIC_CROCT_COOKIE_DURATION ?? '';

    if (duration === '') {
        return DEFAULT_CLIENT_ID_DURATION;
    }

    const parsedDuration = Number.parseInt(duration, 10);

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        throw new Error(
            'Environment variable NEXT_PUBLIC_CROCT_COOKIE_DURATION must be '
            + `a positive integer, got ${duration}`,
        );
    }

    return parsedDuration;
})();

const CLIENT_ID_COOKIE_OPTIONS: CookieOptions = {
    maxAge: CLIENT_ID_DURATION,
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    ...(CID_DOMAIN !== undefined ? {domain: CID_DOMAIN} : {}),
};

const PREVIEW_TOKEN_COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
};

// Ignore static assets
export const config = {
    matcher: '/((?!api|_next|.*\\.).*)',
};

export function withCroct(next?: NextMiddleware): NextMiddleware {
    return async (request, event) => {
        request.headers.set(Header.REQUEST_URI, getCurrentUrl(request));

        const clientId = getClientId(request);

        if (clientId !== null) {
            request.headers.set(Header.CLIENT_ID, clientId);
        }

        if (request.ip !== undefined) {
            request.headers.set(Header.CLIENT_IP, request.ip);
        }

        const previewToken = getPreviewToken(request);

        if (previewToken !== null && previewToken !== 'exit') {
            request.headers.set(Header.PREVIEW_TOKEN, previewToken);
        }

        const response = (await next?.(request, event)) ?? NextResponse.next();

        if (previewToken === 'exit') {
            unsetCookie(response, Cookie.PREVIEW_TOKEN);
        } else if (previewToken !== null) {
            setCookie(response, Cookie.PREVIEW_TOKEN, previewToken, PREVIEW_TOKEN_COOKIE_OPTIONS);
        }

        setCookie(response, Cookie.CLIENT_ID, clientId, CLIENT_ID_COOKIE_OPTIONS);

        return response;
    };
}

function getCurrentUrl(request: NextRequest): string {
    const url = new URL(request.nextUrl.toString());

    url.searchParams.delete(QueryParameter.PREVIEW_TOKEN);

    return url.toString();
}

function getClientId(request: NextRequest): string {
    return request.cookies.get(Cookie.CLIENT_ID)?.value
        ?? generateCid();
}

function isPreviewTokenValid(token: unknown): token is string {
    if (typeof token !== 'string' || token === 'exit') {
        return false;
    }

    try {
        const jwt = JSON.parse(atob(token.split('.')[1]).toString());
        const now = Math.floor(Date.now() / 1000);

        return Number.isInteger(jwt.exp) && jwt.exp > now;
    } catch {
        return false;
    }
}

function getPreviewToken(request: NextRequest): string | null {
    const {searchParams} = request.nextUrl;
    const previewToken = searchParams.get(QueryParameter.PREVIEW_TOKEN)
        ?? request.cookies.get(Cookie.PREVIEW_TOKEN)?.value;

    if (previewToken === undefined) {
        return null;
    }

    if (isPreviewTokenValid(previewToken)) {
        return previewToken;
    }

    return 'exit';
}

function unsetCookie(response: NextResponse|Response, name: string): void {
    const options: CookieOptions = {
        maxAge: 0,
        httpOnly: true,
        secure: true,
    };

    if (response instanceof NextResponse) {
        response.cookies.set(name, '', options);

        return;
    }

    response.headers.append('Set-Cookie', cookie.serialize(name, '', options));
}

function setCookie(response: NextResponse|Response, name: string, value: string, options?: CookieOptions): void {
    if (response instanceof NextResponse) {
        response.cookies.set(name, value, options);

        return;
    }

    response.headers.append('Set-Cookie', cookie.serialize(name, value, options));
}
