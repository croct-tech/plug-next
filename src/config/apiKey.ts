export function getApiKey(): string {
    const apiKey = process.env.CROCT_API_KEY;

    if (apiKey === undefined) {
        throw new Error('The API key is not set. Did you forget export the CROCT_API_KEY environment variable?');
    }

    return apiKey;
}
