'use strict';

import transformData from './transformData.js';
import isCancel from '../cancel/isCancel.js';
import defaults from '../defaults/index.js';
import CanceledError from '../cancel/CanceledError.js';
import AxiosHeaders from '../core/AxiosHeaders.js';
import adapters from "../adapters/adapters.js";

/**
 * Throws a `CanceledError` if cancellation has been requested.
 *
 * @param {Object} config The config that is to be used for the request
 *
 * @returns {void}
 * 根据请求的取消令牌或者信号判断是否已经撤销请求
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    // 配置了请求令牌，则检查是否已撤销
    // 如果已经撤销了请求，则会抛出CanceledError异常
    config.cancelToken.throwIfRequested();
  }
  // 如果配置了取消信号，且已经撤销了请求，则会抛出CanceledError异常
  if (config.signal && config.signal.aborted) {
    throw new CanceledError(null, config);
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 * 使用配置的适配器发送请求
 *
 * @param {object} config The config that is to be used for the request
 *
 * @returns {Promise} The Promise to be fulfilled
 */
export default function dispatchRequest(config) {
  throwIfCancellationRequested(config); // 撤销请求处理，已撤销会抛出错误

  config.headers = AxiosHeaders.from(config.headers);  // 实例化请求头为AxiosHeaders实例

  // Transform request data
  // 转换请求数据
  config.data = transformData.call(
    config,
    config.transformRequest
  );

  // 请求方法为post、put、patch时，设置请求头application/x-www-form-urlencoded为false
  if (['post', 'put', 'patch'].indexOf(config.method) !== -1) {
    config.headers.setContentType('application/x-www-form-urlencoded', false);
  }

  // 获取请求适配器
  const adapter = adapters.getAdapter(config.adapter || defaults.adapter);

  // 发起请求
  return adapter(config).then(function onAdapterResolution(response) { // 请求成功处理
    throwIfCancellationRequested(config); // 撤销请求处理，已撤销会抛出错误

    // Transform response data
    // 转换响应数据
    response.data = transformData.call(
      config,
      config.transformResponse,
      response
    );

    // 设置响应头为AxiosHeaders实例
    response.headers = AxiosHeaders.from(response.headers);

    return response;
  }, function onAdapterRejection(reason) { // 请求失败处理
    // 如果不是CancelError
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config); // 撤销请求处理，已撤销会抛出错误

      // Transform response data
      // 如果reason上有response属性，则转换响应数据
      // 即请求成功发出且服务器也响应了状态码的，但是状态码超出了定义的成功的范围
      // 如果没有response属性，则说明没有收到响应
      if (reason && reason.response) {
        reason.response.data = transformData.call(
          config,
          config.transformResponse,
          reason.response
        );
        reason.response.headers = AxiosHeaders.from(reason.response.headers);
      }
    }

    // 返回一个拒绝的Promise
    return Promise.reject(reason);
  });
}
