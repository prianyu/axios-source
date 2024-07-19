'use strict';

import toFormData from './toFormData.js';

/**
 * It encodes a string by replacing all characters that are not in the unreserved set with
 * their percent-encoded equivalents
 * 编码函数，将特殊字符替换为对应编码
 *
 * @param {string} str - The string to encode.
 *
 * @returns {string} The encoded string.
 */
function encode(str) {
  const charMap = {
    '!': '%21',
    "'": '%27',
    '(': '%28',
    ')': '%29',
    '~': '%7E',
    '%20': '+',
    '%00': '\x00'
  };
  return encodeURIComponent(str).replace(/[!'()~]|%20|%00/g, function replacer(match) {
    return charMap[match];
  });
}

/**
 * It takes a params object and converts it to a FormData object
 * 使用toFormData函数将params对象转为FormData对象
 * @param {Object<string, any>} params - The parameters to be converted to a FormData object.
 * @param {Object<string, any>} options - The options object passed to the Axios constructor.
 *
 * @returns {void}
 */
function AxiosURLSearchParams(params, options) {
  this._pairs = []; // 用于存储参数对

  params && toFormData(params, this, options);
}

const prototype = AxiosURLSearchParams.prototype;

// 添加append方法，用于添加参数对
prototype.append = function append(name, value) {
  this._pairs.push([name, value]);
};

// toString方法 根据encode将参数对转换为字符串
prototype.toString = function toString(encoder) {
  // 传入了自定义编码函数，则将值和内置的编码函数传递给该自定义编码函数执行
  // 否则使用内置的编码函数编码
  const _encode = encoder ? function (value) {
    return encoder.call(this, value, encode);
  } : encode;

  // 遍历参数对，将参数和参数值编码后使用'='连接起来，所有结果用'&'连接起来
  return this._pairs.map(function each(pair) {
    return _encode(pair[0]) + '=' + _encode(pair[1]);
  }, '').join('&');
};

export default AxiosURLSearchParams;
