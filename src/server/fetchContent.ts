import {DynamicContentOptions, fetchContent as loadContent} from '@croct/plug-react/api';
import type {SlotContent, VersionedSlotId, JsonObject} from '@croct/plug-react';
import {FilteredLogger} from '@croct/sdk/logging/filteredLogger';
import {ConsoleLogger} from '@croct/sdk/logging/consoleLogger';
import {getApiKey} from '@/config/security';
import {RequestContext, resolveRequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';
import {RouteContext} from '@/headers';

export type FetchOptions<T extends JsonObject = JsonObject> = Omit<DynamicContentOptions<T>, 'apiKey' | 'appId'> & {
    route?: RouteContext,
};

export function fetchContent<I extends VersionedSlotId, C extends JsonObject>(
    slotId: I,
    options: FetchOptions<SlotContent<I, C>> = {},
): Promise<SlotContent<I, C>> {
    const {route, ...rest} = options;

    let context: RequestContext;

    try {
        context = resolveRequestContext(route);
    } catch (error) {
        if (route === undefined) {
            return Promise.reject(
                new Error(
                    'The fetchContent() function requires a server-side context outside app routes. '
                    + 'For help, see: https://croct.help/sdk/nextjs/fetch-content-route-context',
                ),
            );
        }

        return Promise.reject(error);
    }

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
