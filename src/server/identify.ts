import {issueToken} from '@/config/security';
import {getUserTokenCookieOptions} from '@/config/cookie';
import {getCookies, RouteContext, CookieAccessor} from '@/headers';

export async function identify(userId: string, route?: RouteContext): Promise<void> {
    let cookies: CookieAccessor;

    try {
        cookies = await getCookies(route);
    } catch {
        throw new Error(
            'identify() requires specifying the `route` parameter outside app routes. '
            + 'For help, see: https://croct.help/sdk/nextjs/missing-route-context',
        );
    }

    const token = await issueToken(userId);
    const cookieOptions = getUserTokenCookieOptions();

    cookies.set(cookieOptions.name, token.toString(), {
        maxAge: cookieOptions.maxAge,
        path: cookieOptions.path,
        domain: cookieOptions.domain,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
    });
}
