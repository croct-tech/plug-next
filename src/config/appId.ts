const PATTERN = /^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/;

/**
 * @internal
 */
export function getAppId(): string {
    const appId = process.env.NEXT_PUBLIC_CROCT_APP_ID ?? '';

    if (appId === '') {
        throw new Error(
            'Croct\'s Application ID is missing. '
            + 'Did you forget to set the `NEXT_PUBLIC_CROCT_APP_ID` environment variable? '
            + 'For help, see: https://croct.help/sdk/nextjs/missing-environment-variable',
        );
    }

    if (!PATTERN.test(appId)) {
        throw new Error(
            'Croct\'s Application ID is invalid. '
            + 'Please check the `NEXT_PUBLIC_CROCT_APP_ID` environment variable.',
        );
    }

    return appId;
}
