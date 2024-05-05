import {ApiKey as MockApiKey} from '@croct/sdk/apiKey';
import {cookies} from 'next/headers';
import {Token} from '@croct/sdk/token';
import {v4 as uuid} from 'uuid';
import {identify} from '@/server/identify';
import {getAppId} from '@/config/appId';
import {getAuthenticationKey, isTokenAuthenticationEnabled} from '@/config/security';

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
            isTokenAuthenticationEnabled: jest.fn(() => false),
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

describe('identify', () => {
    afterEach(() => {
        jest.mocked(cookies().set).mockClear();
        jest.mocked(isTokenAuthenticationEnabled).mockReset();
        jest.useRealTimers();
    });

    it('should set a unsigned token in the cookie', async () => {
        jest.useFakeTimers({now: Date.now()});

        const userId = 'test';

        jest.mocked(isTokenAuthenticationEnabled).mockReturnValue(false);

        expect(isTokenAuthenticationEnabled()).toBe(false);

        await expect(identify(userId)).resolves.toBeUndefined();

        const jar = cookies();

        expect(jar.set).toHaveBeenCalledWith({
            name: 'croct',
            maxAge: 86400,
            path: '/',
            domain: undefined,
            secure: false,
            sameSite: 'lax',
            value: Token.issue(getAppId(), userId).toString(),
        });
    });

    it('should set a signed token in the cookie', async () => {
        jest.useFakeTimers({now: Date.now()});
        const userId = 'test';

        jest.mocked(getAuthenticationKey).mockReturnValue(
            MockApiKey.of(
                '00000000-0000-0000-0000-000000000001',
                '302e020100300506032b6570042204206d0e45033d54'
                + 'aa3231fcef9f0eaa1ff559a68884dbcc8931181b312f90513261',
            ),
        );

        jest.mocked(isTokenAuthenticationEnabled).mockReturnValue(true);

        expect(isTokenAuthenticationEnabled()).toBe(true);

        await expect(identify(userId)).resolves.toBeUndefined();

        const jar = cookies();

        expect(jar.set).toHaveBeenCalledWith({
            name: 'croct',
            maxAge: 86400,
            path: '/',
            domain: undefined,
            secure: false,
            sameSite: 'lax',
            value: await Token.issue(getAppId(), userId)
                .withTokenId(uuid())
                .signedWith(getAuthenticationKey())
                .then(token => token.toString()),
        });
    });
});
