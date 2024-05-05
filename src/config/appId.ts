const PATTERN = /^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/;

export function getAppId(): string {
    const appId = process.env.NEXT_PUBLIC_CROCT_APP_ID ?? '';

    if (appId === '') {
        throw new Error(
            'Croct\'s application ID is missing. '
            + 'Did you forget to set the NEXT_PUBLIC_CROCT_APP_ID environment variable?',
        );
    }

    if (!PATTERN.test(appId)) {
        throw new Error(
            'Croct\'s application ID is invalid. '
            + 'Please check the NEXT_PUBLIC_CROCT_APP_ID environment variable.',
        );
    }

    return appId;
}
