import 'server-only';

import {DynamicContentOptions, fetchContent as loadContent} from '@croct/plug-react/api';
import type {SlotContent, VersionedSlotId, JsonObject} from '@croct/plug-react';
import {headers} from 'next/headers';
import {getApiKey} from '@/utils/apiKey';
import {getRequestContext} from '@/utils/request';

export type FetchOptions<T extends JsonObject = JsonObject> = Omit<DynamicContentOptions<T>, 'apiKey'>;

export function fetchContent<I extends VersionedSlotId, C extends JsonObject>(
    slotId: I,
    options: FetchOptions<SlotContent<I, C>> = {},
): Promise<SlotContent<I, C>> {
    const request = getRequestContext(headers());
    const promise = loadContent<I, C>(slotId, {
        apiKey: getApiKey(),
        clientIp: request.clientIp ?? '127.0.0.1',
        ...(request.previewToken !== undefined && {previewToken: request.previewToken}),
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
        extra: {
            cache: 'no-store',
        },
        ...options,
    });

    return promise.then(({content}) => content);
}
