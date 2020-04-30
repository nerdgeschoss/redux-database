import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import cleaner from 'rollup-plugin-cleaner';
import pkg from './package.json';

const extensions = ['.ts'];

export default {
  input: './src/index.ts',
  external: [],
  plugins: [
    cleaner({
      targets: ['./dist/'],
    }),
    resolve({ extensions }),
    commonjs(),
    babel({ extensions, include: ['src/**/*'] }),
  ],

  output: [
    {
      file: pkg.main,
      format: 'cjs',
    },
    {
      file: pkg.module,
      format: 'es',
    },
  ],
};
