import type {ServerResponse} from 'http';
import type {NextRequest, NextResponse} from 'next/server';
import type {GetServerSidePropsContext, NextApiRequest, NextApiResponse} from 'next';
import type {cookies, headers} from 'next/headers';
import cookie from 'cookie';

export type HeaderReader = Pick<ReturnType<typeof headers>, 'get'>;

export type CookieReader = {
    get: (name: string) => {value: string}|undefined,
};

export type CookieOptions = NonNullable<Parameters<ReturnType<typeof cookies>['set']>[2]>;

export type CookieAccessor = CookieReader & {
    set: (name: string, value: string, options?: CookieOptions) => void,
};

type PageRequest = Pick<GetServerSidePropsContext['req'], 'headers' | 'cookies'>;

export type PartialRequest = Pick<NextRequest, 'headers' | 'cookies'>
    | Pick<NextApiRequest, 'headers' | 'cookies'>
    | PageRequest;

export type PartialResponse = Pick<NextResponse, 'headers' | 'cookies'>
    | Pick<NextApiResponse, 'getHeader' | 'setHeader'>
    | Pick<ServerResponse, 'getHeader' | 'setHeader'>;

export type RouteContext = {
    req: PartialRequest,
    res: PartialResponse,
};

export function getHeaders(context?: RouteContext): HeaderReader {
    try {
        const {headers} = importNextHeaders();

        return headers();
    } catch {
        if (context === undefined) {
            throw new Error('No request context available');
        }
    }

    return {
        get: (name: string): string|null => {
            const requestHeaders = context.req.headers;

            if (isNextRequestHeaders(requestHeaders)) {
                return requestHeaders.get(name);
            }

            const value = requestHeaders[name];

            if (typeof value === 'string') {
                return value;
            }

            if (Array.isArray(value)) {
                return value.join(', ');
            }

            return null;
        },
    };
}

export function getCookies(context?: RouteContext): CookieAccessor {
    try {
        const {cookies} = importNextHeaders();

        return cookies();
    } catch {
        if (context === undefined) {
            throw new Error('No request context available');
        }
    }

    return {
        get: (name: string): {value: string}|undefined => {
            const {res} = context;

            // First check if the cookie is set in the response
            // as it is the most recent value
            if ('cookies' in res) {
                const responseValue = res.cookies.get(name);

                if (responseValue !== undefined) {
                    return {value: responseValue.value};
                }
            } else {
                const responseValue = res.getHeader('Set-Cookie') ?? [];
                const lines = Array.isArray(responseValue) ? responseValue : [`${responseValue}`];

                for (const line of lines) {
                    const parsedHeader = cookie.parse(line.split(';')[0]);

                    if (parsedHeader[name] !== undefined) {
                        return {value: parsedHeader[name]};
                    }
                }
            }

            // Next check if the cookie is set in the request
            const requestCookies = context.req.cookies;

            if (isNextRequestCookies(requestCookies)) {
                return requestCookies.get(name);
            }

            const value = requestCookies[name];

            if (value !== undefined) {
                return {value: value};
            }

            return undefined;
        },
        set: (name, value, options): void => {
            const {res} = context;

            if ('cookies' in res) {
                res.cookies.set(name, value, options);

                return;
            }

            const responseValue = res.getHeader('Set-Cookie') ?? [];
            const previousValue = Array.isArray(responseValue) ? responseValue : [`${responseValue}`];
            const newValue = previousValue.flatMap(line => {
                const parsedHeader = cookie.parse(line.split(';')[0]);

                if (parsedHeader[name] !== undefined) {
                    return [];
                }

                return [line];
            });

            const expires = options?.expires;

            newValue.push(cookie.serialize(name, value, {
                ...options,
                expires: typeof expires === 'number'
                    ? new Date(expires)
                    : expires,
            }));

            res.setHeader('Set-Cookie', newValue);
        },
    };
}

function isNextRequestHeaders(headers: PartialRequest['headers']): headers is NextRequest['headers'] {
    return headers.append !== undefined;
}

function isNextRequestCookies(cookies: PartialRequest['cookies']): cookies is NextRequest['cookies'] {
    return cookies.get !== undefined || cookies.set !== undefined;
}

export function isAppRouter(): boolean {
    try {
        const {headers} = importNextHeaders();

        headers();
    } catch {
        return false;
    }

    return true;
}

function importNextHeaders(): typeof import('next/headers') {
    // eslint-disable-next-line global-require -- Required for dynamic import
    return require('next/headers');
}
