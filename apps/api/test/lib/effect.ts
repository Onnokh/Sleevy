import { test, type TestOptions } from "bun:test"
import { Cause, Effect, Exit, Layer } from "effect"
import * as TestClock from "effect/testing/TestClock"
import * as TestConsole from "effect/testing/TestConsole"

type Body = Effect.Effect<any, any, any> | (() => Effect.Effect<any, any, any>)

const body = (value: Body) =>
  Effect.suspend(() => (typeof value === "function" ? value() : value))

const run = (value: Body, layer: Layer.Layer<any, any, any>) =>
  Effect.gen(function* () {
    const exit = yield* body(value).pipe(
      Effect.scoped,
      Effect.provide(layer),
      Effect.exit,
    )

    if (Exit.isFailure(exit)) {
      for (const error of Cause.prettyErrors(exit.cause)) {
        yield* Effect.logError(error)
      }
    }

    return yield* exit
  }).pipe((effect) => Effect.runPromise(effect as Effect.Effect<unknown, unknown, never>))

const make = (
  testLayer: Layer.Layer<any, any, any>,
  liveLayer: Layer.Layer<any, any, any>,
) => {
  const effect = (name: string, value: Body, opts?: number | TestOptions) =>
    test(name, () => run(value, testLayer), opts)
  effect.only = (name: string, value: Body, opts?: number | TestOptions) =>
    test.only(name, () => run(value, testLayer), opts)
  effect.skip = (name: string, value: Body, opts?: number | TestOptions) =>
    test.skip(name, () => run(value, testLayer), opts)

  const live = (name: string, value: Body, opts?: number | TestOptions) =>
    test(name, () => run(value, liveLayer), opts)
  live.only = (name: string, value: Body, opts?: number | TestOptions) =>
    test.only(name, () => run(value, liveLayer), opts)
  live.skip = (name: string, value: Body, opts?: number | TestOptions) =>
    test.skip(name, () => run(value, liveLayer), opts)

  return { effect, live }
}

const testEnv = Layer.mergeAll(TestConsole.layer, TestClock.layer())
const liveEnv = TestConsole.layer

export const it = make(testEnv, liveEnv)

export const testEffect = (layer: Layer.Layer<any, any, any>) =>
  make(
    Layer.provideMerge(layer, testEnv),
    Layer.provideMerge(layer, liveEnv),
  )
