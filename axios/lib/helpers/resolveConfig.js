import platform from "../platform/index.js";
import utils from "../utils.js";
import isURLSameOrigin from "./isURLSameOrigin.js";
import cookies from "./cookies.js";
import buildFullPath from "../core/buildFullPath.js";
import mergeConfig from "../core/mergeConfig.js";
import AxiosHeaders from "../core/AxiosHeaders.js";
import buildURL from "./buildURL.js";

// 处理配置对象并返回处理后的新的配置对象
// 1. 合并初始的配置
// 2. 设置或者更新请求头，包括content-type和Authorization
// 3. 构建完成的请求url
// 4. 在标准浏览器环境下设置XSRF令牌（如需如有或同源下）
export default (config) => {
  const newConfig = mergeConfig({}, config); // 合并输入的配置对象

  // 解构与请求相关的各种配置项
  let { data, withXSRFToken, xsrfHeaderName, xsrfCookieName, headers, auth } = newConfig;

  // 创建headers对象
  newConfig.headers = headers = AxiosHeaders.from(headers);

  // 构建完整的url
  newConfig.url = buildURL(buildFullPath(newConfig.baseURL, newConfig.url), config.params, config.paramsSerializer);

  // HTTP basic authentication
  // authentication认证信息
  if (auth) {
    headers.set('Authorization', 'Basic ' +
      btoa((auth.username || '') + ':' + (auth.password ? unescape(encodeURIComponent(auth.password)) : ''))
    );
  }

  // -------设置contentType

  let contentType;

  // 如果data是FormData类型
  if (utils.isFormData(data)) {
    // 标准浏览器和Web Worker环境下设置content-type为undefined
    // 让浏览器自动设置content-type
    if (platform.hasStandardBrowserEnv || platform.hasStandardBrowserWebWorkerEnv) {
      headers.setContentType(undefined); // Let the browser set it
    } else if ((contentType = headers.getContentType()) !== false) {
      // fix semicolon duplication issue for ReactNative FormData implementation
      // 处理ReactNative下content-type包含重复分号的问题
      // 去除空白的内容后拼接设置contentType
      const [type, ...tokens] = contentType ? contentType.split(';').map(token => token.trim()).filter(Boolean) : [];
      headers.setContentType([type || 'multipart/form-data', ...tokens].join('; '));
    }
  }

  // 标准浏览器环境下设置XSRF令牌
  // Add xsrf header
  // This is only done if running in a standard browser environment.
  // Specifically not if we're in a web worker, or react-native.

  if (platform.hasStandardBrowserEnv) {
    // 如果存在withXSRFToken函数，则调用withXSRFToken函数获取值
    withXSRFToken && utils.isFunction(withXSRFToken) && (withXSRFToken = withXSRFToken(newConfig));

    // withXSRFToken为真或者URL同源，则设置XSRF令牌
    if (withXSRFToken || (withXSRFToken !== false && isURLSameOrigin(newConfig.url))) {
      // Add xsrf header
      // 从cookie中读取XSRF令牌
      const xsrfValue = xsrfHeaderName && xsrfCookieName && cookies.read(xsrfCookieName);

      // 令牌存在则设置
      if (xsrfValue) {
        headers.set(xsrfHeaderName, xsrfValue);
      }
    }
  }

  // 返回新的配置
  return newConfig;
}

