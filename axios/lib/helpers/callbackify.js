/**
 * 将一个async函数转换为支持回调的函数。
 * 如果原始函数是async函数，那么这个函数将会把它转换成一个支持回调的形式。
 * 否则直接返回原始函数。
 * @param {Function} fn 原始函数，可能是异步的也可能是同步的。
 * @param {Function} reducer 一个可选的函数，用于处理原始函数的返回值，然后将其传递给回调。
 * @returns {Function} 转换后的函数，它支持回调形式的异步处理
 * 返回的函数接收两个参数，第一个是错误信息，第二个是处理后的结果
 */
import utils from "../utils.js";

const callbackify = (fn, reducer) => {
  // 检查原始函数是否为异步函数
  return utils.isAsyncFn(fn) ? function (...args) {
    // 从参数中取出回调函数
    const cb = args.pop();
    // 调用原始函数，并处理返回的Promise
    fn.apply(this, args).then((value) => {
      try {
        // 如果提供了reducer函数，则使用它来处理值，否则直接返回值
        reducer ? cb(null, ...reducer(value)) : cb(null, value);
      } catch (err) {
        // 如果处理过程中发生错误，则通过回调返回错误
        cb(err);
      }
    }, cb);
  } : fn;
}

export default callbackify;