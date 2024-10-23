import {
    DynamicContentOptions as DynamicOptions,
    StaticContentOptions as StaticOptions,
    fetchContent as loadContent,
    FetchResponse,
} from '@croct/plug-react/api';
import type {SlotContent, VersionedSlotId, JsonObject} from '@croct/plug-react';
import {FilteredLogger} from '@croct/sdk/logging/filteredLogger';
import {ConsoleLogger} from '@croct/sdk/logging/consoleLogger';
import {getApiKey} from '@/config/security';
import {RequestContext, resolvePreferredLocale, resolveRequestContext} from '@/config/context';
import {getDefaultFetchTimeout} from '@/config/timeout';
import {RouteContext} from '@/headers';
import {getEnvEntry, getEnvFlag} from '@/config/env';

export type DynamicContentOptions<T extends JsonObject = JsonObject> = Omit<DynamicOptions<T>, 'apiKey' | 'appId'>;

export type StaticContentOptions<T extends JsonObject = JsonObject> = Omit<StaticOptions<T>, 'apiKey' | 'appId'>;

export type FetchOptions<T extends JsonObject = JsonObject> = (DynamicContentOptions<T> | StaticContentOptions<T>) & {
    route?: RouteContext,
};

export function fetchContent<I extends VersionedSlotId, C extends JsonObject>(
    slotId: I,
    options: FetchOptions<SlotContent<I, C>> = {},
): Promise<FetchResponse<I, C>> {
    const {logger, route, ...rest} = options;

    const timeout = getDefaultFetchTimeout();
    const commonOptions = {
        apiKey: getApiKey(),
        ...getEnvEntry('baseEndpointUrl', process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL),
        ...(timeout !== undefined && {timeout: timeout}),
        logger: logger ?? (
            getEnvFlag(process.env.NEXT_PUBLIC_CROCT_DEBUG)
                ? new ConsoleLogger()
                : FilteredLogger.include(new ConsoleLogger(), ['warn', 'error'])
        ),
    } satisfies Partial<StaticOptions>;

    if (rest.static === true) {
        let preferredLocale = rest.preferredLocale ?? null;

        if (preferredLocale === null) {
            try {
                preferredLocale = resolvePreferredLocale(route);
            } catch {
                // Static content can be fetched from anywhere
            }
        }

        return loadContent<I, C>(slotId, {
            ...commonOptions,
            ...rest,
            ...(preferredLocale !== null && {preferredLocale: preferredLocale}),
        });
    }

    let context: RequestContext;

    try {
        context = resolveRequestContext(route);
    } catch (error) {
        if (route === undefined) {
            return Promise.reject(
                new Error(
                    'fetchContent() requires specifying the `route` option outside app routes. '
                    + 'For help, see: https://croct.help/sdk/nextjs/missing-route-context',
                ),
            );
        }

        return Promise.reject(error);
    }

    return loadContent<I, C>(slotId, {
        clientIp: context.clientIp ?? '127.0.0.1',
        ...(context.previewToken !== undefined && {previewToken: context.previewToken}),
        ...(context.userToken !== undefined && {userToken: context.userToken}),
        ...(context.clientId !== undefined && {clientId: context.clientId}),
        ...(context.clientAgent !== undefined && {clientAgent: context.clientAgent}),
        ...(context.preferredLocale !== undefined && {preferredLocale: context.preferredLocale}),
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
        extra: {
            cache: 'no-store',
        },
        ...commonOptions,
        ...rest,
    }).catch(error => {
        const locale = options.preferredLocale ?? null;
        const file = `${slotId}${locale !== null ? `.${locale}` : ''}.json`;

        return import(`@croct/content/${file}`).catch(() => Promise.reject(error));
    });
}
