import {useContent as useContentReact, UseContentOptions, SlotContent, VersionedSlotId} from '@croct/plug-react';
// eslint-disable-next-line import/extensions -- Extension needed to work on both CJS and ESM
import {NextRouter, useRouter as usePageRouter} from 'next/router.js';

export type {UseContentOptions} from '@croct/plug-react';

function useContentNext(id: VersionedSlotId, options?: UseContentOptions<any, any>): SlotContent {
    const router = useRouter();
    const preferredLocale = getLocale(options?.preferredLocale ?? router.locale);

    return useContentReact<any, any, any>(
        id,
        preferredLocale !== null
            ? {...options, preferredLocale: preferredLocale}
            : options,
    );
}

function getLocale(locale?: string): string|null {
    if (locale !== undefined && locale !== '') {
        return locale;
    }

    const defaultLocale = process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE ?? '';

    if (defaultLocale !== '') {
        return defaultLocale;
    }

    return null;
}

function useRouter(): Pick<NextRouter, 'locale'> {
    try {
        return usePageRouter();
    } catch {
        return {};
    }
}

export const useContent: typeof useContentReact = useContentNext;
