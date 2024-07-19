import platform from './node/index.js';
import * as utils from './common/utils.js';
// 导出环境变量等信息
export default {
  ...utils,
  ...platform
}
