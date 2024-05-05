import {getDefaultFetchTimeout} from '@/config/timeout';

describe('getDefaultFetchTimeout', () => {
    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT;
    });

    it('should return undefined when the environment variable is missing', () => {
        delete process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT;

        expect(getDefaultFetchTimeout()).toBeUndefined();
    });

    it('should return undefined when the environment variable is empty', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = '';

        expect(getDefaultFetchTimeout()).toBeUndefined();
    });

    it('should return the parsed timeout value', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = '5000';

        expect(getDefaultFetchTimeout()).toBe(5000);
    });

    it('should fail if the timeout is not a valid integer', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = 'invalid';

        expect(() => getDefaultFetchTimeout()).toThrow(
            "Croct's default fetch timeout must be a non-negative integer, got 'invalid'. "
            + 'Please check the environment variable NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT.',
        );
    });

    it('should fail if the timeout is not a positive integer', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = '-1';

        expect(() => getDefaultFetchTimeout()).toThrow(
            "Croct's default fetch timeout must be a non-negative integer, got '-1'. "
                + 'Please check the environment variable NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT.',
        );
    });
});
