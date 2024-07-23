import resolve from '@rollup/plugin-node-resolve'; // 用于解析node_modules中的模块
import commonjs from '@rollup/plugin-commonjs'; // 用于将CommonJS模块转换为ES6模块
import { terser } from "rollup-plugin-terser"; // 用于压缩代码
import json from '@rollup/plugin-json'; // 允许rollup处理json文件
import { babel } from '@rollup/plugin-babel'; // 用于将ES6+的代码转换为ES5
import autoExternal from 'rollup-plugin-auto-external'; // 用于自动将dependencies和peerDependencies标记为外部模块
import bundleSize from 'rollup-plugin-bundle-size'; // 显示打包后的文件大小
import aliasPlugin from '@rollup/plugin-alias'; // 创建路径别名
import path from 'path';


const lib = require("./package.json");

// 定义打包后的文件名、库的名称以及不同的入口文件
const outputFileName = 'axios';
const name = "axios";
const namedInput = './index.js'; // 命名导出的入口文件
const defaultInput = './lib/axios.js'; // 默认导出的入口文件

/**
 *  构建配置函数
 */
const buildConfig = ({ es5, browser = true, minifiedVersion = true, alias, ...config }) => {
  const { file } = config.output;
  const ext = path.extname(file); // 提取文件的扩展名（含点）
  const basename = path.basename(file, ext); // 提取文件名
  // 提取文件的扩展名（不包含点）
  const extArr = ext.split('.');
  extArr.shift();


  const build = ({ minified }) => ({
    input: namedInput, // 入口文件
    ...config, // 基本配置项
    output: {
      ...config.output, // 传入的output
      // 重新定义文件名，根据是否需要压缩来决定最终的文件名
      file: `${path.dirname(file)}/${basename}.${(minified ? ['min', ...extArr] : extArr).join('.')}`
    },
    plugins: [
      aliasPlugin({ // 创建路径别名
        entries: alias || []
      }),
      json(), // 允许rollup处理json文件
      resolve({ browser }), // 使用package.json中的browser字段解析
      commonjs(),

      minified && terser(), // 压缩代码
      minified && bundleSize(), // 显示打包后的文件大小
      ...(es5 ? [babel({ // ES5转换
        babelHelpers: 'bundled',
        presets: ['@babel/preset-env']
      })] : []),
      ...(config.plugins || []), // 传入的插件列表
    ]
  });

  // 生成配置
  const configs = [
    build({ minified: false }),
  ];

  // 添加压缩版本
  if (minifiedVersion) {
    configs.push(build({ minified: true }))
  }

  // 返回最后的配置
  return configs;
};

// 导出主配置
export default async () => {
  // 版权信息
  const year = new Date().getFullYear();
  const banner = `// Axios v${lib.version} Copyright (c) ${year} ${lib.author} and contributors`;

  return [
    // browser ESM bundle for CDN
    // 浏览器ESM bundle
    ...buildConfig({
      input: namedInput,
      output: {
        file: `dist/esm/${outputFileName}.js`,
        format: "esm",
        preferConst: true,
        exports: "named",
        banner
      }
    }),
    // browser ESM bundle for CDN with fetch adapter only
    // Downsizing from 12.97 kB (gzip) to 12.23 kB (gzip)
    /*    ...buildConfig({
          input: namedInput,
          output: {
            file: `dist/esm/${outputFileName}-fetch.js`,
            format: "esm",
            preferConst: true,
            exports: "named",
            banner
          },
          alias: [
            { find: './xhr.js', replacement: '../helpers/null.js' }
          ]
        }),*/

    // Browser UMD bundle for CDN
    // 浏览器UMD模块
    ...buildConfig({
      input: defaultInput,
      es5: true,
      output: {
        file: `dist/${outputFileName}.js`,
        name,
        format: "umd",
        exports: "default",
        banner
      }
    }),

    // Browser CJS bundle
    // 浏览器CJS模块
    ...buildConfig({
      input: defaultInput,
      es5: false,
      minifiedVersion: false,
      output: {
        file: `dist/browser/${name}.cjs`,
        name,
        format: "cjs",
        exports: "default",
        banner
      }
    }),

    // Node.js commonjs bundle
    {
      input: defaultInput,
      output: {
        file: `dist/node/${name}.cjs`,
        format: "cjs",
        preferConst: true,
        exports: "default",
        banner
      },
      plugins: [
        autoExternal(),
        resolve(),
        commonjs()
      ]
    }
  ]
};
