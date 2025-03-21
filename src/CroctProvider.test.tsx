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
        delete process.env.NEXT_PUBLIC_CROCT_TEST;
        delete process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL;
        delete process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT;
        delete process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE;
    });

    afterEach(() => {
        // eslint-disable-next-line no-console -- Needed to restore the original console.error.
        console.error = consoleError;
    });

    it('should fail if no application ID is provided', () => {
        jest.spyOn(console, 'error').mockImplementation();

        process.env.NEXT_PUBLIC_CROCT_APP_ID = '';

        expect(() => render(<CroctProvider />)).toThrow(
            'Croct\'s Application ID is missing. '
            + 'Did you forget to set the `NEXT_PUBLIC_CROCT_APP_ID` environment variable? '
            + 'For help, see: https://croct.help/sdk/nextjs/missing-environment-variable',
        );
    });

    it('should not require environment variables to be set', () => {
        render(<CroctProvider appId="00000000-0000-0000-0000-000000000000" />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            {
                appId: '00000000-0000-0000-0000-000000000000',
                disableCidMirroring: true,
                cookie: {
                    clientId: getClientIdCookieOptions(),
                    userToken: getUserTokenCookieOptions(),
                    previewToken: getPreviewCookieOptions(),
                },
            },
            undefined,
        );
    });

    it('should allow overriding the environment configuration', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
        process.env.NEXT_PUBLIC_CROCT_DEBUG = 'true';
        process.env.NEXT_PUBLIC_CROCT_TEST = 'true';
        process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL = 'https://example.com';
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = '3000';
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE = 'es';

        const config = {
            appId: '11111111-1111-1111-1111-111111111111',
            debug: false,
            test: false,
            baseEndpointUrl: 'https://override.com',
            defaultFetchTimeout: 2000,
            defaultPreferredLocale: 'en',
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
                test: config.test,
                cookie: config.cookie,
                baseEndpointUrl: config.baseEndpointUrl,
                defaultFetchTimeout: config.defaultFetchTimeout,
                defaultPreferredLocale: config.defaultPreferredLocale,
                disableCidMirroring: true,
            },
            undefined,
        );
    });

    it('should detect the application ID from the environment', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';

        render(<CroctProvider />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            expect.objectContaining({
                appId: process.env.NEXT_PUBLIC_CROCT_APP_ID,
            }),
            undefined,
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
            undefined,
        );
    });

    it('should detect the test mode from the environment', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
        process.env.NEXT_PUBLIC_CROCT_TEST = 'true';

        render(<CroctProvider />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            expect.objectContaining({
                test: true,
            }),
            undefined,
        );
    });

    it('should detect the base endpoint URL from the environment', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
        process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL = 'https://example.com';

        render(<CroctProvider />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            expect.objectContaining({
                baseEndpointUrl: process.env.NEXT_PUBLIC_CROCT_BASE_ENDPOINT_URL,
            }),
            undefined,
        );
    });

    it('should detect the default fetch timeout from the environment', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = '3000';

        render(<CroctProvider />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            expect.objectContaining({
                defaultFetchTimeout: 3000,
            }),
            undefined,
        );
    });

    it('should detect the default preferred locale from the environment', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE = 'es';

        render(<CroctProvider />);

        expect(UnderlyingProvider).toHaveBeenCalledWith<[ResolvedProviderProps, any]>(
            expect.objectContaining({
                defaultPreferredLocale: process.env.NEXT_PUBLIC_CROCT_DEFAULT_PREFERRED_LOCALE,
            }),
            undefined,
        );
    });
});
