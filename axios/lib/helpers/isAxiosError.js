'use strict';

import utils from './../utils.js';

/**
 * 用于判断payload是否为一个Axios错误
 * 如果是一个含有isAxiosError:true属性的对象，则返回true
 * Determines whether the payload is an error thrown by Axios
 *
 * @param {*} payload The value to test
 *
 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
 */
export default function isAxiosError(payload) {
  return utils.isObject(payload) && (payload.isAxiosError === true);
}
