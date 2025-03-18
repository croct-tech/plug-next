type Normalizer<V, R> = (value: V) => R;

/**
 * @internal
 */
export function getEnvValue(value: string|undefined): string|undefined;

/**
 * @internal
 */
export function getEnvValue<V extends string|undefined, R>(value: V, normalize: Normalizer<V, R>): R;

/**
 * @internal
 */
export function getEnvValue<V extends string|undefined, R>(
    value: V,
    normalize?: Normalizer<V, R>,
): R|string|undefined {
    if (normalize === undefined && (value === undefined || value === '')) {
        return undefined;
    }

    return normalize !== undefined ? normalize(value) : value;
}

/**
 * @internal
 */
export function getEnvFlag(value: string|undefined): boolean {
    return getEnvValue(value, flag => flag === 'true');
}

/**
 * @internal
 */
export function getEnvEntry<K extends string, V extends string|undefined>(key: K, value: V): Record<K, V>|undefined;

/**
 * @internal
 */
export function getEnvEntry<K extends string, V extends string|undefined, R>(
  key: K,
  value: V,
  normalize: Normalizer<V, R>,
): Record<K, R>|undefined;

/**
 * @internal
 */
export function getEnvEntry<K extends string, V extends string|undefined, R>(
    key: K,
    value: V,
    normalize?: Normalizer<V, R>,
): Record<string, R|string>|undefined {
    if (value === undefined || value === '') {
        return undefined;
    }

    return {[key]: normalize !== undefined ? normalize(value) : value};
}

/**
 * @internal
 */
export function getEnvEntryFlag(key: string, value: string|undefined): Record<string, boolean>|undefined {
    return getEnvEntry(key, value, flag => flag === 'true');
}
