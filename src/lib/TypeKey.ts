import { Inject } from './Inject'
import { ComputedKey, HasComputedKeySymbol } from './ComputedKey'
import { AbstractKey } from './AbstractKey'
import { ScopeList } from './Scope'
import { DependencyKey, Target } from './DependencyKey'
import { AbstractClass, Class, asMixin } from './_internal'
import { Dependency } from './Dependency'
import { ClassWithoutDefault, ClassWithDefault } from './InjectableClass'

/** @internal */
export interface HasTypeKeySymbol<out T> {

    /** @internal */
    readonly [_typeKeySymbol]: readonly [T] | null
}

type ClassLike<T> = Class<T> | ((...args: any[]) => T)

// Use this to prevent library consumers from generating types equivalent to `TypeKey`.
const _typeKeySymbol: unique symbol = Symbol()

export interface BaseTypeKey<out T = any, Def extends HasComputedKeySymbol<T> = any> extends HasTypeKeySymbol<T> {
    /** @internal */
    readonly keyTag: symbol | typeof MISSING_KEY_TAG
    readonly scope?: ScopeList
    readonly name: string
    readonly fullName: string
    readonly of?: ClassLike<T>
    readonly inject: null
    readonly defaultInit?: Def
}

/**
 * @group Dependencies
 * @category TypeKey
 */
export interface TypeKey<out T = any, Def extends ComputedKey.Any<T> = any> extends BaseTypeKey<T, Def>, AbstractKey {
    readonly keyTag: symbol
}

/** @internal */
export interface BaseTypeKeyWithoutDefault extends BaseTypeKey<any, never> { }

/** @internal */
export interface BaseTypeKeyWithDefault<
    out T,
    D extends Dependency,
    Sync extends Dependency,
> extends BaseTypeKey<T, HasComputedKeySymbol<T, D, Sync>> { }

/** @internal */
export type KeyWithoutDefault = BaseTypeKeyWithoutDefault | ClassWithoutDefault
/** @internal */
export type KeyWithDefault<T, D extends Dependency, Sync extends Dependency> =
    | BaseTypeKeyWithDefault<T, D, Sync>
    | ClassWithDefault<T, D, Sync>

const MISSING_KEY_TAG = 'add `static readonly keyTag = Symbol()` to TypeKey implementation' as const

/** @internal */
export interface TypeKeyClass<out T, Def extends HasComputedKeySymbol<T>> extends
    AbstractKey,
    AbstractClass<any, [never]>,
    BaseTypeKey<T, Def> { }

export function TypeKey<T>(): TypeKeyClass<T, never>
export function TypeKey<T>(options: TypeKey.Options<T, never>): TypeKeyClass<T, never>

export function TypeKey<
    Def extends HasComputedKeySymbol<T>,
    T = Def extends HasComputedKeySymbol<infer _T> ? _T : never,
>(options: TypeKey.Options<T, Def>): TypeKeyClass<T, Def>

/**
 * @group Dependencies
 * @category TypeKey
 */
export function TypeKey<
    Def extends HasComputedKeySymbol<T>,
    T,
>({ default: defaultInit, of, name = of?.name }: TypeKey.Options<T, Def> = {} as any): TypeKeyClass<T, Def> {
    return asMixin(class _TypeKey {
        static readonly [_typeKeySymbol]: TypeKeyClass<T, Def>[typeof _typeKeySymbol] = null
        static readonly keyTag: symbol | typeof MISSING_KEY_TAG = MISSING_KEY_TAG
        static readonly of = of
        static readonly fullName = this.name + (name ? `(${name})` : '')
        static readonly defaultInit = defaultInit
        static readonly inject = null
        static toString() { return this.fullName }
    }, AbstractKey)
}

/**
 * @group Dependencies
 * @category TypeKey
 */
export namespace TypeKey {
    export interface Options<T, Def extends HasComputedKeySymbol<T>> {
        of?: ClassLike<T>
        name?: string
        default?: Def
    }

    export interface DefaultWithDeps<T, K extends DependencyKey> {
        deps: K
        init(deps: Target<K>): T
    }
    export interface DefaultWithInstance<T> { instance: T }
    export interface DefaultFunction<T> { (): T }

    export function isTypeKey(target: any): target is BaseTypeKey<any> {
        return _typeKeySymbol in target
    }
}

/** Convenience for a TypeKey that specifically resolves to a a function that, given `Args`, returns `T`. */

/**
 * @group Dependencies
 * @category TypeKey
 */
export interface FactoryKey<Args extends any[], T> extends TypeKey<(...args: Args) => T> { }

export function FactoryKey<T, Args extends any[] = []>(): TypeKeyClass<(...args: Args) => T, never>

export function FactoryKey<
    T,
    Args extends any[],
    K extends DependencyKey,
>(deps: K, fac: (deps: Target<K>, ...args: Args) => T): TypeKeyClass<(...args: Args) => T, ComputedKey<(...args: Args) => T, K>>

/**
 * @group Dependencies
 * @category TypeKey
 */
export function FactoryKey<
    T,
    Args extends any[],
    K extends DependencyKey,
>(
    ...args:
        | []
        | [deps: K, fac: (deps: Target<K>, ...args: Args) => T]
): TypeKeyClass<(...args: Args) => T, ComputedKey<(...args: Args) => T, K>> {
    if (args.length == 2) {
        let [deps, fac] = args
        return TypeKey<ComputedKey<(...args: Args) => T, K>>({ default: Inject.map(deps, d => (...args: Args) => fac(d, ...args)) })
    }
    return TypeKey()
}
