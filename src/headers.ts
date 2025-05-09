import type {ServerResponse} from 'http';
import type {NextRequest, NextResponse} from 'next/server';
import type {GetServerSidePropsContext, NextApiRequest, NextApiResponse} from 'next';
import type {cookies, headers} from 'next/headers';
import cookie from 'cookie';

/**
 * @internal
 */
export type HeaderReader = Pick<Awaited<ReturnType<typeof headers>>, 'get'>;

/**
 * @internal
 */
export type CookieReader = {
    get: (name: string) => {value: string}|undefined,
};

/**
 * @internal
 */
export type CookieOptions = NonNullable<Parameters<Awaited<ReturnType<typeof cookies>>['set']>[2]>;

/**
 * @internal
 */
export type CookieAccessor = CookieReader & {
    set: (name: string, value: string, options?: CookieOptions) => void,
};

type PageRequest = Pick<GetServerSidePropsContext['req'], 'headers' | 'cookies'>;

/**
 * @internal
 */
export type PartialRequest = Pick<NextRequest, 'headers' | 'cookies'>
    | Pick<NextApiRequest, 'headers' | 'cookies'>
    | PageRequest;

/**
 * @internal
 */
export type PartialResponse = Pick<NextResponse, 'headers' | 'cookies'>
    | Pick<NextApiResponse, 'getHeader' | 'setHeader'>
    | Pick<ServerResponse, 'getHeader' | 'setHeader'>;

export type RouteContext = {
    req: PartialRequest,
    res: PartialResponse,
};

/**
 * @internal
 */
export async function getHeaders(route?: RouteContext): Promise<HeaderReader> {
    try {
        const {headers} = await importNextHeaders();

        return headers();
    } catch (error) {
        if (route === undefined) {
            throw error;
        }
    }

    return Promise.resolve({
        get: (name: string): string|null => {
            const requestHeaders = route.req.headers;

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
    });
}

/**
 * @internal
 */
export async function getCookies(route?: RouteContext): Promise<CookieAccessor> {
    try {
        const {cookies} = await importNextHeaders();

        return cookies();
    } catch (error) {
        if (route === undefined) {
            throw error;
        }
    }

    return Promise.resolve({
        get: (name: string): {value: string}|undefined => {
            const response = route.res;

            // First check if the cookie is set in the response
            // as it is the most recent value
            if ('cookies' in response) {
                const responseValue = response.cookies.get(name);

                if (responseValue !== undefined) {
                    return {value: responseValue.value};
                }
            } else {
                const responseValue = response.getHeader('Set-Cookie') ?? [];
                const lines = Array.isArray(responseValue) ? responseValue : [`${responseValue}`];

                for (const line of lines) {
                    const parsedHeader = cookie.parse(line.split(';')[0]);

                    if (parsedHeader[name] !== undefined) {
                        return {value: parsedHeader[name]};
                    }
                }
            }

            // Next check if the cookie is set in the request
            const requestCookies = route.req.cookies;

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
            const response = route.res;

            if ('cookies' in response) {
                response.cookies.set(name, value, options);

                return;
            }

            const responseValue = response.getHeader('Set-Cookie') ?? [];
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

            response.setHeader('Set-Cookie', newValue);
        },
    });
}

/**
 * @internal
 */
function isNextRequestHeaders(headers: PartialRequest['headers']): headers is NextRequest['headers'] {
    return headers.append !== undefined;
}

/**
 * @internal
 */
function isNextRequestCookies(cookies: PartialRequest['cookies']): cookies is NextRequest['cookies'] {
    return cookies.get !== undefined || cookies.set !== undefined;
}

/**
 * @internal
 */
export async function isAppRouter(): Promise<boolean> {
    try {
        const {headers} = await importNextHeaders();

        await headers();
    } catch {
        return false;
    }

    return true;
}

function importNextHeaders(): Promise<typeof import('next/headers.js')> {
    // eslint-disable-next-line import/extensions -- Extension needed to work on both CJS and ESM
    return import('next/headers.js');
}
