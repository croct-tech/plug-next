import {cookies} from 'next/headers';
import {Token} from '@croct/sdk/token';
import {issueToken} from '@/config/security';
import {anonymize} from '@/server/anonymize';

jest.mock(
    '@/config/security',
    () => ({
        __esModule: true,
        ...jest.requireActual('@/config/security'),
        issueToken: jest.fn(),
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
    });

    it('should set a token in the cookie', async () => {
        const token = Token.issue('00000000-0000-0000-0000-000000000001');

        jest.mocked(issueToken).mockResolvedValue(token);

        await expect(anonymize()).resolves.toBeUndefined();

        const jar = cookies();

        expect(jar.set).toHaveBeenCalledWith({
            name: 'croct',
            maxAge: 86400,
            path: '/',
            domain: undefined,
            secure: false,
            sameSite: 'lax',
            value: token.toString(),
        });
    });
});
