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
    const duration = resolveValue(process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION, '31536000');
    const parsedDuration = Number.parseInt(duration, 10);

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        throw new Error(
            'Environment variable NEXT_PUBLIC_CROCT_CID_COOKIE_DURATION must be '
            + `a positive integer, got ${duration}`,
        );
    }

    const domain = resolveValue(process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_DOMAIN, '');

    return {
        name: resolveValue(process.env.NEXT_PUBLIC_CROCT_CID_COOKIE_NAME, 'cid'),
        maxAge: parsedDuration,
        secure: true,
        path: '/',
        sameSite: 'strict',
        ...(domain !== '' ? {domain: domain} : {}),
    };
}

export function getPreviewCookieOptions(): CookieOptions {
    return {
        name: resolveValue(process.env.NEXT_PUBLIC_CROCT_PREVIEW_COOKIE_NAME, 'preview-token'),
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
    };
}

function resolveValue(value: string|undefined, defaultValue: string): string {
    if (value === undefined || value === '') {
        return defaultValue;
    }

    return value;
}
