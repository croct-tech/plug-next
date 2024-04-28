import {NextRequest, NextMiddleware, NextResponse} from 'next/server';
import cookie from 'cookie';
import {v4 as uuidv4} from 'uuid';
import {Response} from 'next/dist/compiled/@edge-runtime/primitives';
import {Header, QueryParameter} from '@/utils/http';
import {CookieOptions, getCidCookieOptions, getPreviewCookieOptions} from '@/utils/cookie';

// Ignore static assets
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '^(?!/(api|_next/static|_next/image|favicon.ico)).*',
    ],
};

export const middleware = withCroct();

export function withCroct(next?: NextMiddleware): NextMiddleware {
    return async (request, event) => {
        const cidCookie = getCidCookieOptions();
        const previewCookie = getPreviewCookieOptions();

        request.headers.set(Header.REQUEST_URI, getCurrentUrl(request));

        const clientId = getClientId(request, cidCookie.name);

        if (clientId !== null) {
            request.headers.set(Header.CLIENT_ID, clientId);
        }

        if (request.ip !== undefined) {
            request.headers.set(Header.CLIENT_IP, request.ip);
        }

        const previewToken = getPreviewToken(request, previewCookie.name);

        if (previewToken !== null && previewToken !== 'exit') {
            request.headers.set(Header.PREVIEW_TOKEN, previewToken);
        }

        const response = (await next?.(request, event)) ?? NextResponse.next({
            request: {
                headers: new Headers(request.headers),
            },
        });

        if (previewToken === 'exit') {
            unsetCookie(response, previewCookie.name);
        } else if (previewToken !== null) {
            setCookie(response, previewToken, previewCookie);
        }

        setCookie(response, clientId, cidCookie);

        return response;
    };
}

function getCurrentUrl(request: NextRequest): string {
    const url = new URL(request.nextUrl.toString());

    url.searchParams.delete(QueryParameter.PREVIEW_TOKEN);

    return url.toString();
}

function generateCid(): string {
    return uuidv4();
}

function getClientId(request: NextRequest, cookieName: string): string {
    return request.cookies.get(cookieName)?.value
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

function getPreviewToken(request: NextRequest, cookieName: string): string | null {
    const {searchParams} = request.nextUrl;
    const previewToken = searchParams.get(QueryParameter.PREVIEW_TOKEN)
        ?? request.cookies.get(cookieName)?.value;

    if (previewToken === undefined) {
        return null;
    }

    if (isPreviewTokenValid(previewToken)) {
        return previewToken;
    }

    return 'exit';
}

function unsetCookie(response: Response, name: string): void {
    response.headers.append('Set-Cookie', cookie.serialize(name, '', {
        maxAge: 0,
        httpOnly: true,
        secure: true,
    }));
}

function setCookie(response: Response, value: string, options: CookieOptions): void {
    const {name, ...rest} = options;

    response.headers.append('Set-Cookie', cookie.serialize(name, value, rest));
}
