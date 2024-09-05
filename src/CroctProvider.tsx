'use client';

import {
    CroctProviderProps as ReactCroctProviderProps,
    CroctProvider as ReactCroctProvider,
} from '@croct/plug-react/CroctProvider';
import {FunctionComponent} from 'react';
import {getClientIdCookieOptions, getPreviewCookieOptions, getUserTokenCookieOptions} from '@/config/cookie';
import {getAppId} from '@/config/appId';

type OmittedProps = 'appId' | 'disableCidMirroring' | 'cidAssignerEndpointUrl';

export type CroctProviderProps = Omit<ReactCroctProviderProps, OmittedProps>
    & Partial<Pick<ReactCroctProviderProps, 'appId'>>;

export const CroctProvider: FunctionComponent<CroctProviderProps> = props => {
    const {appId = getAppId(), ...rest} = props;
    const debugMode = process.env.NEXT_PUBLIC_CROCT_DEBUG === 'true';
    const endpointUrl = normalizeEnvVar(process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL);

    return (
        <ReactCroctProvider
            debug={debugMode}
            appId={appId}
            {...(endpointUrl !== undefined ? {baseEndpointUrl: endpointUrl} : {})}
            cookie={{
                clientId: getClientIdCookieOptions(),
                userToken: getUserTokenCookieOptions(),
                previewToken: getPreviewCookieOptions(),
            }}
            {...rest}
        />
    );
};

function normalizeEnvVar(value: string | undefined): string|undefined {
    return value === undefined || value === '' ? undefined : value;
}
