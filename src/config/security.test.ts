import {ApiKey as MockApiKey} from '@croct/sdk/apiKey';
import {
    getApiKey,
    getAuthenticationKey,
    getTokenDuration,
    issueToken,
    isUserTokenAuthenticationEnabled,
} from './security';
import {getAppId} from '@/config/appId';

describe('security', () => {
    const identifier = '00000000-0000-0000-0000-000000000000';
    const privateKey = 'ES256;MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg3TbbvRM7DNwxY3XGWDmlSRPSfZ9b+ch9TO3jQ6'
        + '8Zyj+hRANCAASmJj/EiEhUaLAWnbXMTb/85WADkuFgoELGZ5ByV7YPlbb2wY6oLjzGkpF6z8iDrvJ4kV6EhaJ4n0HwSQckVLNE';

    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    describe('getApiKey', () => {
        beforeEach(() => {
            delete process.env.CROCT_API_KEY;
        });

        it('should return the API key', () => {
            const key = `${identifier}:${privateKey}`;

            process.env.CROCT_API_KEY = key;

            expect(getApiKey().export()).toBe(key);
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

    describe('getTokenDuration', () => {
        beforeEach(() => {
            delete process.env.CROCT_TOKEN_DURATION;
        });

        it('should return the default duration if not set', () => {
            expect(getTokenDuration()).toBe(24 * 60 * 60);
        });

        it('should return the duration if set', () => {
            process.env.CROCT_TOKEN_DURATION = '3600';

            expect(getTokenDuration()).toBe(3600);
        });

        it('should throw an error if the duration is not a number', () => {
            process.env.CROCT_TOKEN_DURATION = 'invalid';

            expect(() => getTokenDuration()).toThrow('The token duration must be a positive integer.');
        });

        it('should throw an error if the duration is not a positive number', () => {
            process.env.CROCT_TOKEN_DURATION = '-1';

            expect(() => getTokenDuration()).toThrow('The token duration must be a positive integer.');
        });
    });

    describe('issueToken', () => {
        beforeEach(() => {
            delete process.env.NEXT_PUBLIC_CROCT_APP_ID;
            delete process.env.CROCT_API_KEY;
            delete process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION;
            delete process.env.CROCT_TOKEN_DURATION;
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it.each<[string, string|undefined]>([
            ['an anonymous user', undefined],
            ['an identified user', 'user-id'],
        ])('should return a signed token for %s', async (_, userId) => {
            jest.useFakeTimers({now: Date.now()});

            const keyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256',
                },
                true,
                ['sign', 'verify'],
            );

            const localPrivateKey = Buffer.from(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))
                .toString('base64');

            const apiKey = MockApiKey.of('00000000-0000-0000-0000-000000000001', `ES256;${localPrivateKey}`);

            process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
            process.env.CROCT_API_KEY = apiKey.export();
            process.env.CROCT_TOKEN_DURATION = '3600';
            process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION = 'false';

            expect(getAppId()).toBe(process.env.NEXT_PUBLIC_CROCT_APP_ID);
            expect(getAuthenticationKey().export()).toBe(apiKey.export());
            expect(isUserTokenAuthenticationEnabled()).toBe(true);
            expect(getTokenDuration()).toBe(3600);

            const token = await issueToken(userId);

            expect(token.getHeaders()).toEqual({
                alg: 'ES256',
                typ: 'JWT',
                appId: process.env.NEXT_PUBLIC_CROCT_APP_ID,
                kid: await apiKey.getIdentifierHash(),
            });

            expect(token.getPayload()).toEqual({
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
                iss: 'croct.io',
                aud: 'croct.io',
                sub: userId,
                jti: expect.stringMatching(UUID_PATTERN),
            });

            const [header, payload, signature] = token.toString().split('.');

            const verification = crypto.subtle.verify(
                {
                    name: 'ECDSA',
                    hash: {
                        name: 'SHA-256',
                    },
                },
                keyPair.publicKey,
                Buffer.from(signature, 'base64url'),
                Buffer.from(`${header}.${payload}`),
            );

            await expect(verification).resolves.toBeTrue();
        });

        it.each<[string, string|undefined]>([
            ['an anonymous user', undefined],
            ['an identified user', 'user-id'],
        ])('should return a unsigned token for %s', async (_, userId) => {
            jest.useFakeTimers({now: Date.now()});

            process.env.NEXT_PUBLIC_CROCT_APP_ID = '00000000-0000-0000-0000-000000000000';
            process.env.CROCT_API_KEY = `${identifier}:${privateKey}`;
            process.env.CROCT_DISABLE_USER_TOKEN_AUTHENTICATION = 'true';
            process.env.CROCT_TOKEN_DURATION = '3600';

            expect(getAppId()).toBe(process.env.NEXT_PUBLIC_CROCT_APP_ID);
            expect(getAuthenticationKey().export()).toBe(process.env.CROCT_API_KEY);
            expect(isUserTokenAuthenticationEnabled()).toBe(false);
            expect(getTokenDuration()).toBe(3600);

            const token = await issueToken(userId);

            expect(token.getSignature()).toBe('');

            expect(token.getHeaders()).toEqual({
                alg: 'none',
                typ: 'JWT',
                appId: process.env.NEXT_PUBLIC_CROCT_APP_ID,
            });

            expect(token.getPayload()).toEqual({
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
                iss: 'croct.io',
                aud: 'croct.io',
                sub: userId,
                jti: expect.stringMatching(UUID_PATTERN),
            });
        });
    });
});
