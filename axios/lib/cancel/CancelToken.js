'use strict';

import CanceledError from './CanceledError.js';

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 * 定义一个`取消令牌`用于取消某个请求操作
 * @param {Function} executor The executor function. 执行器函数，用来定义如何请求取消操作
 *
 * @returns {CancelToken}
 */
class CancelToken {
  constructor(executor) {
    // 未定义执行器函数
    if (typeof executor !== 'function') {
      throw new TypeError('executor must be a function.');
    }

    let resolvePromise; // 用于存储Promise内部的resolve函数

    // 定义一个promise，用于通知取消操作
    this.promise = new Promise(function promiseExecutor(resolve) {
      resolvePromise = resolve;
    });

    const token = this;

    // eslint-disable-next-line func-names
    // 解决回调函数
    // 此时this.promise.then还未被重写，所以该处理回调会被放到原始的then回调中
    this.promise.then(cancel => {
      if (!token._listeners) return; // 监听器不存在

      let i = token._listeners.length;

      // 遍历监听器数组，调用每个监听器函数
      while (i-- > 0) {
        token._listeners[i](cancel);
      }
      // 清空监听器数组
      token._listeners = null;
    });

    // eslint-disable-next-line func-names
    // 重写then方法，返回一个含有cancel方法的新的promise
    // 目的是为了使其支持订阅和取消订阅的功能，从而可以更细粒度的控制取消操作
    // const p = this.promise.then(() => ()).cancel()
    this.promise.then = onfulfilled => {
      let _resolve; // 保存新的promise的resolve函数，用于取消订阅
      // eslint-disable-next-line func-names
      // 创建一个新的promise，当该对象被解决时调用onfulfilled回调
      const promise = new Promise(resolve => {
        // 当this.promise.then被调用时会注册一个监听器
        // 该监听器在this.promise被resolve时会被遍历调用
        token.subscribe(resolve);
        _resolve = resolve; // 保存resolve，取消订阅时引用
      }).then(onfulfilled); // 当新的Promise被解决时会执行onfulfilled回调

      // 添加cancel方法，用于取消订阅
      promise.cancel = function reject() {
        token.unsubscribe(_resolve);
      };

      return promise;
    };

    // 执行executor函数，接收一个取消函数
    executor(function cancel(message, config, request) {
      if (token.reason) { // 已经请求取消了，则直接放回
        // Cancellation has already been requested
        return;
      }

      // 创建CanceledError异常赋值给当前实例的reason属性
      token.reason = new CanceledError(message, config, request);
      // 解决promise
      resolvePromise(token.reason);
    });
  }

  /**
   * Throws a `CanceledError` if cancellation has been requested.
   * 如果已经请求取消了，则抛出CanceledError异常
   */
  throwIfRequested() {
    if (this.reason) {
      throw this.reason;
    }
  }

  /**
   * Subscribe to the cancel signal
   * 订阅取消操作，当取消发生时会执行这些回调
   */

  subscribe(listener) {
    // 有取消原因（已取消）则执行回调
    if (this.reason) {
      listener(this.reason);
      return;
    }

    // 没有取消原因（未取消）
    // 将回调存储到_listeners数组中
    if (this._listeners) {
      this._listeners.push(listener);
    } else {
      this._listeners = [listener];
    }
  }

  /**
   * Unsubscribe from the cancel signal
   * 取消订阅
   */

  unsubscribe(listener) {
    if (!this._listeners) { // 没有监听器，直接返回
      return;
    }
    // 找出对应的订阅回调并移除
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * Returns an object that contains a new `CancelToken` and a function that, when called,
   * cancels the `CancelToken`.
   * 用于定义并返回一个包含CancelToken实例和取消函数的对象
   * 使用该静态方法可以不需要手动实例化CancelToken实例并传入executor函数
   */
  static source() {
    let cancel;
    const token = new CancelToken(function executor(c) {
      cancel = c;
    });
    return {
      token,
      cancel
    };
  }
}

export default CancelToken;
