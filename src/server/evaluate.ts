import {evaluate as executeQuery, EvaluationOptions as BaseOptions} from '@croct/plug-react/api';
import type {JsonValue} from '@croct/plug-react';
import {FilteredLogger} from '@croct/sdk/logging/filteredLogger';
import {ConsoleLogger} from '@croct/sdk/logging/consoleLogger';
import {formatCause} from '@croct/sdk/error';
import {getApiKey} from '@/config/security';
import {RequestContext, resolveRequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';
import {isAppRouter, RouteContext} from '@/headers';
import {getEnvEntry, getEnvFlag} from '@/config/env';
import {isDynamicServerError} from '@/errors';

export type EvaluationOptions<T extends JsonValue = JsonValue> = Omit<BaseOptions<T>, 'apiKey' | 'appId'> & {
    route?: RouteContext,
};

export function evaluate<T extends JsonValue>(query: string, options: EvaluationOptions<T> = {}): Promise<T> {
    const {route, logger, ...rest} = options;

    let context: RequestContext;

    try {
        context = resolveRequestContext(route);
    } catch (error) {
        if (isDynamicServerError(error) || route !== undefined) {
            return Promise.reject(error);
        }

        return Promise.reject(
            new Error(
                `Error resolving request context: ${formatCause(error)}. `
                + 'This error typically occurs when evaluate() is called outside of app routes '
                + 'without specifying the `route` option. '
                + 'For help, see: https://croct.help/sdk/nextjs/missing-route-context',
            ),
        );
    }

    const timeout = getDefaultFetchTimeout();

    return executeQuery<T>(query, {
        apiKey: getApiKey(),
        clientIp: context.clientIp ?? '127.0.0.1',
        ...(context.previewToken !== undefined && {previewToken: context.previewToken}),
        ...(context.userToken !== undefined && {userToken: context.userToken}),
        ...(context.clientId !== undefined && {clientId: context.clientId}),
        ...(context.clientAgent !== undefined && {clientAgent: context.clientAgent}),
        ...getEnvEntry('baseEndpointUrl', process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL),
        ...(timeout !== undefined && {timeout: timeout}),
        extra: {
            cache: 'no-store',
        },
        logger: logger ?? (
            getEnvFlag(process.env.NEXT_PUBLIC_CROCT_DEBUG)
                ? new ConsoleLogger()
                : FilteredLogger.include(new ConsoleLogger(), ['warn', 'error'])
        ),
        ...rest,
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
                'cql() can only be used with App Router. '
                + 'For help, see https://croct.help/sdk/nextjs/missing-route-context',
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
