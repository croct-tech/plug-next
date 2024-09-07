import process from 'node:process';
import {getDefaultFetchTimeout} from '@/config/timeout';

describe('getDefaultFetchTimeout', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT;

        Object.assign(process.env, {NODE_ENV: 'test'});
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should return undefined when the environment variable is missing and environment is not production', () => {
        expect(getDefaultFetchTimeout()).toBeUndefined();
    });

    it('should return the default value when the environment variable is missing and environment is production', () => {
        Object.assign(process.env, {NODE_ENV: 'production'});

        expect(getDefaultFetchTimeout()).toBe(2000);
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
            + 'Please check the environment variable `NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT`.',
        );
    });

    it('should fail if the timeout is not a positive integer', () => {
        process.env.NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT = '-1';

        expect(() => getDefaultFetchTimeout()).toThrow(
            "Croct's default fetch timeout must be a non-negative integer, got '-1'. "
                + 'Please check the environment variable `NEXT_PUBLIC_CROCT_DEFAULT_FETCH_TIMEOUT`.',
        );
    });
});
