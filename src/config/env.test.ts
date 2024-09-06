import {getEnvEntry, getEnvEntryFlag, getEnvFlag, getEnvValue} from '@/config/env';

describe('getEnvEntry', () => {
    it('should return undefined if the value is undefined', () => {
        expect(getEnvEntry('key', undefined)).toBeUndefined();
    });

    it('should return undefined if the value is an empty string', () => {
        expect(getEnvEntry('key', '')).toBeUndefined();
    });

    it('should return the normalized value', () => {
        expect(getEnvEntry('key', 'value', value => value.toUpperCase())).toEqual({key: 'VALUE'});
    });
});

describe('getEnvEntryFlag', () => {
    it('should return undefined if the value is undefined', () => {
        expect(getEnvEntryFlag('key', undefined)).toBeUndefined();
    });

    it('should return undefined if the value is an empty string', () => {
        expect(getEnvEntryFlag('key', '')).toBeUndefined();
    });

    it('should return false if the value is not "true"', () => {
        expect(getEnvEntryFlag('key', 'TRUE')).toEqual({key: false});
        expect(getEnvEntryFlag('key', 'false')).toEqual({key: false});
    });

    it('should return the normalized value', () => {
        expect(getEnvEntryFlag('key', 'true')).toEqual({key: true});
    });
});

describe('getEnvValue', () => {
    it('should return undefined if the value is undefined', () => {
        expect(getEnvValue(undefined)).toBeUndefined();
    });

    it('should return undefined if the value is an empty string', () => {
        expect(getEnvValue('')).toBeUndefined();
    });

    it('should return the value', () => {
        expect(getEnvValue('value')).toBe('value');
    });

    it('should return the normalized value', () => {
        expect(getEnvValue('value', (value = '') => value.toUpperCase())).toBe('VALUE');
    });
});

describe('getEnvFlag', () => {
    it('should return false if the value is not "true"', () => {
        expect(getEnvFlag('TRUE')).toBe(false);
        expect(getEnvFlag('false')).toBe(false);
        expect(getEnvFlag(undefined)).toBe(false);
    });

    it('should return true if the value is "true"', () => {
        expect(getEnvFlag('true')).toBe(true);
    });
});
