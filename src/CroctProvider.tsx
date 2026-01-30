'use client';

import type {CroctProviderProps as ReactCroctProviderProps} from '@croct/plug-react/CroctProvider';
import {CroctProvider as ReactCroctProvider} from '@croct/plug-react/CroctProvider';
import type {FunctionComponent} from 'react';
import {getClientIdCookieOptions, getPreviewCookieOptions, getUserTokenCookieOptions} from '@/config/cookie';
import {getAppId} from '@/config/appId';
import {getEnvEntry, getEnvEntryFlag} from '@/config/env';
import {getDefaultFetchTimeout} from '@/config/timeout';

type OmittedProps = 'appId' | 'disableCidMirroring' | 'cidAssignerEndpointUrl';

export type CroctProviderProps = Omit<ReactCroctProviderProps, OmittedProps>
    & Partial<Pick<ReactCroctProviderProps, 'appId'>>;

export const CroctProvider: FunctionComponent<CroctProviderProps> = props => {
    const {appId = getAppId(), ...rest} = props;
    const defaultTimeout = getDefaultFetchTimeout();

    return (
        <ReactCroctProvider
            appId={appId}
            disableCidMirroring
            {...getEnvEntryFlag('debug', process.env.NEXT_PUBLIC_CROCT_DEBUG)}
            {...getEnvEntryFlag('test', process.env.NEXT_PUBLIC_CROCT_TEST)}
            {...getEnvEntry('baseEndpointUrl', process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL)}
            {...getEnvEntry('defaultPreferredLocale', process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE)}
            {...(defaultTimeout !== undefined ? {defaultFetchTimeout: defaultTimeout} : {})}
            cookie={{
                clientId: getClientIdCookieOptions(),
                userToken: getUserTokenCookieOptions(),
                previewToken: getPreviewCookieOptions(),
            }}
            {...rest}
        />
    );
};
