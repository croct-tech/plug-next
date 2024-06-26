/**
 * @jest-environment jsdom
 */

import {render} from '@testing-library/react';
import {
    CroctProvider as UnderlyingProvider,
    CroctProviderProps as ResolvedProviderProps,
} from '@croct/plug-react/CroctProvider';
import {CroctProvider, CroctProviderProps} from './CroctProvider';
import {getClientIdCookieOptions, getPreviewCookieOptions, getUserTokenCookieOptions} from '@/config/cookie';

jest.mock(
    '@croct/plug-react/CroctProvider',
    () => ({
        ...jest.requireActual('@croct/plug-react/CroctProvider'),
        CroctProvider: jest.fn(() => <div />),
    }),
);

// eslint-disable-next-line no-console -- Needed to test console output.
const consoleError = console.error;

describe('<CroctProvider />', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        delete process.env.NEXT_PUBLIC_CROCT_APP_ID;
        delete process.env.NEXT_PUBLIC_CROCT_DEBUG;
    });

    afterEach(() => {
        // eslint-disable-next-line no-console -- Needed to restore the original console.error.
        console.error = consoleError;
    });

    it('should fail if no application ID is provided', () => {
        jest.spyOn(console, 'error').mockImplementation();

        process.env.NEXT_PUBLIC_CROCT_APP_ID = '';

        expect(() => render(<CroctProvider />)).toThrow(
            'Croct\'s application ID is missing. '
            + 'Did you forget to set the NEXT_PUBLIC_CROCT_APP_ID environment variable?',
        );
    });

    it('should not require environment variables to be set', () => {
        render(<CroctProvider appId="00000000-0000-0000-0000-000000000000" />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            {
                appId: '00000000-0000-0000-0000-000000000000',
                debug: false,
                disableCidMirroring: true,
                cookie: {
                    clientId: getClientIdCookieOptions(),
                    userToken: getUserTokenCookieOptions(),
                    previewToken: getPreviewCookieOptions(),
                },
            },
            expect.anything(),
        );
    });

    it('should allow overriding the environment configuration', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
        process.env.NEXT_PUBLIC_CROCT_DEBUG = 'true';

        const config = {
            appId: '11111111-1111-1111-1111-111111111111',
            debug: false,
            enableCidMirroring: true,
            cookie: {
                clientId: {
                    name: 'custom-client-id',
                    domain: 'example.com',
                    secure: true,
                    sameSite: 'strict',
                },
                userToken: {
                    name: 'custom-user-token',
                    domain: 'example.com',
                    secure: true,
                    sameSite: 'strict',
                },
            },
        } satisfies CroctProviderProps;

        render(<CroctProvider {...config} />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            {
                appId: config.appId,
                debug: config.debug,
                disableCidMirroring: !config.enableCidMirroring,
                cookie: config.cookie,
            },
            expect.anything(),
        );
    });

    it('should detect the application ID from the environment', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';

        render(<CroctProvider />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            expect.objectContaining({
                appId: process.env.NEXT_PUBLIC_CROCT_APP_ID,
            }),
            expect.anything(),
        );
    });

    it('should detect the debug mode from the environment', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
        process.env.NEXT_PUBLIC_CROCT_DEBUG = 'true';

        render(<CroctProvider />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            expect.objectContaining({
                debug: true,
            }),
            expect.anything(),
        );
    });
});
