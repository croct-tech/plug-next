import {NextRequest, NextMiddleware, NextResponse} from 'next/server';
import cookie from 'cookie';
import {v4 as uuidv4} from 'uuid';
import {Token} from '@croct/sdk/token';
import {Header, QueryParameter} from '@/config/http';
import {
    CookieOptions,
    getClientIdCookieOptions,
    getPreviewCookieOptions,
    getUserTokenCookieOptions,
} from '@/config/cookie';
import {getAuthenticationKey, issueToken, isUserTokenAuthenticationEnabled} from './config/security';

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

const CLIENT_ID_PATTERN = /^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32})$/;

export const middleware = withCroct();

export type UserIdResolver = (request: NextRequest) => Promise<string|null>|string|null;

export type CroctMiddlewareOptions = {
    next?: NextMiddleware,
    userIdResolver?: UserIdResolver,
};

type CroctMiddlewareParams =
      [NextMiddleware]
    | [NextMiddleware, UserIdResolver]
    | [CroctMiddlewareOptions]
    | [];

export function withCroct(): NextMiddleware;
export function withCroct(next: NextMiddleware): NextMiddleware;
export function withCroct(next: NextMiddleware, userIdResolver: UserIdResolver): NextMiddleware;
export function withCroct(props: CroctMiddlewareOptions): NextMiddleware;

export function withCroct(...args: CroctMiddlewareParams): NextMiddleware {
    if (args.length === 0) {
        return withCroct({});
    }

    if (typeof args[0] === 'function') {
        return withCroct({next: args[0], userIdResolver: args[1]});
    }

    const {next, userIdResolver} = args[0];

    return async (request, event) => {
        const clientIdCookie = getClientIdCookieOptions();
        const previewCookie = getPreviewCookieOptions();
        const userCookie = getUserTokenCookieOptions();
        const {headers} = request;

        const userToken = await getUserToken(request, userCookie.name, userIdResolver);
        const clientId = getClientId(request, clientIdCookie.name);

        headers.set(Header.USER_TOKEN, userToken.toString());
        headers.set(Header.REQUEST_URI, getCurrentUrl(request));
        headers.set(Header.CLIENT_ID, clientId);

        if (request.ip !== undefined) {
            headers.set(Header.CLIENT_IP, request.ip);
        }

        const previewToken = getPreviewToken(request, previewCookie.name);

        if (previewToken !== null && previewToken !== 'exit') {
            headers.set(Header.PREVIEW_TOKEN, previewToken);
        }

        const response = (await next?.(request, event)) ?? NextResponse.next({
            request: {
                headers: new Headers(headers),
            },
        });

        if (previewToken === 'exit') {
            unsetCookie(response, previewCookie.name);
        } else if (previewToken !== null) {
            setCookie(response, previewToken, previewCookie);
        }

        setCookie(response, userToken.toString(), userCookie);
        setCookie(response, clientId, clientIdCookie);

        return response;
    };
}

function getCurrentUrl(request: NextRequest): string {
    const url = new URL(request.nextUrl.toString());

    url.searchParams.delete(QueryParameter.PREVIEW_TOKEN);

    return url.toString();
}

function generateClientId(): string {
    return uuidv4();
}

function getClientId(request: NextRequest, cookieName: string): string {
    const clientId = request.cookies.get(cookieName)?.value ?? null;

    if (clientId === null || !CLIENT_ID_PATTERN.test(clientId)) {
        return generateClientId();
    }

    return clientId;
}

async function getUserToken(
    request: NextRequest,
    cookieName: string,
    userIdResolver?: UserIdResolver,
): Promise<Token> {
    const userCookie = request.cookies.get(cookieName);
    let token: Token|null = null;

    if (userCookie !== undefined) {
        try {
            token = Token.parse(userCookie.value);
        } catch {
            // Ignore invalid tokens
        }
    }

    const userId = userIdResolver !== undefined ? await userIdResolver(request) : undefined;

    if (
        token === null
        || (isUserTokenAuthenticationEnabled() && !token.isSigned())
        || !token.isValidNow()
        || (userId !== undefined && (userId === null ? !token.isAnonymous() : !token.isSubject(userId)))
        || (token.isSigned() && !await token.matchesKeyId(getAuthenticationKey()))
    ) {
        return issueToken(userId);
    }

    return token;
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

function isPreviewTokenValid(token: unknown): token is string {
    if (typeof token !== 'string' || token === 'exit') {
        return false;
    }

    const now = Math.floor(Date.now() / 1000);

    try {
        const payload = JSON.parse(atob(token.split('.')[1]).toString());

        return Number.isInteger(payload.exp) && payload.exp > now;
    } catch {
        return false;
    }
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
