import {type NextRequest, type NextMiddleware, type NextFetchEvent, NextResponse} from 'next/server';
import cookie from 'cookie';
import {Token} from '@croct/sdk/token';
import {base64UrlDecode} from '@croct/sdk/base64Url';
import {Header, QueryParameter} from '@/config/http';
import {
    CookieOptions,
    getClientIdCookieOptions,
    getPreviewCookieOptions,
    getUserTokenCookieOptions,
} from '@/config/cookie';
import {getAuthenticationKey, issueToken, isUserTokenAuthenticationEnabled} from './config/security';
import {createMatcher, RouterCriteria} from '@/matcher';

const matcherRegex = /^(?!\/(api|_next\/static|_next\/image|favicon.ico)).*/;

export const matcher = {
    /*
     * Match all request paths except for the ones starting with:
     *
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    source: matcherRegex.source,
} satisfies RouterCriteria;

// Ignore static assets
export const config = {
    matcher: [matcher],
};

const CLIENT_ID_PATTERN = /^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32})$/;

export const middleware = withCroct();

export type UserIdResolver = (request: NextRequest) => Promise<string|null>|string|null;
export type LocaleResolver = (request: NextRequest) => Promise<string|null>|string|null;

type MiddlewareMatcher = string | string[] | RouterCriteria[];

export type CroctMiddlewareOptions = {
    next?: NextMiddleware,
    matcher?: MiddlewareMatcher,
    userIdResolver?: UserIdResolver,
    localeResolver?: LocaleResolver,
};

type CroctMiddlewareParams =
      [NextMiddleware]
    | [NextMiddleware, MiddlewareMatcher]
    | [CroctMiddlewareOptions]
    | [];

export function withCroct(): NextMiddleware;
export function withCroct(next: NextMiddleware): NextMiddleware;
// eslint-disable-next-line @typescript-eslint/no-shadow -- False positive
export function withCroct(next: NextMiddleware, matcher: MiddlewareMatcher): NextMiddleware;
export function withCroct(props: CroctMiddlewareOptions): NextMiddleware;

export function withCroct(...args: CroctMiddlewareParams): NextMiddleware {
    if (args.length === 0) {
        return withCroct({});
    }

    if (typeof args[0] === 'function') {
        return withCroct({next: args[0], matcher: args[1]});
    }

    const {next, matcher: matchers = [], localeResolver, userIdResolver} = args[0];

    const matchesMiddleware = createMatcher((Array.isArray(matchers) ? matchers : [matchers]).flatMap(definition => {
        if (definition === matchers) {
            // Exclude the default matcher from the list of matchers
            return [];
        }

        return typeof definition === 'string'
            ? [{source: definition}]
            : [definition];
    }));

    return async (request, event) => {
        const handler = matchesMiddleware(request) ? next : undefined;

        if (!matcherRegex.test(request.nextUrl.pathname)) {
            if (handler !== undefined) {
                return handler(request, event);
            }

            return;
        }

        const clientIdCookie = getClientIdCookieOptions();
        const previewCookie = getPreviewCookieOptions();
        const userCookie = getUserTokenCookieOptions();

        const headers = new Headers();

        const [userToken, locale] = await Promise.all([
            getUserToken(request, userCookie.name, userIdResolver),
            resolveLocale(request, localeResolver),
        ]);

        const clientId = getClientId(request, clientIdCookie.name);

        headers.set(Header.USER_TOKEN, userToken.toString());
        headers.set(Header.REQUEST_URI, getCurrentUrl(request));
        headers.set(Header.CLIENT_ID, clientId);

        if (locale !== '') {
            headers.set(Header.PREFERRED_LOCALE, locale);
        }

        if (request.ip !== undefined) {
            headers.set(Header.CLIENT_IP, request.ip);
        }

        const previewToken = getPreviewToken(request, previewCookie.name);

        if (previewToken !== null && previewToken !== 'exit') {
            headers.set(Header.PREVIEW_TOKEN, previewToken);
        }

        const response = await handleRequest(handler, headers, request, event);

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

function getClientId(request: NextRequest, cookieName: string): string {
    const clientId = request.cookies.get(cookieName)?.value ?? null;

    if (clientId === null || !CLIENT_ID_PATTERN.test(clientId)) {
        return crypto.randomUUID();
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
        const payload = JSON.parse(base64UrlDecode(token.split('.')[1]).toString());

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

async function resolveLocale(request: NextRequest, resolver?: LocaleResolver): Promise<string> {
    const locale = resolver !== undefined ? ((await resolver(request)) ?? '') : '';

    if (locale !== '') {
        return locale;
    }

    return request.nextUrl.locale;
}

async function handleRequest(
    next: NextMiddleware | undefined,
    headers: Headers,
    request: NextRequest,
    event: NextFetchEvent,
): Promise<Response> {
    headers.forEach((value, name) => {
        request.headers.set(name, value);
    });

    if (next === undefined) {
        return NextResponse.next({
            request: {
                headers: new Headers(request.headers),
            },
        });
    }

    const nextResponse = NextResponse.next;

    NextResponse.next = (init): NextResponse => {
        const mergedHeaders = new Headers(init?.request?.headers);

        headers.forEach((value, name) => {
            mergedHeaders.set(name, value);
        });

        return nextResponse({
            ...init,
            request: {
                ...init?.request,
                headers: mergedHeaders,
            },
        });
    };

    try {
        return await next(request, event) ?? NextResponse.next({
            request: {
                headers: new Headers(request.headers),
            },
        });
    } finally {
        NextResponse.next = nextResponse;
    }
}
