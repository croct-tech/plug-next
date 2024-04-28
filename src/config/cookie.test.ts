import {getCidCookieOptions, getPreviewCookieOptions} from '@/config/cookie';

describe('getCidCookieOptions', () => {
    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION;
        delete process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DOMAIN;
        delete process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_NAME;
    });

    it('should return default options', () => {
        expect(getCidCookieOptions()).toEqual({
            name: 'cid',
            maxAge: 31536000,
            secure: true,
            path: '/',
            sameSite: 'strict',
        });
    });

    it('should return default options for empty values', () => {
        process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_NAME = '';
        process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION = '';
        process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DOMAIN = '';

        expect(getCidCookieOptions()).toEqual({
            name: 'cid',
            maxAge: 31536000,
            secure: true,
            path: '/',
            sameSite: 'strict',
        });
    });

    it('should return custom options', () => {
        process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_NAME = 'custom-cid';
        process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION = '86400';
        process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DOMAIN = 'example.com';

        expect(getCidCookieOptions()).toEqual({
            name: process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_NAME,
            maxAge: Number.parseInt(process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION, 10),
            secure: true,
            path: '/',
            sameSite: 'strict',
            domain: process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DOMAIN,
        });
    });

    it('should throw an error if duration is a valid integer', () => {
        process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION = 'invalid';

        expect(() => getCidCookieOptions()).toThrow(
            'The cookie duration must be a positive integer, got \'invalid\'. '
            + 'Please check the NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION environment variable.',
        );
    });

    it('should throw an error if duration is not an positive integer', () => {
        process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION = '-1';

        expect(() => getCidCookieOptions()).toThrow(
            'The cookie duration must be a positive integer, got \'-1\'. '
            + 'Please check the NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION environment variable.',
        );
    });
});

describe('getPreviewCookieOptions', () => {
    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_NAME;
    });

    it('should return default options', () => {
        expect(getPreviewCookieOptions()).toEqual({
            name: 'preview-token',
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
        });
    });

    it('should return default options for empty values', () => {
        process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_NAME = '';

        expect(getPreviewCookieOptions()).toEqual({
            name: 'preview-token',
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
        });
    });

    it('should return custom options', () => {
        process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_NAME = 'custom-preview-token';

        expect(getPreviewCookieOptions()).toEqual({
            name: process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_NAME,
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
        });
    });
});
