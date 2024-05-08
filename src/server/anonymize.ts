import {cookies} from 'next/headers';
import {getUserTokenCookieOptions} from '@/config/cookie';
import {issueToken} from '@/config/security';

export async function anonymize(): Promise<void> {
    const token = await issueToken();
    const jar = cookies();
    const cookieOptions = getUserTokenCookieOptions();

    jar.set({
        name: cookieOptions.name,
        maxAge: cookieOptions.maxAge,
        path: cookieOptions.path,
        domain: cookieOptions.domain,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        value: token.toString(),
    });
}
