import { Container, GetLazy, Scope, Singleton, TypeKey } from '../lib'

const NumberKey = new TypeKey<number>()
const StringKey = new TypeKey<string>()
const ArrayKey = new TypeKey<string[]>()
const BooleanKey = new TypeKey<boolean>()

describe(Container, () => {
    test('provide and request', () => {
        const target = new Container()

        const out = target.provide(NumberKey, {}, () => 10).request(NumberKey);

        expect(out).toEqual(10)
    })

    test('provideInstance and request', () => {
        const target = new Container()

        const out = target.provideInstance(NumberKey, 10).request(NumberKey)

        expect(out).toEqual(10)
    })

    test('request structured dependencies', () => {
        const target = new Container()

        const out = target
            .provideInstance(NumberKey, 10)
            .provide(StringKey, {}, () => 'foo')
            .provide(ArrayKey, {}, () => ['a', 'b'])
            .request({
                a: NumberKey,
                b: StringKey,
                c: { d: ArrayKey }
            })

        expect(out).toEqual({
            a: 10,
            b: 'foo',
            c: { d: ['a', 'b'] }
        })
    })

    test('inject structured dependencies', () => {
        const target = new Container()

        const out = target
            .provideInstance(NumberKey, 10)
            .provide(StringKey, {}, () => 'foo')
            .provide(ArrayKey, {
                a: NumberKey,
                b: { c: StringKey },
            }, ({ a, b: { c } }) => [a.toString(), c])
            .request(ArrayKey)

        expect(out).toEqual(['10', 'foo'])
    })

    test('request optional structured dependencies', () => {
        const target = new Container()

        const out = target
            .provideInstance(NumberKey, 10)
            .provide(StringKey, {}, () => 'foo')
            .provide(ArrayKey, {}, () => ['a', 'b'])
            .request({
                a: NumberKey,
                b: StringKey,
                c: { d: ArrayKey, e: BooleanKey.Optional }
            })

        expect(out).toEqual({
            a: 10,
            b: 'foo',
            c: { d: ['a', 'b'], e: undefined }
        })
    })

    test('inject lazy structured dependencies', () => {
        const target = new Container()

        const out = target
            .provideInstance(NumberKey, 10)
            .provide(StringKey, {}, () => 'foo')
            .provideInstance(BooleanKey, true)
            .provide(ArrayKey, {
                a: NumberKey.Lazy,
                b: new GetLazy({ c: StringKey }),
                c: BooleanKey,
            }, ({ a, b }) => [a().toString(), b().c])
            .request(ArrayKey)

        expect(out).toEqual(['10', 'foo'])
    })

    test('inject structured provider dependencies', () => {
        const target = new Container()
        let sideEffect = 0

        const out = target
            .provideInstance(NumberKey, 10)
            .provide(StringKey, {}, () => {
                sideEffect += 1
                return 'foo'
            })
            .provideInstance(BooleanKey, true)
            .provide(ArrayKey, {
                a: NumberKey,
                b: { c: StringKey.Provider },
                c: BooleanKey,
            }, ({ a, b: { c } }) => [a.toString(), c(), c()])
            .request(ArrayKey)

        expect(out).toEqual(['10', 'foo', 'foo'])
        expect(sideEffect).toEqual(2)
    })

    test('child container defers to parent to get missing dependencies', () => {
        const target = new Container()
            .provideInstance(NumberKey, 10)
            .provideInstance(BooleanKey, false)
            .provide(ArrayKey, {
                a: NumberKey,
                b: { c: StringKey },
                d: BooleanKey,
            }, ({ a, b: { c }, d }) => [a.toString(), c, d.toString()])

        const child = target.createChild({}, ct => ct
            .provide(StringKey, {}, () => 'foo')
            .provideInstance(BooleanKey, true)
        )

        const out = child.request(ArrayKey)
        expect(out).toEqual(['10', 'foo', 'true'])
    })

    test('singleton returns the same instance every time', () => {
        const target = new Container()
        const CustomKey = new TypeKey<{ num: number, str: string, bool: boolean }>()

        target
            .provideInstance(NumberKey, 10)
            .provide(StringKey, {}, () => 'foo')
            .provideInstance(BooleanKey, false)
            .provide(CustomKey, Singleton, {
                num: NumberKey,
                str: StringKey,
                bool: BooleanKey,
            }, (deps) => deps)
            .provide(ArrayKey, { num: NumberKey, str: StringKey }, ({ num, str }) => [num.toString(), str])

        const custom1 = target.request(CustomKey)
        const custom2 = target.request(CustomKey)

        // Test that custom1 and custom2 are the same instance:
        expect(custom1).toBe(custom2)

        const array1 = target.request(ArrayKey)
        const array2 = target.request(ArrayKey)

        // Test that array1 and array2 are NOT the same instance since they don't have the Singleton scope:
        expect(array1).not.toBe(array2)
    })

    test('dependencies are resolved from the appropriate scope', () => {
        const MyScope = new Scope()

        const parent = new Container()
            .provide(NumberKey, {}, () => 10)
            .provide(StringKey, {}, () => 'foo')
            .provide(ArrayKey, MyScope, { num: NumberKey, str: StringKey }, ({ num, str }) => [num.toString(), str])

        const child1 = parent.createChild({ scope: MyScope }, ct => ct.provide(NumberKey, {}, () => 20))
        const grandChild1a = child1.createChild({}, ct => ct.provide(StringKey, {}, () => 'bar'))
        const grandChild1b = child1.createChild({}, ct => ct.provide(NumberKey, {}, () => 30))

        const out1 = child1.request(ArrayKey)

        expect(out1).toEqual(['20', 'foo'])
        expect(grandChild1a.request(ArrayKey)).toBe(out1)
        expect(grandChild1b.request(ArrayKey)).toBe(out1)

        const child2 = parent.createChild({ scope: MyScope }, ct => ct.provide(NumberKey, {}, () => 40))
        const grandChild2a = child2.createChild({}, ct => ct.provide(StringKey, {}, () => 'baz'))
        const grandChild2b = child2.createChild({}, ct => ct.provide(NumberKey, {}, () => 50))

        const out2 = grandChild2a.request(ArrayKey)

        expect(out2).toEqual(['40', 'foo'])
        expect(child2.request(ArrayKey)).toBe(out2)
        expect(grandChild2b.request(ArrayKey)).toBe(out2)

        expect(parent.request(ArrayKey.Optional)).not.toBeDefined()
        expect(out2).not.toBe(out1)
    })

    test('TypeKey.default is function', () => {
        // Non-singleton
        const CustomKey1 = new TypeKey({ default: () => ({ a: 1 }) })
        // Singleton
        const CustomKey2 = new TypeKey({ scope: Singleton, default: () => ({ b: 2 }) })
        const target = new Container()

        const out1a = target.request(CustomKey1)
        const out1b = target.request(CustomKey1)

        const out2a = target.request(CustomKey2)
        const out2b = target.request(CustomKey2)

        expect(out1a).toEqual({ a: 1 })
        expect(out1b).toEqual({ a: 1 })
        // Test that a new instance is created since this isn't a singleton:
        expect(out1a).not.toBe(out1b)

        expect(out2a).toEqual({ b: 2 })
        expect(out2b).toEqual({ b: 2 })
        // Test that a new instance isn't created since this is a singleton:
        expect(out2a).toBe(out2b)
    })

    test('TypeKey.default is { deps, init } object', () => {
        // Non-singleton
        const CustomKey1 = new TypeKey({
            default: {
                deps: { num: NumberKey },
                init: ({ num }) => ({ a: num }),
            },
        })
        // Singleton
        const CustomKey2 = new TypeKey({
            scope: Singleton,
            default: {
                deps: { str: StringKey },
                init: ({ str }) => ({ b: str }),
            },
        })

        const target = new Container()
            .provideInstance(NumberKey, 1)
            .provideInstance(StringKey, 'foo')

        const out1a = target.request(CustomKey1)
        const out1b = target.request(CustomKey1)

        const out2a = target.request(CustomKey2)
        const out2b = target.request(CustomKey2)

        expect(out1a).toEqual({ a: 1 })
        expect(out1b).toEqual({ a: 1 })
        // Test that a new instance is created since this isn't a singleton:
        expect(out1a).not.toBe(out1b)

        expect(out2a).toEqual({ b: 'foo' })
        expect(out2b).toEqual({ b: 'foo' })
        // Test that a new instance isn't created since this is a singleton:
        expect(out2a).toBe(out2b)
    })

    test('TypeKey.default is instance', () => {
        const instance = { a: 1 }
        const CustomKey = new TypeKey({ default: { instance } })
        const target = new Container()

        const out = target.request(CustomKey)


        expect(out).toBe(instance)
    })

    test('TypeKey.scope is respected when no scope is provided', () => {
        const MyScope = new Scope()
        const CustomKey = new TypeKey<{ a: number }>({ scope: MyScope })

        const parent = new Container()
            .provideInstance(NumberKey, 10)
            .provide(CustomKey, { num: NumberKey }, ({ num }) => ({ a: num, }))

        const child1 = parent.createChild({ scope: MyScope }).provideInstance(NumberKey, 20)
        const grandChild1 = child1.createChild({ scope: MyScope }).provideInstance(NumberKey, 30)

        const out1 = child1.request(CustomKey)

        const child2 = parent.createChild({ scope: MyScope }).provideInstance(NumberKey, 40)
        const grandChild2 = child2.createChild({ scope: MyScope }).provideInstance(NumberKey, 50)

        const out2 = child2.request(CustomKey)

        expect(parent.request(CustomKey.Optional)).toBeUndefined()
        expect(out1).toEqual({ a: 20 })
        expect(grandChild1.request(CustomKey)).toBe(out1)

        expect(out2).toEqual({ a: 40 })
        expect(grandChild2.request(CustomKey)).toBe(out2)
    })

    test('Provided scope overrides TypeKey.Scope', () => {
        const MyScope = new Scope()
        const CustomKey = new TypeKey<{ a: number }>({ scope: Singleton })

        const parent = new Container()
            .provideInstance(NumberKey, 10)
            .provide(CustomKey, MyScope, { num: NumberKey }, ({ num }) => ({ a: num, }))

        const child1 = parent.createChild({ scope: MyScope }).provideInstance(NumberKey, 20)
        const grandChild1 = child1.createChild({ scope: MyScope }).provideInstance(NumberKey, 30)

        const out = child1.request(CustomKey)

        expect(parent.request(CustomKey.Optional)).toBeUndefined()
        expect(out).toEqual({ a: 20 })
        expect(grandChild1.request(CustomKey)).toBe(out)
    })
})
