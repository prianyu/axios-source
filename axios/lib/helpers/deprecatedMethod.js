'use strict';

/*eslint no-console:0*/

/**
 * Supply a warning to the developer that a method they are using
 * has been deprecated.
 * 输出已废弃的方法的提醒
 *
 * @param {string} method The name of the deprecated method 废弃的方法名
 * @param {string} [instead] The alternate method to use if applicable 替代方法
 * @param {string} [docs] The documentation URL to get further details 获取更多详细信息的URL
 *
 * @returns {void}
 */
export default function deprecatedMethod(method, instead, docs) {
  try {
    console.warn(
      'DEPRECATED method `' + method + '`.' +
      (instead ? ' Use `' + instead + '` instead.' : '') +
      ' This method will be removed in a future release.');

    if (docs) {
      console.warn('For more information about usage see ' + docs);
    }
  } catch (e) { /* Ignore */ }
}
