import 'server-only';

import {evaluate as executeQuery, EvaluationOptions as BaseOptions} from '@croct/plug-react/api';
import type {JsonValue} from '@croct/plug-react';
import {cookies, headers} from 'next/headers';
import {getApiKey} from '@/config/security';
import {getRequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';

export type EvaluationOptions<T extends JsonValue = JsonValue> = Omit<BaseOptions<T>, 'apiKey' | 'appId'>;

export function evaluate<T extends JsonValue>(query: string, options: EvaluationOptions<T> = {}): Promise<T> {
    const request = getRequestContext(headers(), cookies());

    return executeQuery<T>(query, {
        apiKey: getApiKey().getIdentifier(),
        clientIp: request.clientIp ?? '127.0.0.1',
        ...(request.previewToken !== undefined && {previewToken: request.previewToken}),
        ...(request.userToken !== undefined && {userToken: request.userToken}),
        ...(request.clientId !== undefined && {clientId: request.clientId}),
        ...(request.clientAgent !== undefined && {clientAgent: request.clientAgent}),
        timeout: getDefaultFetchTimeout(),
        extra: {
            cache: 'no-store',
        },
        ...options,
        ...(request.uri !== undefined
            ? {
                context: {
                    page: {
                        url: request.uri,
                        ...(request.referrer !== null ? {referrer: request.referrer} : {}),
                        ...options.context?.page,
                    },
                    ...options.context,
                },
            }
            : {}
        ),
    });
}

export function cql<T extends JsonValue>(fragments: TemplateStringsArray, ...args: JsonValue[]): Promise<T> {
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
