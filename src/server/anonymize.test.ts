import {ApiKey as MockApiKey} from '@croct/sdk/apiKey';
import {cookies} from 'next/headers';
import {Token} from '@croct/sdk/token';
import {getAppId} from '@/config/appId';
import {getAuthenticationKey, isUserTokenAuthenticationEnabled} from '@/config/security';
import {anonymize} from '@/server/anonymize';

jest.mock(
    'uuid',
    () => ({
        v4: jest.fn(() => '00000000-0000-0000-0000-000000000000'),
    }),
);

jest.mock(
    '@/config/security',
    () => {
        const identifier = '00000000-0000-0000-0000-000000000000';
        const apiKey = MockApiKey.of(identifier);

        return {
            __esModule: true,
            ...jest.requireActual('@/config/security'),
            getApiKey: jest.fn(() => apiKey),
            getAuthenticationKey: jest.fn(() => apiKey),
            isUserTokenAuthenticationEnabled: jest.fn(() => false),
        };
    },
);

jest.mock(
    '@/config/appId',
    () => ({
        __esModule: true,
        ...jest.requireActual('@/config/appId'),
        getAppId: jest.fn(() => '00000000-0000-0000-0000-000000000000'),
    }),
);

jest.mock(
    '@/config/cookie',
    () => ({
        __esModule: true,
        ...jest.requireActual('@/config/cookie'),
        getUserTokenCookieOptions: jest.fn(
            () => ({
                name: 'croct',
                maxAge: 86400,
                path: '/',
                domain: undefined,
                secure: false,
                sameSite: 'lax',
            }),
        ),
    }),
);

jest.mock(
    'next/headers',
    () => {
        const methods = {
            set: jest.fn(),
        };

        return {
            __esModule: true,
            ...jest.requireActual('next/headers'),
            cookies: jest.fn(() => methods),
        };
    },
);

describe('anonymize', () => {
    afterEach(() => {
        jest.mocked(cookies().set).mockClear();
        jest.mocked(isUserTokenAuthenticationEnabled).mockReset();
        jest.useRealTimers();
    });

    it('should set a unsigned token in the cookie', async () => {
        jest.useFakeTimers({now: Date.now()});

        jest.mocked(isUserTokenAuthenticationEnabled).mockReturnValue(false);

        expect(isUserTokenAuthenticationEnabled()).toBe(false);

        await expect(anonymize()).resolves.toBeUndefined();

        const jar = cookies();

        expect(jar.set).toHaveBeenCalledWith({
            name: 'croct',
            maxAge: 86400,
            path: '/',
            domain: undefined,
            secure: false,
            sameSite: 'lax',
            value: Token.issue(getAppId()).toString(),
        });
    });

    it('should set a signed token in the cookie', async () => {
        jest.useFakeTimers({now: Date.now()});

        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'ECDSA',
                namedCurve: 'P-256',
            },
            true,
            ['sign', 'verify'],
        );

        const exportedKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const privateKey = Buffer.from(exportedKey).toString('base64');

        const apiKey = MockApiKey.of('00000000-0000-0000-0000-000000000001', `ES256;${privateKey}`);

        jest.mocked(getAuthenticationKey).mockReturnValue(apiKey);

        jest.mocked(isUserTokenAuthenticationEnabled).mockReturnValue(true);

        expect(isUserTokenAuthenticationEnabled()).toBe(true);

        await expect(anonymize()).resolves.toBeUndefined();

        const jar = cookies();

        expect(jar.set).toHaveBeenCalledWith({
            name: 'croct',
            maxAge: 86400,
            path: '/',
            domain: undefined,
            secure: false,
            sameSite: 'lax',
            value: expect.toBeString(),
        });

        const {value: cookieValue} = jest.mocked(jar.set).mock.calls[0][0] as {value: string};
        const [header, payload, signature] = cookieValue.split('.');

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
});
