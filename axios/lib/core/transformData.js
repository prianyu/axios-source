'use strict';

import utils from './../utils.js';
import defaults from '../defaults/index.js';
import AxiosHeaders from '../core/AxiosHeaders.js';

/**
 * Transform the data for a request or a response
 * 转换响应和请求数据的函数
 * 接收函数或函数数组作为处理函数
 * @param {Array|Function} fns A single function or Array of functions
 * @param {?Object} response The response object
 *
 * @returns {*} The resulting transformed data
 */
export default function transformData(fns, response) {
  const config = this || defaults; //当前的config，可能由外部传入，也可能是默认
  const context = response || config; // 转换响应数据时，上下文为response对象，否则为config对象
  const headers = AxiosHeaders.from(context.headers); // 响应头
  let data = context.data; // 响应的数据或者请求的data配置

  // 遍历fns，传入参数执行转换函数
  // 这里fns为function时会被forEach转为[fns]
  utils.forEach(fns, function transform(fn) {
    //接收config，data，格式化后的headers，如果是转换响应数据还接收响应状态码
    data = fn.call(config, data, headers.normalize(), response ? response.status : undefined);
  });

  // 重新格式化headers
  headers.normalize();
  // 返回处理后的data
  return data;
}
