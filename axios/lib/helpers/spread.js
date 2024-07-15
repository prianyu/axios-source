'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 *
 * @returns {Function}
 * 用于调用`Function.prototype.apply`的语法糖，接收一个函数，返回一个接收数组的新函数
 * 新函数接收一个数组并使用apply方法调用原始的函数
 */
export default function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
}
