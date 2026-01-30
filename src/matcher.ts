import type {NextRequest} from 'next/server';
import {pathToRegexp} from 'path-to-regexp';

type ValueBasedCondition<V extends string | RegExp = string> = {
    type: 'header' | 'query' | 'cookie',
    key: string,
    value?: V,
};

type HostBasedCondition<V extends string | RegExp = string> = {
    type: 'host',
    value: V,
};

/**
 * @internal
 */
export type RouteCondition = ValueBasedCondition | HostBasedCondition;

export type RouterCriteria = {
    source?: string,
    locale?: boolean,
    has?: RouteCondition[],
    missing?: RouteCondition[],
};

type NormalizedRouteCondition = ValueBasedCondition<RegExp> | HostBasedCondition<RegExp>;

/**
 * @internal
 */
export type RouterMatcher<R = NextRequest> = (request: R) => boolean;

/**
 * @internal
 */
export function createMatcher(matcher: RouterCriteria[]): RouterMatcher {
    if (matcher.length === 0) {
        return () => true;
    }

    const predicates = matcher.map(createPredicate);

    return request => {
        const info = getRequestInfo(request);

        return predicates.some(predicate => predicate(info));
    };
}

/**
 * Creates a predicate function that matches a request against a set of criteria.
 *
 * The predicate function returns `true` if the request matches the criteria and `false` otherwise.
 *
 * Replicates the behavior of `matchHas` from Next.js.
 *
 * @param criteria The route criteria to parse.
 *
 * @returns The predicate function.
 */
function createPredicate(criteria: RouterCriteria): RouterMatcher<RequestInfo> {
    let regex: RegExp | null;

    try {
        regex = parseSource(criteria.source);
    } catch {
        throw new Error(`Invalid source pattern: ${criteria.source}`);
    }

    const hasConditions = (criteria.has ?? []).map(createCondition);
    const missingConditions = (criteria.missing ?? []).map(createCondition);

    return (request: RequestInfo): boolean => {
        const {locale} = request;
        // Specifying `locale: false` in the criteria means that the locale should be ignored
        // in the route matching.
        // Docs: https://nextjs.org/docs/app/api-reference/file-conventions/middleware#matcher
        const pathname = criteria.locale === false
            ? `${locale === '' ? '' : `/${locale}`}${request.routePath}`
            : request.routePath;

        if (regex !== null && !regex.test(pathname)) {
            return false;
        }

        return hasConditions.every(condition => matchesCondition(request, condition))
            && !missingConditions.some(condition => matchesCondition(request, condition));
    };
}

function createCondition(condition: RouteCondition): NormalizedRouteCondition {
    if (condition.type !== 'host' && condition.value === undefined) {
        const {value: _value, ...rest} = condition;

        return rest;
    }

    try {
        return {
            ...condition,
            value: new RegExp(`^${condition.value}$`),
        };
    } catch {
        throw new Error(`Invalid value pattern for ${condition.type} condition: ${condition.value}`);
    }
}

function parseSource(source: string | undefined): RegExp | null {
    if (source === undefined || source === '') {
        return null;
    }

    return pathToRegexp(source, undefined, {
        delimiter: '/',
        strict: true,
        sensitive: false,
    });
}

function matchesCondition(request: RequestInfo, condition: NormalizedRouteCondition): boolean {
    const value = getConditionValue(request, condition) ?? '';
    const expectedValue = condition.value ?? null;

    if (value === '') {
        return false;
    }

    if (expectedValue === null) {
        return true;
    }

    return expectedValue.test(value);
}

function getConditionValue(request: RequestInfo, condition: NormalizedRouteCondition): string | null {
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
            basePath = `${match[2]}`;
            urlPathName = `${match[1]}`;
            nextPathName = (match[3] === '' ? '/' : match[3]);
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
