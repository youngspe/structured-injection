import { InjectError, ProvideGraph } from './Container'
import { Dependency } from './Dependency'
import { DependencyKey, DepsOf, ProvidedActual, IsSyncDepsOf } from './DependencyKey'
import { AbstractKey } from './AbstractKey'
import { Initializer } from './_internal'


const _baseKeySymbol = Symbol()

export interface HasBaseKeySymbol<out T, D = any, Sync = any> {
    readonly [_baseKeySymbol]: readonly [T, D, Sync] | null
}

/** A key that, upon request,transforms a provider for `K` into a provider of `T`. */
export abstract class BaseKey<
    out T = any,
    out K extends DependencyKey = any,
    D extends Dependency = DepsOf<K>,
    P extends ProvideGraph = never,
    Sync extends Dependency = IsSyncDepsOf<K>,
> extends AbstractKey<T> implements HasBaseKeySymbol<T, D, Sync> {
    readonly [_baseKeySymbol]: readonly [T, D, Sync] | null = null
    /** This key determines the dependencies that will be passed to `this.init()`. */
    readonly inner: K

    constructor(inner: K) {
        super()
        this.inner = inner
    }

    /** Given a provide of `D` or an error, return a provider of `T` or an error. */
    abstract init(deps: Initializer<ProvidedActual<K, P>> | InjectError): Initializer<T> | InjectError
}

export namespace BaseKey {
    export interface Any<out T = any> extends BaseKey<T, any, any, any> { }
}
