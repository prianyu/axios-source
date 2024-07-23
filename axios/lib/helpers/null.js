// eslint-disable-next-line strict
// 该文件与package.json中的browser字段相关
// 在rollup打包时，通过@rollup/plugin-node-resolve中的browser字段
// 将模块的解析将重定向到当前模块
// 这样就可以避免在浏览器中加载特定于nodejs的代码
/**
  "browser": {
    "./lib/adapters/http.js": "./lib/helpers/null.js",
    "./lib/platform/node/index.js": "./lib/platform/browser/index.js",
    "./lib/platform/node/classes/FormData.js": "./lib/helpers/null.js"
  },
 */
export default null;
