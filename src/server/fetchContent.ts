import 'server-only';

import {DynamicContentOptions, fetchContent as loadContent} from '@croct/plug-react/api';
import type {SlotContent, VersionedSlotId, JsonObject} from '@croct/plug-react';
import {FilteredLogger} from '@croct/sdk/logging/filteredLogger';
import {ConsoleLogger} from '@croct/sdk/logging/consoleLogger';
import {cookies, headers} from 'next/headers';
import {getApiKey} from '@/config/security';
import {getRequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';

export type FetchOptions<T extends JsonObject = JsonObject> = Omit<DynamicContentOptions<T>, 'apiKey' | 'appId'>;

export function fetchContent<I extends VersionedSlotId, C extends JsonObject>(
    slotId: I,
    options: FetchOptions<SlotContent<I, C>> = {},
): Promise<SlotContent<I, C>> {
    const request = getRequestContext(headers(), cookies());
    const promise = loadContent<I, C>(slotId, {
        apiKey: getApiKey(),
        clientIp: request.clientIp ?? '127.0.0.1',
        ...(request.previewToken !== undefined && {previewToken: request.previewToken}),
        ...(request.userToken !== undefined && {userToken: request.userToken}),
        ...(request.clientId !== undefined && {clientId: request.clientId}),
        ...(request.clientAgent !== undefined && {clientAgent: request.clientAgent}),
        ...(request.uri !== undefined
            ? {
                context: {
                    page: {
                        url: request.uri,
                        ...(request.referrer !== null ? {referrer: request.referrer} : {}),
                    },
                },
            }
            : {}
        ),
        timeout: getDefaultFetchTimeout(),
        extra: {
            cache: 'no-store',
        },
        ...options,
        logger: options.logger ?? FilteredLogger.include(new ConsoleLogger(), ['warn', 'error']),
    });

    return promise.then(({content}) => content);
}
