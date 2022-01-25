import { Options } from 'tsup'

export const tsup: Options = {
  clean: true,
  dts: true,
  entry: {
    api: 'src/index.ts',
  },
  minify: true,
  keepNames: true,
  skipNodeModulesBundle: true,
  sourcemap: true,
  target: 'es2021',
}
