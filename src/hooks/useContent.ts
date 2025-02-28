import {useContent as useContentReact, UseContentOptions, SlotContent, VersionedSlotId} from '@croct/plug-react';
import {NextRouter, useRouter as usePageRouter} from 'next/router';

export type {UseContentOptions} from '@croct/plug-react';

function useContentNext(id: VersionedSlotId, options?: UseContentOptions<any, any>): SlotContent {
    const {locale = ''} = useRouter();

    return useContentReact<any, any, any>(
        id,
        options?.preferredLocale === undefined && locale !== ''
            ? {...options, preferredLocale: locale}
            : options,
    );
}

export function useRouter(): Pick<NextRouter, 'locale'> {
    try {
        return usePageRouter();
    } catch {
        return {};
    }
}

export const useContent: typeof useContentReact = useContentNext;
