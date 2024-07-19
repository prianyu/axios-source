// 当前环境是否有window和document对象（浏览器环境）
const hasBrowserEnv = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Determine if we're running in a standard browser environment
 * 
 * Axios可以在web worker和react-native环境下运行，但是这两种环境都没有标准的全局变量
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescriptyunxu
 *  navigator.product -> 'NativeScript' or 'NS'
 *
 * @returns {boolean}
 */
// 是否为标准浏览器环境
const hasStandardBrowserEnv = (
  (product) => {
    // 是否为浏览器且不是react-native和nativescript环境
    return hasBrowserEnv && ['ReactNative', 'NativeScript', 'NS'].indexOf(product) < 0
  })(typeof navigator !== 'undefined' && navigator.product);

/**
 * Determine if we're running in a standard browser webWorker environment
 *
 * Although the `isStandardBrowserEnv` method indicates that
 * `allows axios to run in a web worker`, the WebWorker will still be
 * filtered out due to its judgment standard
 * `typeof window !== 'undefined' && typeof document !== 'undefined'`.
 * This leads to a problem when axios post `FormData` in webWorker
 */
// 是否为标准浏览器的WebWorker环境
const hasStandardBrowserWebWorkerEnv = (() => {
  return (
    typeof WorkerGlobalScope !== 'undefined' && // 有WorkerGlobalScope对象
    // eslint-disable-next-line no-undef
    self instanceof WorkerGlobalScope && // self是WorkerGlobalScope的实例
    typeof self.importScripts === 'function' // self.importScripts是函数
  );
})();

// 当前环境地址，如果是浏览器环境则获取当前地址，否则为localhost
const origin = hasBrowserEnv && window.location.href || 'http://localhost';

export {
  hasBrowserEnv,
  hasStandardBrowserWebWorkerEnv,
  hasStandardBrowserEnv,
  origin
}
