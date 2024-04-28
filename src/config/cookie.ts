export type CookieOptions = {
    name: string,
    secure?: boolean,
    maxAge?: number,
    domain?: string,
    path?: string,
    sameSite?: 'strict' | 'lax' | 'none',
    httpOnly?: boolean,
};

export function getCidCookieOptions(): CookieOptions {
    const duration = normalizeValue(process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION, '31536000');
    const parsedDuration = Number.parseInt(duration, 10);

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        throw new Error(
            `The cookie duration must be a positive integer, got '${duration}'. `
            + 'Please check the NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION environment variable.',
        );
    }

    const domain = normalizeValue(process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DOMAIN, '');

    return {
        name: normalizeValue(process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_NAME, 'cid'),
        maxAge: parsedDuration,
        secure: true,
        path: '/',
        sameSite: 'strict',
        ...(domain !== '' ? {domain: domain} : {}),
    };
}

export function getPreviewCookieOptions(): CookieOptions {
    return {
        name: normalizeValue(process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_NAME, 'preview-token'),
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
    };
}

function normalizeValue(value: string|undefined, defaultValue: string): string {
    if (value === undefined || value === '') {
        return defaultValue;
    }

    return value;
}
