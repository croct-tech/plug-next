'use client';

import {
    CroctProviderProps as ReactCroctProviderProps,
    CroctProvider as ReactCroctProvider,
} from '@croct/plug-react/CroctProvider';
import {FunctionComponent} from 'react';
import {getClientIdCookieOptions, getPreviewCookieOptions, getUserTokenCookieOptions} from '@/config/cookie';
import {getAppId} from '@/config/appId';

export type CroctProviderProps = Omit<ReactCroctProviderProps, 'appId' | 'disableCidMirroring'>
    & Partial<Pick<ReactCroctProviderProps, 'appId'>> & {
    enableCidMirroring?: boolean,
};

export const CroctProvider: FunctionComponent<CroctProviderProps> = props => {
    const {appId = getAppId(), enableCidMirroring = false, ...rest} = props;

    return (
        <ReactCroctProvider
            debug={process.env.NEXT_PUBLIC_CROCT_DEBUG === 'true'}
            appId={appId}
            disableCidMirroring={!enableCidMirroring}
            cookie={{
                clientId: getClientIdCookieOptions(),
                userToken: getUserTokenCookieOptions(),
                previewToken: getPreviewCookieOptions(),
            }}
            {...rest}
        />
    );
};
