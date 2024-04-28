import 'server-only';

import {evaluate as executeQuery, EvaluationOptions as BaseOptions} from '@croct/plug-react/api';
import type {JsonValue} from '@croct/plug-react';
import {headers} from 'next/headers';
import {getApiKey} from '@/utils/apiKey';
import {getRequestContext} from '@/utils/request';

export type EvaluationOptions<T extends JsonValue = JsonValue> = Omit<BaseOptions<T>, 'apiKey'>;

export function evaluate<T extends JsonValue>(query: string, options: EvaluationOptions<T> = {}): Promise<T> {
    const request = getRequestContext(headers());

    return executeQuery<T>(query, {
        apiKey: getApiKey(),
        clientIp: request.clientIp ?? '127.0.0.1',
        ...(request.previewToken !== undefined && {previewToken: request.previewToken}),
        ...(request.clientId !== undefined && {clientId: request.clientId}),
        ...(request.clientAgent !== undefined && {clientAgent: request.clientAgent}),
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
