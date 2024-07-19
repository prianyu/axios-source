'use strict';

import AxiosError from './AxiosError.js';

/**
 * Resolve or reject a Promise based on response status.
 * 根据响应状态解析或者拒绝Promise
 * @param {Function} resolve A function that resolves the promise. Promise的resolve函数
 * @param {Function} reject A function that rejects the promise. Promise的reject函数
 * @param {object} response The response. 响应对象
 *
 * @returns {object} The response.
 */
export default function settle(resolve, reject, response) {
  const validateStatus = response.config.validateStatus; // status校验器
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    // 没有响应状态、没有定义status校验器、校验通过都解决Promise
    resolve(response);
  } else {
    //  创建Axios错误拒绝Promise
    reject(new AxiosError(
      'Request failed with status code ' + response.status, // 错误信息
      // 4xx返回ERR_BAD_REQUEST， 5xx返回ERR_BAD_RESPONSE，其它返回undefined
      [AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4],
      response.config,
      response.request,
      response
    ));
  }
}
