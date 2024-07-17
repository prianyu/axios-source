'use strict';

import AxiosError from '../core/AxiosError.js';
import utils from '../utils.js';

/**
 * A `CanceledError` is an object that is thrown when an operation is canceled.
 * 用于表示请求被取消的错误
 * @param {string=} message The message. 错误信息，默认`canceled`
 * @param {Object=} config The config. 与错误相关的请求配置
 * @param {Object=} request The request. 与错误相关的请求对象
 *
 * @returns {CanceledError} The created error.
 */
function CanceledError(message, config, request) {
  // eslint-disable-next-line no-eq-null,eqeqeq
  AxiosError.call(this, message == null ? 'canceled' : message, AxiosError.ERR_CANCELED, config, request);
  // 设置错误的名称
  this.name = 'CanceledError';
}

// CanceledError继承AxiosError，并设置其原型属性__CANCEL__为true
utils.inherits(CanceledError, AxiosError, {
  __CANCEL__: true
});

export default CanceledError;
