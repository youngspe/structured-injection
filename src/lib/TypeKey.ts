import { Container, InjectError, InjectableClass, Scope, Singleton } from "."
import { Class } from "./_internal"

type OnlyObject = { [k: keyof any]: unknown } | unknown[]

/** An object representing a structured set of type keys to produce type `T`. */
export type StructuredKey<out T> = { readonly [K in keyof T]: DependencyKey<T[K]> }
/** A dependency key that, when requested, resolves to a value of type `T`. */
export type DependencyKey<T> = TypeKey<T> | AbstractKey<T> | (OnlyObject & StructuredKey<T>) | InjectableClass<T>
/** The actual type that a dependency key of type `D` resolves to. */


type KeysWhere<D, E> = { [P in keyof D]: D[P] extends E ? { [_ in P]: D[P] } : never }[keyof D]

export type Actual<D, S extends Scope = Scope> =
    & (D extends DependencyKey<infer T> ? T : unknown)
    & (D extends OnlyObject ? { [K in keyof KeysWhere<D, OnlyObject>]: Actual<D> } : unknown)
    & (D extends SubcomponentKey<infer A, infer S2> ? Container.Subcomponent<A, S | S2> : unknown)

type A = Actual<SubcomponentKey<[1, 2], typeof Singleton>, Scope>

// Use this to prevent library consumers from generating types equivalent to `AbstractKey`.
const _abstractKeySymbol: unique symbol = Symbol()

/** Implementation detail--extend `BaseKey` instead. */
export abstract class AbstractKey<out T> {
    private readonly [_abstractKeySymbol]: T[] = []
    constructor(_sealed: typeof _abstractKeySymbol) { }


    private _Lazy?: GetLazy<T>
    /** Requests a function returning a lazily-computed value of `T`. */
    get Lazy(): GetLazy<T> { return this._Lazy ??= new GetLazy(this) }

    private _Provider?: GetProvider<T>
    /** Requests a function returning a value of `T`. */
    get Provider(): GetProvider<T> { return this._Provider ??= new GetProvider<T>(this) }

    private _Optional?: Optional<T>
    /** Requests a value of type `T` if provided, otherwise `undefined`. */
    get Optional() { return this._Optional ??= new Optional<T>(this) }

    Build(
        ...args: T extends (...args: infer A) => infer R ? A : never
    ): T extends (...args: infer A) => infer R ? Build<A, R> : never {
        return new Build(this as any) as any
    }
}

// Use this to prevent library consumers from generating types equivalent to `TypeKey`.
const _keySymbol: unique symbol = Symbol()


type ClassLike<T> = Class<T> | ((...args: any[]) => T)

/** A key used to provide and request instances of type `T`. */
export class TypeKey<out T = unknown, D = any> extends AbstractKey<T> {
    readonly name?: string
    readonly class?: ClassLike<T>
    readonly scope?: Scope
    readonly defaultInit?: TypeKey.Options<T, D>['default']

    private readonly [_keySymbol]: T[] = []

    constructor(
        { of, name = of?.name, scope, default: defaultInit }: TypeKey.Options<T, D> = {},
    ) {
        super(_abstractKeySymbol)
        this.class = of
        this.name = name
        this.scope = scope
        this.defaultInit = defaultInit
    }
}


export namespace TypeKey {
    export interface Options<T, D> {
        name?: string,
        of?: ClassLike<T>,
        scope?: Scope,
        default?: { deps: DependencyKey<D>, init: (deps: D) => T } | { instance: T } | (() => T)
    }
}

/** Convenience for a TypeKey that specifically resolves to a a function that, given `Args`, returns `T`. */
export class FactoryKey<Args extends any[], T, D = any> extends TypeKey<(...args: Args) => T, D> { }

export class SubcomponentKey<in Args extends any[], S extends Scope = never> extends TypeKey<Container.Subcomponent<Args>, Container> {
    constructor(options: Container.ChildOptions<S>, f: (ct: Container, ...args: Args) => void) {
        super({ default: { deps: Container, init: ct => ct.createSubcomponent(options, f) } })
    }
}

/** A key that, upon request, transforms a provider of `D` into a provider of `T`. */
export abstract class BaseKey<out T, D> extends AbstractKey<T> {
    /** This key determines the dependencies that will be passed to `this.init()`. */
    readonly inner: DependencyKey<D>

    constructor(inner: DependencyKey<D>) {
        super(_abstractKeySymbol)
        this.inner = inner
    }

    /** Given a provide of `D` or an error, return a provider of `T` or an error. */
    abstract init(deps: (() => D) | InjectError): (() => T) | InjectError
}

/** Requests a function returning a lazily-computed value of `T`. */
export class GetLazy<out T> extends BaseKey<() => T, T> {
    override init(deps: (() => T) | InjectError) {
        if (deps instanceof InjectError) return deps
        let d: (() => T) | null = deps
        let value: T | null = null

        const f = () => {
            if (d != null) {
                value = d()
                d = null
            }
            return value as T
        }

        return () => f
    }
}

/** Requests a function returning a value of `T`. */
export class GetProvider<out T> extends BaseKey<() => T, T> {
    override init(deps: (() => T) | InjectError) {
        if (deps instanceof InjectError) return deps
        return () => deps
    }
}

/** Requests a value of type `T` if provided, otherwise `undefined`. */
export class Optional<out T> extends BaseKey<T | undefined, T> {
    override init(deps: (() => T) | InjectError) {
        if (deps instanceof InjectError) return () => undefined
        return deps
    }
}

export class Build<Args extends any[], out T> extends BaseKey<T, (...args: Args) => T> {
    readonly args: Args
    override init(deps: (() => (...args: Args) => T)): (() => T) | InjectError {
        if (deps instanceof InjectError) return deps
        return () => deps()(...this.args)
    }

    constructor(inner: DependencyKey<(...args: Args) => T>, ...args: Args) {
        super(inner)
        this.args = args
    }
}
