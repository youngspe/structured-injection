import { Scope } from './Scope'
import { NotDistinct, UnableToResolve, UnableToResolveIsSync } from './DependencyKey'
import { PrivateConstruct } from './_internal'
import { BaseTypeKey } from './TypeKey'
import { InjectableClass } from './InjectableClass'

const _isSyncSymbol = Symbol()

/** @ignore */
export abstract class IsSync<out K extends BaseTypeKey<any> | InjectableClass<any>> {
    private [_isSyncSymbol]!: K
    private constructor() { }
}
const _notSyncSymbol = Symbol()

/** @ignore */
export abstract class NotSync<out K extends BaseTypeKey<any> | InjectableClass<any>> {
    private [_notSyncSymbol]!: K
    private constructor() { }
}

/** @ignore */
export type RequireSync<D extends Dependency> = D extends BaseTypeKey | InjectableClass ? IsSync<D> : never

/**
 * A low-level dependency for a {@link DependencyKey}.
 * Generally, you won't need to interact with this type much.
 * It includes {@link Scope:type | Scope}, {@link TypeKey:type | TypeKey}, and {@link InjectableClass}.
 *
 * @group Dependencies
 */
export type Dependency =
    | Scope
    | BaseTypeKey
    | IsSync<any>
    | NotSync<any>
    | PrivateConstruct
    | UnableToResolve<any>
    | UnableToResolveIsSync<any>
    | NotDistinct<any>
