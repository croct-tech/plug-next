export type CookieOptions = {
    name: string,
    secure?: boolean,
    maxAge?: number,
    domain?: string,
    path?: string,
    sameSite?: 'strict' | 'lax' | 'none',
    httpOnly?: boolean,
};

export function getClientIdCookieOptions(): CookieOptions {
    const duration = normalizeValue(process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION, `${365 * 24 * 60 * 60}`);
    const parsedDuration = Number.parseInt(duration, 10);

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        throw new Error(
            `Croct's cookie duration must be a positive integer, got '${duration}'. `
            + 'Please check the NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION environment variable.',
        );
    }

    const domain = normalizeValue(process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DOMAIN, '');

    return {
        name: normalizeValue(process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_NAME, 'ct.cid'),
        maxAge: parsedDuration,
        secure: true,
        path: '/',
        sameSite: 'strict',
        ...(domain !== '' ? {domain: domain} : {}),
    };
}

export function getUserTokenCookieOptions(): CookieOptions {
    const duration = normalizeValue(process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION, `${7 * 24 * 60 * 60}`);
    const parsedDuration = Number.parseInt(duration, 10);

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        throw new Error(
            `Croct's cookie duration must be a positive integer, got '${duration}'. `
            + 'Please check the NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION environment variable.',
        );
    }

    const domain = normalizeValue(process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DOMAIN, '');

    return {
        name: normalizeValue(process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_NAME, 'ct.utk'),
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
