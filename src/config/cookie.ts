/**
 * @internal
 */
export type CookieOptions = {
    name: string,
    secure?: boolean,
    maxAge?: number,
    domain?: string,
    path?: string,
    sameSite?: 'strict' | 'lax' | 'none',
    httpOnly?: boolean,
};

/**
 * @internal
 */
export function getClientIdCookieOptions(): CookieOptions {
    const duration = normalizeValue(process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION, `${365 * 24 * 60 * 60}`);
    const parsedDuration = Number.parseInt(duration, 10);

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        throw new Error(
            `Croct's cookie duration must be a positive integer, got '${duration}'. `
            + 'Please check the `NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DURATION` environment variable.',
        );
    }

    const domain = normalizeValue(process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_DOMAIN, '');

    return {
        name: normalizeValue(process.env.NEXT_PUBLIC_CROCT_CLIENT_ID_COOKIE_NAME, 'ct.client_id'),
        maxAge: parsedDuration,
        path: '/',
        ...(domain !== '' ? {domain: domain} : {}),
        ...getEnvOptions(),
    };
}

/**
 * @internal
 */
export function getUserTokenCookieOptions(): CookieOptions {
    const duration = normalizeValue(process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION, `${7 * 24 * 60 * 60}`);
    const parsedDuration = Number.parseInt(duration, 10);

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        throw new Error(
            `Croct's cookie duration must be a positive integer, got '${duration}'. `
            + 'Please check the `NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DURATION` environment variable.',
        );
    }

    const domain = normalizeValue(process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_DOMAIN, '');

    return {
        name: normalizeValue(process.env.NEXT_PUBLIC_CROCT_USER_TOKEN_COOKIE_NAME, 'ct.user_token'),
        maxAge: parsedDuration,
        path: '/',
        ...(domain !== '' ? {domain: domain} : {}),
        ...getEnvOptions(),
    };
}

/**
 * @internal
 */
export function getPreviewCookieOptions(): CookieOptions {
    const domain = normalizeValue(process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_DOMAIN, '');

    return {
        name: normalizeValue(process.env.NEXT_PUBLIC_CROCT_PREVIEW_TOKEN_COOKIE_NAME, 'ct.preview_token'),
        path: '/',
        ...(domain !== '' ? {domain: domain} : {}),
        ...getEnvOptions(),
    };
}

function getEnvOptions(): Partial<CookieOptions> {
    if (process.env.NODE_ENV !== 'production') {
        return {};
    }

    return {
        secure: true,
        sameSite: 'none',
    };
}

function normalizeValue(value: string|undefined, defaultValue: string): string {
    if (value === undefined || value === '') {
        return defaultValue;
    }

    return value;
}
