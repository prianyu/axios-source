'use strict';

import utils from '../utils.js';
import AxiosError from '../core/AxiosError.js';
import transitionalDefaults from './transitional.js';
import toFormData from '../helpers/toFormData.js';
import toURLEncodedForm from '../helpers/toURLEncodedForm.js';
import platform from '../platform/index.js';
import formDataToJSON from '../helpers/formDataToJSON.js';

/**
 * It takes a string, tries to parse it, and if it fails, it returns the stringified version
 * of the input
 * 安全的将一个值转为字符串，如果输入值已经是一个有效的JSON字符串，则返回
 * 否则进行JSON编码
 * 这种方式可以避免处理已经是字符串的JSON数据时重复编码的问题
 *
 * @param {any} rawValue - The value to be stringified.
 * @param {Function} parser - A function that parses a string into a JavaScript object.
 * @param {Function} encoder - A function that takes a value and returns a string.
 *
 * @returns {string} A stringified version of the rawValue.
 */
function stringifySafely(rawValue, parser, encoder) {
  if (utils.isString(rawValue)) {
    try {// 尝试解析字符串
      (parser || JSON.parse)(rawValue);
      // 能解析则去除两端空白后返回
      return utils.trim(rawValue);
    } catch (e) {
      if (e.name !== 'SyntaxError') {// 不是语法错误则抛出错误
        throw e;
      }
    }
  }

  // 非字符串或无效的JSON则进行编码并返回
  return (encoder || JSON.stringify)(rawValue);
}

// 默认配置
const defaults = {

  transitional: transitionalDefaults, // 过渡配置

  adapter: ['xhr', 'http', 'fetch'], // 适配器类型

  // 请求数据转换器
  transformRequest: [function transformRequest(data, headers) {
    const contentType = headers.getContentType() || ''; // 获取content-type请求头
    const hasJSONContentType = contentType.indexOf('application/json') > -1; // 是否为json
    const isObjectPayload = utils.isObject(data); // data是否为普通对象

    // data为form表单
    if (isObjectPayload && utils.isHTMLForm(data)) {
      data = new FormData(data); // 转为FormData
    }

    const isFormData = utils.isFormData(data);

    // 是FormData
    if (isFormData) {
      // 如果content-type为json，则转为json字符串
      return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
    }

    // 以下类型则不处理
    if (utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data) ||
      utils.isReadableStream(data)
    ) {
      return data;
    }
    // ArrayBufferView类型返回buffer
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    // URLSearchParams类型
    if (utils.isURLSearchParams(data)) {
      // 设置content-type为application/x-www-form-urlencoded
      headers.setContentType('application/x-www-form-urlencoded;charset=utf-8', false);
      return data.toString();
    }

    let isFileList;

    if (isObjectPayload) {
      if (contentType.indexOf('application/x-www-form-urlencoded') > -1) {
        return toURLEncodedForm(data, this.formSerializer).toString(); //参数序列化
      }

      // fileList序列化
      if ((isFileList = utils.isFileList(data)) || contentType.indexOf('multipart/form-data') > -1) {
        const _FormData = this.env && this.env.FormData;

        return toFormData(
          isFileList ? { 'files[]': data } : data,
          _FormData && new _FormData(),
          this.formSerializer
        );
      }
    }

    // 对象且content-type为json，则转为json字符串
    if (isObjectPayload || hasJSONContentType) {
      headers.setContentType('application/json', false);
      return stringifySafely(data);
    }

    // 其它情况返回原始数据
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    const transitional = this.transitional || defaults.transitional; // 过渡配置
    const forcedJSONParsing = transitional && transitional.forcedJSONParsing; // 是否强制解析为json
    const JSONRequested = this.responseType === 'json'; // 返回类型是否为json

    // Response和ReadableStream类型直接返回（Fetch API）
    if (utils.isResponse(data) || utils.isReadableStream(data)) {
      return data;
    }

    // 字符串则尝试解析为json
    if (data && utils.isString(data) && ((forcedJSONParsing && !this.responseType) || JSONRequested)) {
      const silentJSONParsing = transitional && transitional.silentJSONParsing; // 静默解析json
      const strictJSONParsing = !silentJSONParsing && JSONRequested; // 严格解析模式

      try {
        // 尝试解析
        return JSON.parse(data);
      } catch (e) {
        if (strictJSONParsing) {
          if (e.name === 'SyntaxError') { // 要求返回json但是解析失败
            throw AxiosError.from(e, AxiosError.ERR_BAD_RESPONSE, this, null, this.response);
          }
          throw e;
        }
      }
    }

    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0, // 超时设置，默认不超时

  xsrfCookieName: 'XSRF-TOKEN', // xsrf cookie名
  xsrfHeaderName: 'X-XSRF-TOKEN', // xsrf header名

  maxContentLength: -1, // node中允许的HTTP响应内容的最大字节数
  maxBodyLength: -1, // node中允许的HTTP请求内容的最大字节数

  // 环境配置
  env: {
    FormData: platform.classes.FormData,
    Blob: platform.classes.Blob
  },

  // 状态码校验，当大于=200且小于300时，认为请求成功，触发promise的resolve函数
  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  },

  // 通用的默认请求头
  headers: {
    common: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': undefined
    }
  }
};

// 各种请求方法的默认请求头
utils.forEach(['delete', 'get', 'head', 'post', 'put', 'patch'], (method) => {
  defaults.headers[method] = {};
});

export default defaults;
