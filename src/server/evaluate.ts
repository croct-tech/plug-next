import {evaluate as executeQuery, EvaluationOptions as BaseOptions} from '@croct/plug-react/api';
import type {JsonValue} from '@croct/plug-react';
import {FilteredLogger} from '@croct/sdk/logging/filteredLogger';
import {ConsoleLogger} from '@croct/sdk/logging/consoleLogger';
import {getApiKey} from '@/config/security';
import {RequestContext, resolveRequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';
import {isAppRouter, RouteContext} from '@/headers';

export type EvaluationOptions<T extends JsonValue = JsonValue> = Omit<BaseOptions<T>, 'apiKey' | 'appId'> & {
    route?: RouteContext,
};

export function evaluate<T extends JsonValue>(query: string, options: EvaluationOptions<T> = {}): Promise<T> {
    const {route, ...rest} = options;
    let context: RequestContext;

    try {
        context = resolveRequestContext(route);
    } catch (error) {
        if (route === undefined) {
            return Promise.reject(
                new Error(
                    'evaluate() requires specifying the `route` option outside app routes. '
                    + 'For help, see: https://croct.help/sdk/nextjs/evaluate-route-context',
                ),
            );
        }

        return Promise.reject(error);
    }

    return executeQuery<T>(query, {
        apiKey: getApiKey(),
        clientIp: context.clientIp ?? '127.0.0.1',
        ...(context.previewToken !== undefined && {previewToken: context.previewToken}),
        ...(context.userToken !== undefined && {userToken: context.userToken}),
        ...(context.clientId !== undefined && {clientId: context.clientId}),
        ...(context.clientAgent !== undefined && {clientAgent: context.clientAgent}),
        timeout: getDefaultFetchTimeout(),
        extra: {
            cache: 'no-store',
        },
        ...rest,
        logger: rest.logger ?? FilteredLogger.include(new ConsoleLogger(), ['warn', 'error']),
        ...(context.uri !== undefined
            ? {
                context: {
                    page: {
                        url: context.uri,
                        ...(context.referrer !== null ? {referrer: context.referrer} : {}),
                        ...rest.context?.page,
                    },
                    ...rest.context,
                },
            }
            : {}
        ),
    });
}

export function cql<T extends JsonValue>(fragments: TemplateStringsArray, ...args: JsonValue[]): Promise<T> {
    if (!isAppRouter()) {
        return Promise.reject(
            new Error(
                'The cql tag function can only be used with App Router. '
                + 'For help, see https://croct.help/sdk/nextjs/cql-missing-context',
            ),
        );
    }

    const {query, variables} = buildQuery(fragments, args);

    return evaluate<T>(
        query,
        Object.keys(variables).length > 0
            ? {
                context: {
                    attributes: variables,
                },
            }
            : undefined,
    );
}

type PreparedQuery = {
    query: string,
    variables: Record<string, JsonValue>,
};

function buildQuery(fragments: TemplateStringsArray, args: JsonValue[]): PreparedQuery {
    return {
        query: fragments.raw.reduce(
            (result, fragment, index) => `${result + fragment + resolveValue(args[index], index)}`,
            '',
        ),
        variables: Object.fromEntries(
            args.flatMap((value, index) => (isPrimitive(value) ? [] : [[getAttribute(index), value]])),
        ),
    };
}

function resolveValue(value: JsonValue|undefined, index: number): string {
    if (value === undefined) {
        return '';
    }

    if (isPrimitive(value)) {
        return JSON.stringify(value);
    }

    return `context['${getAttribute(index)}']`;
}

function getAttribute(index: number): string {
    return `arg${index}`;
}

function isPrimitive(value: unknown): value is number | boolean | string {
    return ['number', 'boolean', 'string'].includes(typeof value);
}
