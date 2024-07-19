import utils from './../utils.js';
import settle from './../core/settle.js';
import transitionalDefaults from '../defaults/transitional.js';
import AxiosError from '../core/AxiosError.js';
import CanceledError from '../cancel/CanceledError.js';
import parseProtocol from '../helpers/parseProtocol.js';
import platform from '../platform/index.js';
import AxiosHeaders from '../core/AxiosHeaders.js';
import progressEventReducer from '../helpers/progressEventReducer.js';
import resolveConfig from "../helpers/resolveConfig.js";


const isXHRAdapterSupported = typeof XMLHttpRequest !== 'undefined';

export default isXHRAdapterSupported && function (config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    const _config = resolveConfig(config); // 解析config
    let requestData = _config.data; // 获取请求数据
    const requestHeaders = AxiosHeaders.from(_config.headers).normalize(); // 获取请求头
    let { responseType } = _config; // 响应类型
    let onCanceled;

    // 请求完成
    function done() {
      // 完成了，移除取消订阅
      if (_config.cancelToken) {
        _config.cancelToken.unsubscribe(onCanceled);
      }

      if (_config.signal) {
        _config.signal.removeEventListener('abort', onCanceled);
      }
    }

    let request = new XMLHttpRequest(); // 创建XMLHttpRequest实例

    // 初始化请求，使用异步
    request.open(_config.method.toUpperCase(), _config.url, true);

    // Set the request timeout in MS
    // 设置请求超时时间（ms）
    request.timeout = _config.timeout;

    function onloadend() {
      if (!request) {
        return;
      }
      // Prepare the response
      // 响应头
      const responseHeaders = AxiosHeaders.from(
        'getAllResponseHeaders' in request && request.getAllResponseHeaders()
      );
      // 响应数据
      // responseText是纯文本
      // response会根据responseType来决定响应的类型，如ArrayBuffer,Blob,Document,string等
      const responseData = !responseType || responseType === 'text' || responseType === 'json' ?
        request.responseText : request.response;
      // 设置响应数据
      const response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config,
        request
      };

      // 根据响应状态设置promise的状态
      settle(function _resolve(value) {
        // 响应成功
        resolve(value);
        done();
      }, function _reject(err) {
        // 响应失败
        reject(err);
        done();
      }, response);

      // Clean up request
      request = null;
    }

    // 如果支持onloadend则使用onloadend处理请求，否则使用onreadystatechange处理请求
    if ('onloadend' in request) {
      // Use onloadend if available
      request.onloadend = onloadend;
    } else {
      // Listen for ready state to emulate onloadend
      // 监听readyState的变化
      request.onreadystatechange = function handleLoad() {
        // 请求未完成
        if (!request || request.readyState !== 4) {
          return;
        }
        // 请求完成
        // The request errored out and we didn't get a response, this will be
        // handled by onerror instead
        // With one exception: request that using file: protocol, most browsers
        // will return status as 0 even though it's a successful request
        // 如果请求的状态码未为0，有两种可能：
        // 1. 请求出错了，没有响应，这种情况通常会被onerror事件处理
        // 2. 请求使用了file:协议，大多数浏览器会返回状态码0，即使请求成功了
        // 该逻辑分支就是排除了file:协议的情况，状态码为0则直接返回不处理
        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
          return;
        }
        // readystate handler is calling before onerror or ontimeout handlers,
        // so we should call onloadend on the next 'tick'
        // readystatechange事件处理程序在onerror和ontimeout事件之前处理，因此要确保onloadend在下一个事件循环中触发
        setTimeout(onloadend);
      };
    }

    // Handle browser request cancellation (as opposed to a manual cancellation)
    // 监听请求取消事件
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      // 取消请求
      reject(new AxiosError('Request aborted', AxiosError.ECONNABORTED, _config, request));

      // Clean up request
      // 清除请求
      request = null;
    };

    // Handle low level network errors
    // 网络错误
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, _config, request));

      // Clean up request
      // 清除请求
      request = null;
    };

    // Handle timeout
    // 超时错误
    request.ontimeout = function handleTimeout() {
      // 错误信息
      let timeoutErrorMessage = _config.timeout ? 'timeout of ' + _config.timeout + 'ms exceeded' : 'timeout exceeded';
      const transitional = _config.transitional || transitionalDefaults; // 获取transitional
      if (_config.timeoutErrorMessage) { // 如果设置了timeoutErrorMessage，则使用设置的值
        timeoutErrorMessage = _config.timeoutErrorMessage;
      }
      // 创建超时错误
      reject(new AxiosError(
        timeoutErrorMessage,
        // 
        transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
        _config,
        request));

      // Clean up request
      request = null;
    };

    // Remove Content-Type if data is undefined
    // 如果没有请求主体，则将Content-Type头设置为null
    // 这是为了确保请求头信息与主体的一致性，减少不必要的请求头，优化网络传输，避免服务器处理错误
    // 同时也是符合HTTP标准
    requestData === undefined && requestHeaders.setContentType(null);

    // Add headers to the request
    // 设置请求头
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders.toJSON(), function setRequestHeader(val, key) {
        request.setRequestHeader(key, val);
      });
    }

    // Add withCredentials to request if needed
    // 设置withCredentials
    // 跨域请求是否携带凭据，如Cookie
    if (!utils.isUndefined(_config.withCredentials)) {
      request.withCredentials = !!_config.withCredentials;
    }

    // Add responseType to request if needed
    // 设置响应类型
    if (responseType && responseType !== 'json') {
      request.responseType = _config.responseType;
    }

    // Handle progress if needed
    // 监听下载进度事件
    if (typeof _config.onDownloadProgress === 'function') {
      request.addEventListener('progress', progressEventReducer(_config.onDownloadProgress, true));
    }

    // Not all browsers support upload events
    // 监听上传进度事件，该事件不是所有浏览器都支持
    if (typeof _config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', progressEventReducer(_config.onUploadProgress));
    }

    // 传入cancelToken和AbortSignal
    if (_config.cancelToken || _config.signal) {
      // Handle cancellation
      // eslint-disable-next-line func-names
      // 定义取消处理函数
      onCanceled = cancel => {
        if (!request) {
          return;
        }
        // 拒绝当前promise
        // 取消信息中不包含type属性或者不存在则创建一个新的CanceledError
        reject(!cancel || cancel.type ? new CanceledError(null, config, request) : cancel);
        request.abort(); // 中断请求
        request = null; // 清空请求对象
      };

      // 定于取消令牌的取消事件
      _config.cancelToken && _config.cancelToken.subscribe(onCanceled);
      if (_config.signal) {
        // 已经取消了则立即调用取消回调
        // 否则监听abort事件
        _config.signal.aborted ? onCanceled() : _config.signal.addEventListener('abort', onCanceled);
      }
    }

    // 从url中解析请求协议
    const protocol = parseProtocol(_config.url);

    // 检查是否支持该协议
    if (protocol && platform.protocols.indexOf(protocol) === -1) {
      reject(new AxiosError('Unsupported protocol ' + protocol + ':', AxiosError.ERR_BAD_REQUEST, config));
      return;
    }


    // Send the request
    // 发送请求
    request.send(requestData || null);
  });
}