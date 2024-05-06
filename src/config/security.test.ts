import {getApiKey, getAuthenticationKey, isUserTokenAuthenticationEnabled} from './security';

describe('security', () => {
    const identifier = '00000000-0000-0000-0000-000000000000';
    const privateKey = '302e020100300506032b6570042204206d0e45033d54'
        + 'aa3231fcef9f0eaa1ff559a68884dbcc8931181b312f90513261';

    describe('getApiKey', () => {
        beforeEach(() => {
            delete process.env.CROCT_API_KEY;
        });

        it('should return the API key', () => {
            process.env.CROCT_API_KEY = identifier;

            expect(getApiKey().export()).toBe(process.env.CROCT_API_KEY);
        });

        it('should throw an error if the API key is not set', () => {
            expect(() => getApiKey()).toThrow(
                'Croct\'s API key is missing. '
                + 'Did you forget to set the CROCT_API_KEY environment variable?',
            );
        });

        it('should throw an error if the API key is invalid', () => {
            process.env.CROCT_API_KEY = 'invalid';

            expect(() => getApiKey())
                .toThrow('Croct\'s API key is invalid. Please check the CROCT_API_KEY environment variable.');
        });
    });

    describe('getAuthenticationKey', () => {
        beforeEach(() => {
            delete process.env.CROCT_API_KEY;
        });

        it('should return the API key', () => {
            process.env.CROCT_API_KEY = `${identifier}:${privateKey}`;

            expect(getAuthenticationKey().export()).toBe(process.env.CROCT_API_KEY);
        });

        it('should throw an error if the API key does not have authentication permission', () => {
            process.env.CROCT_API_KEY = identifier;

            expect(() => getAuthenticationKey()).toThrow(
                'Croct\'s API key does not have a private key. '
                    + 'Please generate an API key with authenticate permissions and update '
                    + 'the CROCT_API_KEY environment variable.',
            );
        });

        it('should throw an error if the API key is not set', () => {
            expect(() => getAuthenticationKey())
                .toThrow('Croct\'s API key is missing. Did you forget to set the CROCT_API_KEY environment variable?');
        });

        it('should throw an error if the API key is invalid', () => {
            process.env.CROCT_API_KEY = 'invalid';

            expect(() => getAuthenticationKey())
                .toThrow('Croct\'s API key is invalid. Please check the CROCT_API_KEY environment variable.');
        });
    });

    describe('isUserTokenAuthenticationEnabled', () => {
        beforeEach(() => {
            delete process.env.CROCT_API_KEY;
            delete process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION;
        });

        it('should return false if no API key is set', () => {
            expect(isUserTokenAuthenticationEnabled()).toBe(false);
        });

        it('should return true if the environment variable is not set', () => {
            process.env.CROCT_API_KEY = `${identifier}:${privateKey}`;

            expect(isUserTokenAuthenticationEnabled()).toBe(true);
        });

        it('should return true if the environment variable is empty', () => {
            process.env.CROCT_API_KEY = `${identifier}:${privateKey}`;
            process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION = '';

            expect(isUserTokenAuthenticationEnabled()).toBe(true);
        });

        it('should return true if the environment variable is set to false', () => {
            process.env.CROCT_API_KEY = `${identifier}:${privateKey}`;
            process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION = 'false';

            expect(isUserTokenAuthenticationEnabled()).toBe(true);
        });

        it('should return false if the environment variable is set to true', () => {
            process.env.CROCT_API_KEY = `${identifier}:${privateKey}`;
            process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION = 'true';

            expect(isUserTokenAuthenticationEnabled()).toBe(false);
        });
    });
});
