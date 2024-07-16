'use strict';

import utils from '../utils.js';
import AxiosError from '../core/AxiosError.js';
// temporary hotfix to avoid circular references until AxiosURLSearchParams is refactored
// 临时热修复，避免循环引用，直到 AxiosURLSearchParams 被重构
import PlatformFormData from '../platform/node/classes/FormData.js';

/**
 * Determines if the given thing is a array or js object.
 * 判断给定的东西是否是数组或普通对象
 *
 * @param {string} thing - The object or array to be visited.
 *
 * @returns {boolean}
 */
function isVisitable(thing) {
  return utils.isPlainObject(thing) || utils.isArray(thing);
}

/**
 * It removes the brackets from the end of a string
 * 移除字符串末尾的方括号
 *
 * @param {string} key - The key of the parameter.
 *
 * @returns {string} the key without the brackets.
 */
function removeBrackets(key) {
  return utils.endsWith(key, '[]') ? key.slice(0, -2) : key;
}

/**
 * It takes a path, a key, and a boolean, and returns a string
 * 根据路径、键和点标志生成键名字符串
 * @param {string} path - The path to the current key. 当前属性的路径数组
 * @param {string} key - The key of the current object being iterated over. 当前属性的键名
 * @param {string} dots - If true, the key will be rendered with dots instead of brackets. 为true时是点表示，否则是方括号表示法
 *
 * @returns {string} The path to the current key.
 */
function renderKey(path, key, dots) {
  if (!path) return key; // 没有路径直接返回key
  // 将path和key合并为一个新的数组后遍历路径
  return path.concat(key).map(function each(token, i) {
    // eslint-disable-next-line no-param-reassign
    token = removeBrackets(token); // 移除节点的方括号
    // 如果不是点表示法，且不是第一个元素，则返回[token]，否则直接返回token
    return !dots && i ? '[' + token + ']' : token;
  }).join(dots ? '.' : ''); // 拼接结果，点表示法用.连接
}

/**
 * If the array is an array and none of its elements are visitable, then it's a flat array.
 * 判断是否是一个扁平的数组
 * @param {Array<any>} arr - The array to check
 *
 * @returns {boolean}
 */
function isFlatArray(arr) {
  return utils.isArray(arr) && !arr.some(isVisitable);
}
// 收集谓词函数
// 从utils中筛选出'is+大写字母'开头的方法名，拷贝至predicates
const predicates = utils.toFlatObject(utils, {}, null, function filter(prop) {
  return /^is[A-Z]/.test(prop);
});

/**
 * Convert a data object to FormData
 *
 * @param {Object} obj
 * @param {?Object} [formData]
 * @param {?Object} [options]
 * @param {Function} [options.visitor] // 遍历器
 * @param {Boolean} [options.metaTokens = true] // 是否保留元数据的{}符号
 * @param {Boolean} [options.dots = false] // 是否使用点表示法表示嵌套结构
 * @param {?Boolean} [options.indexes = false] // 是否使用索引表示法表示嵌套结构
 *
 * @returns {Object}
 **/

/**
 * It converts an object into a FormData object
 * 将对象转换为 FormData
 *
 * @param {Object<any, any>} obj - The object to convert to form data. 要转换的对象
 * @param {string} formData - The FormData object to append to. 要附加到 FormData 的对象
 * @param {Object<string, any>} options 选项
 *
 * @returns
 */
