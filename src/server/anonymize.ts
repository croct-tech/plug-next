import {getUserTokenCookieOptions} from '@/config/cookie';
import {issueToken} from '@/config/security';
import {CookieAccessor, getCookies, NextRequestContext} from '@/headers';

export async function anonymize(context?: NextRequestContext): Promise<void> {
    let cookies: CookieAccessor;

    try {
        cookies = getCookies(context);
    } catch {
        throw new Error(
            'The anonymize() function requires a server-side context outside app routes. '
            + 'For help, see: https://croct.help/sdk/nextjs/anonymize-missing-context',
        );
    }

    const token = await issueToken();
    const cookieOptions = getUserTokenCookieOptions();

    cookies.set(cookieOptions.name, token.toString(), {
        maxAge: cookieOptions.maxAge,
        path: cookieOptions.path,
        domain: cookieOptions.domain,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
    });
}
