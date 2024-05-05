import {getAppId} from '@/config/appId';

describe('getAppId', () => {
    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_APP_ID;
    });

    it('should throw an error when the application ID is missing', () => {
        expect(() => getAppId()).toThrow(
            'Croct\'s application ID is missing. '
                + 'Did you forget to set the NEXT_PUBLIC_CROCT_APP_ID environment variable?',
        );
    });

    it('should throw an error when the application ID is empty', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '';

        expect(() => getAppId()).toThrow(
            'Croct\'s application ID is missing. '
            + 'Did you forget to set the NEXT_PUBLIC_CROCT_APP_ID environment variable?',
        );
    });

    it('should throw an error when the application ID is invalid', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = 'invalid';

        expect(() => getAppId()).toThrow(
            'Croct\'s application ID is invalid. '
                + 'Please check the NEXT_PUBLIC_CROCT_APP_ID environment variable.',
        );
    });

    it('should return the application ID', () => {
        process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';

        expect(getAppId()).toBe('00000000-0000-0000-0000-000000000000');
    });
});
