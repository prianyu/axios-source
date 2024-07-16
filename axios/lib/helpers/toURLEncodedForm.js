'use strict';

import utils from '../utils.js';
import toFormData from './toFormData.js';
import platform from '../platform/index.js';

//将data转为URL编码的表单格式
export default function toURLEncodedForm(data, options) {
  return toFormData(data, new platform.classes.URLSearchParams(), Object.assign({
    visitor: function (value, key, path, helpers) {
      // node环境下将buffer类型转换为base64编码
      if (platform.isNode && utils.isBuffer(value)) {
        this.append(key, value.toString('base64'));
        return false;
      }

      // 否则执行默认的遍历器
      return helpers.defaultVisitor.apply(this, arguments);
    }
  }, options));
}
