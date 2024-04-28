/**
 * @jest-environment jsdom
 */

import {render} from '@testing-library/react';
import {CroctProvider as UnderlyingProvider} from '@croct/plug-react/CroctProvider';
import {CroctProvider} from './CroctProvider';
import {getCidCookieOptions} from '@/config/cookie';

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
    });

    afterEach(() => {
        // eslint-disable-next-line no-console -- Needed to restore the original console.error.
        console.error = consoleError;
    });

    it('should fail no application ID is provided', () => {
        jest.spyOn(console, 'error').mockImplementation();

        process.env.NEXT_PUBLIC_CROCT_APP_ID = '';

        expect(
            () => render(<CroctProvider />),
        ).toThrow(
            'The Croct application ID is missing. '
            + 'Did you forget to define the NEXT_PUBLIC_CROCT_APP_ID environment variable?',
        );
    });

    it('should detect the environment configuration', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';

        render(<CroctProvider debug />);

        expect(UnderlyingProvider).toHaveBeenCalledWith(
            {
                debug: true,
                appId: process.env.NEXT_PUBLIC_CROCT_APP_ID,
                cidCookie: getCidCookieOptions(),
            },
            {},
        );
    });
});
