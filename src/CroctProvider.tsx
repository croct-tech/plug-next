'use client';

import {
    CroctProviderProps as ReactCroctProviderProps,
    CroctProvider as ReactCroctProvider,
} from '@croct/plug-react/CroctProvider';
import {FunctionComponent} from 'react';
import {getCidCookieOptions} from '@/config/cookie';

export type CroctProviderProps = Omit<ReactCroctProviderProps, 'appId'>
    & Partial<Pick<ReactCroctProviderProps, 'appId'>>;

export const CroctProvider: FunctionComponent<CroctProviderProps> = props => {
    const {appId = (process.env.NEXT_PUBLIC_CROCT_APP_ID ?? ''), ...rest} = props;

    if (appId === '') {
        throw new Error(
            'The Croct application ID is missing. '
            + 'Did you forget to define the NEXT_PUBLIC_CROCT_APP_ID environment variable?',
        );
    }

    return (
        <ReactCroctProvider
            appId={appId}
            cidCookie={getCidCookieOptions()}
            {...rest}
        />
    );
};
