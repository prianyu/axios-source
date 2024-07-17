'use strict';

import utils from '../utils.js';

/**
 * Create an Error with the specified message, config, error code, request and response.
 * 用于创建AxiosError
 * @param {string} message The error message. 错误信息
 * @param {string} [code] The error code (for example, 'ECONNABORTED'). 错误代码
 * @param {Object} [config] The config. 请求配置
 * @param {Object} [request] The request. 请求对象
 * @param {Object} [response] The response. 响应对象
 *
 * @returns {Error} The created error.
 */
function AxiosError(message, code, config, request, response) {
  Error.call(this); // 继承Error对象的属性和方法

  // 捕获堆栈追踪
  if (Error.captureStackTrace) { // V8
    // captureStackTrace会将堆栈跟踪信息分配给this.stack
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = (new Error()).stack;
  }

  this.message = message; // 设置错误信息
  this.name = 'AxiosError'; // 设置错误名称
  code && (this.code = code); // 设置错误代码
  config && (this.config = config); // 设置请求配置
  request && (this.request = request); // 设置请求对象
  response && (this.response = response); // 设置响应对象
}

// 继承Error，并重写toJSON方法
utils.inherits(AxiosError, Error, {
  toJSON: function toJSON() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: utils.toJSONObject(this.config), // axios配置
      code: this.code, // axios错误码
      status: this.response && this.response.status ? this.response.status : null // 响应状态码
    };
  }
});

const prototype = AxiosError.prototype;
const descriptors = {};

[
  'ERR_BAD_OPTION_VALUE',
  'ERR_BAD_OPTION',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ERR_NETWORK',
  'ERR_FR_TOO_MANY_REDIRECTS',
  'ERR_DEPRECATED',
  'ERR_BAD_RESPONSE',
  'ERR_BAD_REQUEST',
  'ERR_CANCELED',
  'ERR_NOT_SUPPORT',
  'ERR_INVALID_URL'
  // eslint-disable-next-line func-names
].forEach(code => {
  descriptors[code] = { value: code };
});

Object.defineProperties(AxiosError, descriptors); // 添加静态属性
Object.defineProperty(prototype, 'isAxiosError', { value: true }); // 原型上增加AxiosError标记

// eslint-disable-next-line func-names
AxiosError.from = (error, code, config, request, response, customProps) => {
  const axiosError = Object.create(prototype);

  utils.toFlatObject(error, axiosError, function filter(obj) {
    return obj !== Error.prototype;
  }, prop => {
    return prop !== 'isAxiosError';
  });

  AxiosError.call(axiosError, error.message, code, config, request, response);

  axiosError.cause = error;

  axiosError.name = error.name;

  customProps && Object.assign(axiosError, customProps);

  return axiosError;
};

export default AxiosError;
