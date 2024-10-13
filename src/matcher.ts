import {NextRequest} from 'next/server';
import {pathToRegexp} from 'path-to-regexp';

export type RouteCondition = {
    type: 'header' | 'query' | 'cookie',
    key: string,
    value?: string,
} | {
    type: 'host',
    key?: undefined,
    value: string,
};

export type RouterCriteria = {
    source?: string,
    locale?: boolean,
    has?: RouteCondition[],
    missing?: RouteCondition[],
};

export type RouterMatcher<R = NextRequest> = (request: R) => boolean;

export function createMatcher(matcher: RouterCriteria[]): RouterMatcher {
    if (matcher.length === 0) {
        return () => true;
    }

    const predicates = matcher.map(parsePredicate);

    return request => {
        const info = getRequestInfo(request);

        return predicates.some(predicate => predicate(info));
    };
}

/**
 * Parses the route criteria into a predicate function.
 *
 * The predicate function returns `true` if the request matches the criteria and `false` otherwise.
 *
 * Replicates the behavior of `matchHas` from Next.js.
 *
 * @param criteria The route criteria to parse.
 *
 * @returns The predicate function.
 */
function parsePredicate(criteria: RouterCriteria | string): RouterMatcher<RequestInfo> {
    if (typeof criteria === 'string') {
        return parsePredicate({source: criteria});
    }

    let regex: RegExp | null;

    try {
        regex = parseSource(criteria.source);
    } catch {
        throw new Error(`Invalid source pattern: ${criteria.source}`);
    }

    return (request: RequestInfo): boolean => {
        const {locale} = request;
        const pathname = criteria.locale === false
            ? `${locale === '' ? '' : `/${locale}`}${request.routePath}`
            : request.routePath;

        if (regex !== null && !regex.test(pathname)) {
            return false;
        }

        return (criteria.has ?? []).every(condition => matchesCondition(request, condition))
            && !(criteria.missing ?? []).some(condition => matchesCondition(request, condition));
    };
}

function parseSource(source: string | undefined): RegExp | null {
    if (source === undefined || source === '') {
        return null;
    }

    const {regexp} = pathToRegexp(source, {
        delimiter: '/',
        sensitive: false,
        trailing: false,
    });

    return regexp;
}

function matchesCondition(request: RequestInfo, condition: RouteCondition): boolean {
    const value = getConditionValue(request, condition) ?? '';
    const expectedValue = condition.value ?? '';

    if (expectedValue === '' && value !== '') {
        return true;
    }

    if (value === '') {
        return false;
    }

    try {
        return new RegExp(`^${expectedValue}$`).test(value);
    } catch {
        throw new Error(`Invalid value pattern for ${condition.type} condition: ${expectedValue}`);
    }
}

function getConditionValue(request: RequestInfo, condition: RouteCondition): string | null {
    switch (condition.type) {
        case 'header':
            return request.headers.get(condition.key);

        case 'query':
            return request.query.get(condition.key);

        case 'cookie':
            return request.cookies.get(condition.key)?.value ?? null;

        case 'host':
            return request.host
                .split(':')[0]
                .toLowerCase();
    }
}

type RequestInfo = {
    host: string,
    pathname: string,
    routePath: string,
    basePath: string,
    locale: string,
    headers: Headers,
    query: URLSearchParams,
    cookies: NextRequest['cookies'],
};

/**
 * Extracts the request information from a Next.js request.
 *
 * @param request The Next.js request.
 *
 * @returns The request information.
 *
 * @internal
 */
export function getRequestInfo(request: NextRequest): RequestInfo {
    const {locale} = request.nextUrl;
    const url = new URL(request.url);
    let urlPathName = url.pathname;
    let {pathname: nextPathName, basePath} = request.nextUrl;

    if (locale !== '' && basePath === '' && urlPathName === `/${locale}${nextPathName}`) {
        /*
           There is a known bug in Next.js when using localized routes with a basePath.
           For example, if the locale is 'pt' and the basePath is '/app', it leads to:
           - Actual URL: /app/pt
           - request.url = /pt/app/pt
           - request.nextUrl.pathname = /app/pt
           - request.nextUrl.basePath = (empty)

           However, it should be:
           - request.url = /app/pt
           - request.nextUrl.pathname = /
           - request.nextUrl.basePath = /app

           Interestingly, if the basePath starts with the locale (e.g., '/pt/app'), it works as expected.

           Bug report:
           https://github.com/vercel/next.js/issues/19690
       */
        const escapedLocale = escapeRegExp(locale);
        const match = new RegExp(`^/${escapedLocale}((/.+?)/${escapedLocale}(.*))`).exec(urlPathName);

        if (match !== null) {
            basePath = match[2] ?? basePath;
            urlPathName = match[1] ?? urlPathName;
            nextPathName = (match[3] === '' ? '/' : match[3]) ?? nextPathName;
        }
    }

    return {
        pathname: urlPathName,
        locale: locale,
        basePath: basePath,
        routePath: nextPathName,
        host: request.nextUrl.host,
        query: request.nextUrl.searchParams,
        cookies: request.cookies,
        headers: request.headers,
    };
}

function escapeRegExp(value: string): string {
    return value.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}