function toFormData(obj, formData, options) {
  if (!utils.isObject(obj)) { // 不是对象抛出错误
    throw new TypeError('target must be an object');
  }

  // eslint-disable-next-line no-param-reassign
  // 创建formData，在node环境使用`form-data`库
  formData = formData || new (PlatformFormData || FormData)();

  // eslint-disable-next-line no-param-reassign
  // 合并选项
  options = utils.toFlatObject(options, {
    metaTokens: true, // 默认保留{}
    dots: false, // 默认使用方括号表示嵌套结构
    indexes: false // 默认不使用索引表示法表示嵌套结构
  }, false, function defined(option, source) {
    // eslint-disable-next-line no-eq-null,eqeqeq
    // 只合并非undefined的选项
    return !utils.isUndefined(source[option]);
  });

  const metaTokens = options.metaTokens;
  // eslint-disable-next-line no-use-before-define
  const visitor = options.visitor || defaultVisitor; // 遍历器
  const dots = options.dots; // 是否点表示法
  const indexes = options.indexes; // 是否索引表示法
  const _Blob = options.Blob || typeof Blob !== 'undefined' && Blob; // Blob对象
  const useBlob = _Blob && utils.isSpecCompliantForm(formData); // 是否支持Blob且formData是一个符合规范的formData类型

  if (!utils.isFunction(visitor)) {
    throw new TypeError('visitor must be a function');
  }

  // 转换值
  function convertValue(value) {
    if (value === null) return ''; // null转为空字符串

    if (utils.isDate(value)) { // 日期转为ISO字符串
      return value.toISOString();
    }

    // value是blob，但不支持blob
    if (!useBlob && utils.isBlob(value)) {
      throw new AxiosError('Blob is not supported. Use a Buffer instead.');
    }

    // ArrayBuffer或TypedArray
    // 支持Blob则转为Blob，否则转为Buffer
    if (utils.isArrayBuffer(value) || utils.isTypedArray(value)) {
      return useBlob && typeof Blob === 'function' ? new Blob([value]) : Buffer.from(value);
    }

    // 其它情况返回原始值
    return value;
  }

  /**
   * Default visitor.
   * 默认的遍历器
   * 递归遍历和处理对象中的每一个属性，并将其附加到FormData对象中
   * @param {*} value 当前处理的值
   * @param {String|Number} key 当前属性的键
   * @param {Array<String|Number>} path 属性的路径（用于生成嵌套结构中的键名）。
   * @this {FormData}
   *
   * @returns {boolean} return true to visit the each prop of the value recursively
   */
  function defaultVisitor(value, key, path) {
    let arr = value;
    // 如果value是一个对象且path为空
    if (value && !path && typeof value === 'object') {
      if (utils.endsWith(key, '{}')) {
        // 如果key以{}结尾，则将value转换为JSON字符串
        // 注：这种标记方式通常是一种约定或协议，它能增强数据的自解释性，如“config{}”,"config[]""
        // 如后端服务器可能根据{}或[]后缀来处理相应的数据类型
        // eslint-disable-next-line no-param-reassign
        // 是否保留{}符号
        key = metaTokens ? key : key.slice(0, -2);
        // eslint-disable-next-line no-param-reassign
        value = JSON.stringify(value); // value被转成了字符串
      } else if (
        (utils.isArray(value) && isFlatArray(value)) ||
        ((utils.isFileList(value) || utils.endsWith(key, '[]')) && (arr = utils.toArray(value))
        )) {
        // 1. 如果value是扁平数组
        // 2. value是fileList或者key是[]结尾，且转为数组成功
        // eslint-disable-next-line no-param-reassign
        key = removeBrackets(key); // 移除键名中的方括号

        // 遍历元素，如果非空则formData中添加元素
        arr.forEach(function each(el, index) {
          !(utils.isUndefined(el) || el === null) && formData.append(
            // eslint-disable-next-line no-nested-ternary
            // 根据indexes和dots配置生成键名，将值转换后添加至formData
            // 分别生key[0],key,key[]三种格式
            indexes === true ? renderKey([key], index, dots) : (indexes === null ? key : key + '[]'),
            convertValue(el)
          );
        });
        // 返回true，表示无需递归处理
        return false;
      }
    }

    // 走到这里说明value不是一个扁平的数组、可以转换为数组的fileList或者key为[]结尾的情况

    // 如果是数组或者对象，则返回true，表示需要递归处理
    if (isVisitable(value)) {
      return true;
    }

    // 其它的类型
    formData.append(renderKey(path, key, dots), convertValue(value));

    return false;
  }

  const stack = []; // 遍历栈，用于循环引用检测

  // 提供给遍历器的辅助函数
  const exposedHelpers = Object.assign(predicates, {
    defaultVisitor,
    convertValue,
    isVisitable
  });

  function build(value, path) {
    if (utils.isUndefined(value)) return; // 如果是undefined则不处理

    if (stack.indexOf(value) !== -1) { // 循环引用检测
      throw Error('Circular reference detected in ' + path.join('.'));
    }

    stack.push(value); // 将当前处理的元素加入检测栈

    // 遍历value
    utils.forEach(value, function each(el, key) {
      // 如果el非空则调用遍历器
      // this指向formData，
      // 遍历器接收4个参数：1. 当前值 2. 当前key，key是字符串会去除首尾空格 3. 当前的路径 4. 暴露出去的辅助函数
      const result = !(utils.isUndefined(el) || el === null) && visitor.call(
        formData, el, utils.isString(key) ? key.trim() : key, path, exposedHelpers
      );

      // 遍历器返回true，代表需要递归遍历
      // 拼接path后递归处理
      if (result === true) {
        build(el, path ? path.concat(key) : [key]);
      }
    });

    stack.pop(); // 当前处理结束出栈
  }

  // 如果obj不是对象则抛出错误
  if (!utils.isObject(obj)) {
    throw new TypeError('data must be an object');
  }

  // 生成FormData
  build(obj);

  // 返回formData
  return formData;
}

export default toFormData;
