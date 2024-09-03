import {DynamicContentOptions, fetchContent as loadContent} from '@croct/plug-react/api';
import type {SlotContent, VersionedSlotId, JsonObject} from '@croct/plug-react';
import {FilteredLogger} from '@croct/sdk/logging/filteredLogger';
import {ConsoleLogger} from '@croct/sdk/logging/consoleLogger';
import {getApiKey} from '@/config/security';
import {getRequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';
import {getCookies, getHeaders, NextRequestContext} from '@/headers';

export type FetchOptions<T extends JsonObject = JsonObject> = Omit<DynamicContentOptions<T>, 'apiKey' | 'appId'> & {
    route?: NextRequestContext,
};

export function fetchContent<I extends VersionedSlotId, C extends JsonObject>(
    slotId: I,
    options: FetchOptions<SlotContent<I, C>> = {},
): Promise<SlotContent<I, C>> {
    const {route, ...rest} = options;
    const context = getRequestContext(getHeaders(route), getCookies(route));
    const promise = loadContent<I, C>(slotId, {
        apiKey: getApiKey(),
        clientIp: context.clientIp ?? '127.0.0.1',
        ...(context.previewToken !== undefined && {previewToken: context.previewToken}),
        ...(context.userToken !== undefined && {userToken: context.userToken}),
        ...(context.clientId !== undefined && {clientId: context.clientId}),
        ...(context.clientAgent !== undefined && {clientAgent: context.clientAgent}),
        ...(context.uri !== undefined
            ? {
                context: {
                    page: {
                        url: context.uri,
                        ...(context.referrer !== null ? {referrer: context.referrer} : {}),
                    },
                },
            }
            : {}
        ),
        timeout: getDefaultFetchTimeout(),
        extra: {
            cache: 'no-store',
        },
        ...rest,
        logger: rest.logger ?? FilteredLogger.include(new ConsoleLogger(), ['warn', 'error']),
    });

    return promise.then(({content}) => content);
}
