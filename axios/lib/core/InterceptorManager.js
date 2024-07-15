'use strict';

import utils from './../utils.js';

class InterceptorManager {
  constructor() {
    this.handlers = []; // 存储拦截器的数组
  }

  /**
   * Add a new interceptor to the stack
   * 添加一个拦截器，返回拦截器的id（在handles中的位置）
   * 返回的id可以通过eject(id)移除对应的拦截器
   *
   * @param {Function} fulfilled The function to handle `then` for a `Promise` promise的resolve回调
   * @param {Function} rejected The function to handle `reject` for a `Promise` promise的reject回调
   *
   * @return {Number} An ID used to remove interceptor later
   */
  use(fulfilled, rejected, options) {
    this.handlers.push({
      fulfilled,
      rejected,
      synchronous: options ? options.synchronous : false, // 是否是同步的，默认是false
      runWhen: options ? options.runWhen : null // 运行条件，默认为null，用于请求时过滤掉需要跳过的拦截器
    });
    return this.handlers.length - 1;
  }

  /**
   * Remove an interceptor from the stack
   * 根据拦截器的位置，移除拦截器
   *
   * @param {Number} id The ID that was returned by `use`
   *
   * @returns {Boolean} `true` if the interceptor was removed, `false` otherwise
   */
  eject(id) {
    if (this.handlers[id]) {
      // 将对应位置的拦截器置为null
      // 这里不能使用delete ，因为delete会改变数组的长度，导致后面的拦截器位置发生变化
      this.handlers[id] = null;
    }
  }

  /**
   * Clear all interceptors from the stack
   * 清除所有的拦截器
   *
   * @returns {void}
   */
  clear() {
    if (this.handlers) {
      this.handlers = [];
    }
  }

  /**
   * Iterate over all the registered interceptors
   * 遍历所有已经注册的拦截器，并执行回调
   * 只有当拦截器不为null时，才会执行回调
   * This method is particularly useful for skipping over any
   * interceptors that may have become `null` calling `eject`.
   *
   * @param {Function} fn The function to call for each interceptor
   *
   * @returns {void}
   */
  forEach(fn) {
    utils.forEach(this.handlers, function forEachHandler(h) {
      if (h !== null) {
        fn(h);
      }
    });
  }
}

export default InterceptorManager;
