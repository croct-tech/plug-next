import {cookies} from 'next/headers';
import {Token} from '@croct/sdk/token';
import type {NextRequest, NextResponse} from 'next/server';
import {issueToken} from '@/config/security';
import {identify} from '@/server/identify';
import type {RouteContext} from '@/headers';
import {getCookies} from '@/headers';

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
    () => ({
        __esModule: true,
        ...jest.requireActual('next/headers'),
        cookies: jest.fn(),
    }),
);

jest.mock('@/headers', () => {
    const original = jest.requireActual('@/headers');

    return {
        __esModule: true,
        ...original,
        getCookies: jest.fn(original.getCookies),
    };
});

describe('identify', () => {
    afterEach(() => {
        jest.mocked(cookies).mockReset();
    });

    it('should set a token in the cookie', async () => {
        const userId = 'user-id';
        const token = Token.issue('00000000-0000-0000-0000-000000000001', userId);

        const set = jest.fn();

        jest.mocked(cookies).mockReturnValue(
            {set: set} as Partial<ReturnType<typeof cookies>> as ReturnType<typeof cookies>,
        );

        jest.mocked(issueToken).mockResolvedValue(token);

        const context: RouteContext = {
            req: {} as NextRequest,
            res: {} as NextResponse,
        };

        await expect(identify(userId, context)).resolves.toBeUndefined();

        expect(getCookies).toHaveBeenCalledWith(context);

        expect(set).toHaveBeenCalledWith('croct', token.toString(), {
            maxAge: 86400,
            path: '/',
            domain: undefined,
            secure: false,
            sameSite: 'lax',
        });
    });

    it('should report an error if the route context is missing', async () => {
        jest.mocked(cookies).mockImplementation(() => {
            throw new Error('next/headers requires app router');
        });

        await expect(() => identify('foo')).rejects.toThrow(
            'identify() requires specifying the `route` parameter outside app routes. '
            + 'For help, see: https://croct.help/sdk/nextjs/missing-route-context',
        );
    });
});
