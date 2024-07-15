'use strict';

import { VERSION } from '../env/data.js';
import AxiosError from '../core/AxiosError.js';

const validators = {};

// eslint-disable-next-line func-names
// 类型校验schema，当类型校验同构时返回true，否则返回期望的类型信息
['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach((type, i) => {
  validators[type] = function validator(thing) {
    return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
  };
});

const deprecatedWarnings = {};

/**
 * Transitional option validator
 * 过渡性配置的校验器
 *
 * @param {function|boolean?} validator - set to false if the transitional option has been removed
 * @param {string?} version - deprecated version / removed since version
 * @param {string?} message - some message with additional info
 * validator: 当给选项移除时，则会设置为false
 * version：选项废弃或移除的版本号
 * message：附加的错误信息
 *
 * @returns {function}
 */
validators.transitional = function transitional(validator, version, message) {
  // 拼接提示信息
  function formatMessage(opt, desc) {
    return '[Axios v' + VERSION + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
  }

  // eslint-disable-next-line func-names
  return (value, opt, opts) => {
    if (validator === false) {// 已移除
      throw new AxiosError(
        formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')),
        AxiosError.ERR_DEPRECATED
      );
    }

    // 废弃信息只会提示一次
    if (version && !deprecatedWarnings[opt]) { // 已废弃
      deprecatedWarnings[opt] = true;
      // eslint-disable-next-line no-console
      console.warn(
        formatMessage(
          opt,
          ' has been deprecated since v' + version + ' and will be removed in the near future'
        )
      );
    }

    // 校验，默认为true
    return validator ? validator(value, opt, opts) : true;
  };
};

/**
 * Assert object's properties type
 * 对象属性的类型断言
 *
 * @param {object} options 需要校验的对象
 * @param {object} schema 用于校验的schema，其属性名与options对应
 * @param {boolean?} allowUnknown 是否允许未声明schema的属性值
 *
 * @returns {object}
 */

function assertOptions(options, schema, allowUnknown) {
  if (typeof options !== 'object') { // 校验的目标要求是个对象
    throw new AxiosError('options must be an object', AxiosError.ERR_BAD_OPTION_VALUE);
  }
  const keys = Object.keys(options); // 获取对象的属性集合
  let i = keys.length;
  while (i-- > 0) {
    const opt = keys[i];
    const validator = schema[opt]; // 获取schema
    if (validator) { // schema已经定义则执行校验
      const value = options[opt];
      // 值为undefined或者校验通过则是true，否则是期望的类型信息
      const result = value === undefined || validator(value, opt, options);
      if (result !== true) { // 校验不通过则拼接对应期望的类型的错误信息并抛出
        throw new AxiosError('option ' + opt + ' must be ' + result, AxiosError.ERR_BAD_OPTION_VALUE);
      }
      continue;
    }
    //走到这里说明options里定义了为声明schema的属性
    // 如果不支持定义未知属性，则抛出错误
    if (allowUnknown !== true) {
      throw new AxiosError('Unknown option ' + opt, AxiosError.ERR_BAD_OPTION);
    }
  }
}

export default {
  assertOptions,
  validators
};
