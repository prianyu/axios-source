import utils from './../utils.js';
import platform from '../platform/index.js';
/**
 * Cookie操作模块
 * 根据平台环境（是否具有标准浏览器环境）提供不同的实现
 * 在标准浏览器环境中，支持读写删除Cookie
 * 在非标准浏览器环境中（如Web Workers，React Native），则不支持Cookie操作，返回的均是空的方法
 */
export default platform.hasStandardBrowserEnv ?

  // Standard browser envs support document.cookie
  // 标准浏览器
  {
    /**
     * 写入Cookie
     * @param {string} name Cookie的名称
     * @param {string} value Cookie的值
     * @param {number} [expires] Cookie的过期时间，单位为毫秒
     * @param {string} [path] Cookie的作用路径
     * @param {string} [domain] Cookie的作用域
     * @param {boolean} [secure] 是否仅通过安全协议传输Cookie
     */
    write(name, value, expires, path, domain, secure) {
      const cookie = [name + '=' + encodeURIComponent(value)]; // 拼接cookie

      // 设置过期时间
      utils.isNumber(expires) && cookie.push('expires=' + new Date(expires).toGMTString());
      // 设置路径
      utils.isString(path) && cookie.push('path=' + path);

      // 设置作用域
      utils.isString(domain) && cookie.push('domain=' + domain);

      // 是否使用安全传输
      secure === true && cookie.push('secure');

      // 设置cookie
      document.cookie = cookie.join('; ');
    },

    /**
     * 读取Cookie的值
     * 使用正则提取Cookie值
     * @param {string} name 需要读取的Cookie的名称。
     * @returns {string|null} Cookie的值，如果不存在则返回null。
    */
    read(name) {
      const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
      return (match ? decodeURIComponent(match[3]) : null);
    },

    /**
     * 删除Cookie
     * @param {string} name 需要删除的Cookie的名称。
     * 设置过期时间为过去的时间来实现删除Cookie。
     */
    remove(name) {
      this.write(name, '', Date.now() - 86400000);
    }
  }

  :

  // Non-standard browser env (web workers, react-native) lack needed support.
  // Web Worker和ReactNative
  {
    write() { },
    read() {
      return null;
    },
    remove() { }
  };

