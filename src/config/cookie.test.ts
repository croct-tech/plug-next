import {getClientIdCookieOptions, getPreviewCookieOptions, getUserTokenCookieOptions} from '@/config/cookie';

describe('cookie', () => {
    describe('getCidCookieOptions', () => {
        beforeEach(() => {
            delete process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION;
            delete process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DOMAIN;
            delete process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_NAME;
        });

        it('should return default options', () => {
            expect(getClientIdCookieOptions()).toEqual({
                name: 'ct.cid',
                maxAge: 31536000,
                secure: true,
                path: '/',
                sameSite: 'strict',
            });
        });

        it('should return default options for empty values', () => {
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_NAME = '';
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION = '';
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DOMAIN = '';

            expect(getClientIdCookieOptions()).toEqual({
                name: 'ct.cid',
                maxAge: 31536000,
                secure: true,
                path: '/',
                sameSite: 'strict',
            });
        });

        it('should return custom options', () => {
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_NAME = 'custom-cid';
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION = '86400';
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DOMAIN = 'example.com';

            expect(getClientIdCookieOptions()).toEqual({
                name: process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_NAME,
                maxAge: Number.parseInt(process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION, 10),
                secure: true,
                path: '/',
                sameSite: 'strict',
                domain: process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DOMAIN,
            });
        });

        it('should throw an error if the duration is an invalid integer', () => {
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION = 'invalid';

            expect(() => getClientIdCookieOptions()).toThrow(
                'Croct\'s cookie duration must be a positive integer, got \'invalid\'. '
                + 'Please check the NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION environment variable.',
            );
        });

        it('should throw an error if the duration is not an positive integer', () => {
            process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION = '-1';

            expect(() => getClientIdCookieOptions()).toThrow(
                'Croct\'s cookie duration must be a positive integer, got \'-1\'. '
                + 'Please check the NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION environment variable.',
            );
        });
    });

    describe('getPreviewCookieOptions', () => {
        beforeEach(() => {
            delete process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_NAME;
        });

        it('should return default options', () => {
            expect(getPreviewCookieOptions()).toEqual({
                name: 'preview-token',
                path: '/',
                secure: true,
                sameSite: 'strict',
            });
        });

        it('should return default options for empty values', () => {
            process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_NAME = '';

            expect(getPreviewCookieOptions()).toEqual({
                name: 'preview-token',
                path: '/',
                secure: true,
                sameSite: 'strict',
            });
        });

        it('should return custom options', () => {
            process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_NAME = 'custom-preview-token';
            process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_DOMAIN = 'example.com';

            expect(getPreviewCookieOptions()).toEqual({
                name: process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_NAME,
                path: '/',
                domain: process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_DOMAIN,
                secure: true,
                sameSite: 'strict',
            });
        });
    });

    describe('getUserTokenCookieOptions', () => {
        beforeEach(() => {
            delete process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION;
            delete process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DOMAIN;
            delete process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_NAME;
        });

        it('should return default options', () => {
            expect(getUserTokenCookieOptions()).toEqual({
                name: 'ct.utk',
                maxAge: 604800,
                secure: true,
                path: '/',
                sameSite: 'strict',
            });
        });

        it('should return default options for empty values', () => {
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_NAME = '';
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION = '';
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DOMAIN = '';

            expect(getUserTokenCookieOptions()).toEqual({
                name: 'ct.utk',
                maxAge: 604800,
                secure: true,
                path: '/',
                sameSite: 'strict',
            });
        });

        it('should return custom options', () => {
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_NAME = 'custom-utk';
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION = '86400';
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DOMAIN = 'example.com';

            expect(getUserTokenCookieOptions()).toEqual({
                name: process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_NAME,
                maxAge: Number.parseInt(process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION, 10),
                secure: true,
                path: '/',
                sameSite: 'strict',
                domain: process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DOMAIN,
            });
        });

        it('should throw an error if the duration is an invalid integer', () => {
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION = 'invalid';

            expect(() => getUserTokenCookieOptions()).toThrow(
                'Croct\'s cookie duration must be a positive integer, got \'invalid\'. '
                + 'Please check the NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION environment variable.',
            );
        });

        it('should throw an error if the duration is not an positive integer', () => {
            process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION = '-1';

            expect(() => getUserTokenCookieOptions()).toThrow(
                'Croct\'s cookie duration must be a positive integer, got \'-1\'. '
                + 'Please check the NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION environment variable.',
            );
        });
    });
});
