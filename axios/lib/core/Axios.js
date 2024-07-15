'use strict';

import utils from './../utils.js';
import buildURL from '../helpers/buildURL.js';
import InterceptorManager from './InterceptorManager.js';
import dispatchRequest from './dispatchRequest.js';
import mergeConfig from './mergeConfig.js';
import buildFullPath from './buildFullPath.js';
import validator from '../helpers/validator.js';
import AxiosHeaders from './AxiosHeaders.js';

const validators = validator.validators;

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 *
 * @return {Axios} A new instance of Axios
 */
class Axios {
  constructor(instanceConfig) {
    this.defaults = instanceConfig; // 保存配置
    this.interceptors = {
      request: new InterceptorManager(), // 请求拦截器管理器
      response: new InterceptorManager() // 响应拦截器管理器
    };
  }

  /**
   * Dispatch a request
   *
   * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
   * @param {?Object} config
   *
   * @returns {Promise} The Promise to be fulfilled
   */
  async request(configOrUrl, config) {
    try {
      // request是axios的核心，其最终由用户直接调用，需要捕获其异常信息并抛出一个格式化后的异常
      return await this._request(configOrUrl, config);
    } catch (err) {
      if (err instanceof Error) {
        let dummy;

        // 在支持Error.captureStackTrace环境下（如NodeJS）使用Error.captureStackTrace捕获错误调用栈 
        Error.captureStackTrace ? Error.captureStackTrace(dummy = {}) : (dummy = new Error());

        // slice off the Error: ... line
        // 获取调用栈的堆栈信息，去除"Error: ..."那一行（一般是第一行）
        const stack = dummy.stack ? dummy.stack.replace(/^.+\n/, '') : '';
        // 合并堆栈信息
        try {
          if (!err.stack) { // 如果原始的错误对象没有堆栈信息，则附加堆栈信息
            err.stack = stack;
            // match without the 2 top stack lines
          } else if (stack && !String(err.stack).endsWith(stack.replace(/^.+\n.+\n/, ''))) {
            // 从stack中去除掉前两行，判断err.stack中是否已经包含两了stack中堆栈，如果没有包含就追加调用栈
            // stack的信息类似如下，去掉前两行后就是最后两行了
            /**
             Error
                at throwError (/path/to/file.js:3:11)
                at handleError (/path/to/file.js:19:5)
                at Object.<anonymous> (/path/to/file.js:23:1)
             */
            err.stack += '\n' + stack
          }
        } catch (e) {
          // 忽略stack不可写的情况而抛出额外的异常
          // ignore the case where "stack" is an un-writable property
        }
      }

      throw err;
    }
  }

  _request(configOrUrl, config) {
    /*eslint no-param-reassign:0*/
    // Allow for axios('example/url'[, config]) a la fetch API
    // 参数归一，(string, config:any) => config:object
    // 如果configOrUrl是string则作为config.url传入
    if (typeof configOrUrl === 'string') {
      config = config || {};
      config.url = configOrUrl;
    } else {
      config = configOrUrl || {};
    }

    // 合并配置
    config = mergeConfig(this.defaults, config);

    const { transitional, paramsSerializer, headers } = config;

    // 过渡配置的校验
    if (transitional !== undefined) {
      validator.assertOptions(transitional, {
        // 是否在解析JSON响应时静默的处理错误
        silentJSONParsing: validators.transitional(validators.boolean),
        // 是否在解析响应时强制进行JSON解析（即使content-type没有json指示）
        forcedJSONParsing: validators.transitional(validators.boolean),
        // 是否在超时错误时抛出更明确的错误信息
        clarifyTimeoutError: validators.transitional(validators.boolean)
      }, false);
    }

    // 自定义的params查询参数序列化方式
    if (paramsSerializer != null) {
      if (utils.isFunction(paramsSerializer)) {
        config.paramsSerializer = {
          serialize: paramsSerializer
        }
      } else {
        // 断言paramsSerializer参数的值
        // 从这里可以看到，paramsSerializer不仅可以是个函数，
        // 还是可以是个包含类型为函数的encode，serialize属性的对象
        validator.assertOptions(paramsSerializer, {
          encode: validators.function, // 编码函数
          serialize: validators.function // 序列化函数
        }, true); // 允许定义未知属性
      }
    }

    // Set config.method
    // 设置method，默认为get
    config.method = (config.method || this.defaults.method || 'get').toLowerCase();

    // Flatten headers
    // 扁平化合并headers
    // 即headers是可以定义通用的，以及根据不同的方法区分的headers
    let contextHeaders = headers && utils.merge(
      headers.common,
      headers[config.method]
    );

    // 删除不必要的headers
    headers && utils.forEach(
      ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
      (method) => {
        delete headers[method];
      }
    );

    // 合并headers
    config.headers = AxiosHeaders.concat(contextHeaders, headers);

    // filter out skipped interceptors
    // 过滤掉要被跳过的拦截器
    const requestInterceptorChain = []; // 用于存储有效的请求拦截器
    let synchronousRequestInterceptors = true; // 标识所有的拦截器是否都是同步进行的
    // 遍历请求拦截器
    this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
      // 如果拦截器的runWhen函数返回false，则跳过该拦截器
      if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
        return;
      }

      // 如果拦截器一直是同步的则会保持为true，否则为false
      synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

      // 将拦截器添加到请求拦截器链里
      // 顺序是倒序的
      // 每次都会添加fulfilled和rejected两个函数
      requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
    });

    const responseInterceptorChain = []; // 存储响应拦截器
    // 遍历响应拦截器并添加到响应拦截器链里，顺序是正序的
    // 每次都会添加fulfilled和rejected两个函数
    this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
      responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
    });

    let promise;
    let i = 0;
    let len;


    // 如果存在异步请求拦截器---------------
    if (!synchronousRequestInterceptors) {
      const chain = [dispatchRequest.bind(this), undefined]; // 定义初始链条，这是请求发起的地方
      chain.unshift.apply(chain, requestInterceptorChain); // 将请求拦截器添加到初始链条的开头
      chain.push.apply(chain, responseInterceptorChain); // 将响应拦截器添加到初始链条的结尾
      len = chain.length;

      promise = Promise.resolve(config); // 从config中创建一个初始的Promise

      // 遍历链条，依次将拦截器的fulfilled和reject添加到promise.then尚
      while (i < len) {
        promise = promise.then(chain[i++], chain[i++]);
      }
      // 返回最终的promise
      return promise;
    }

    // 如果所有请求拦截器都是同步的
    len = requestInterceptorChain.length;

    let newConfig = config; // 初始化一个新的config对象

    i = 0;

    // 遍历执行同步请求拦截器
    while (i < len) {
      const onFulfilled = requestInterceptorChain[i++];
      const onRejected = requestInterceptorChain[i++];
      try {
        // 尝试执行请求拦截器的fulfilled函数，并更新newConfig
        newConfig = onFulfilled(newConfig);
      } catch (error) { // 发生错误则退出循环
        onRejected.call(this, error);
        break;
      }
    }

    // 调度请求并处理可能的错误
    try {
      promise = dispatchRequest.call(this, newConfig);
    } catch (error) {
      return Promise.reject(error);
    }

    // 处理响应拦截器
    i = 0;
    len = responseInterceptorChain.length;

    while (i < len) {
      promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
    }

    // 返回最终的promise
    return promise;
  }

  getUri(config) {
    config = mergeConfig(this.defaults, config);
    const fullPath = buildFullPath(config.baseURL, config.url);
    return buildURL(fullPath, config.params, config.paramsSerializer);
  }
}

// 提供request请求支持的方法别名
// 所有的方法都已经将method指定为指定的方法名
// Provide aliases for supported request methods

utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  // 接收url、config两个参数
  Axios.prototype[method] = function (url, config) {
    return this.request(mergeConfig(config || {}, {
      method,
      url,
      data: (config || {}).data
    }));
  };
});

// post,put,patch,postForm,putForm,patchForm
utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/

  function generateHTTPMethod(isForm) {
    // 接收url、data、config三个参数
    return function httpMethod(url, data, config) {
      return this.request(mergeConfig(config || {}, {
        method,
        headers: isForm ? {
          'Content-Type': 'multipart/form-data'
        } : {},
        url,
        data
      }));
    };
  }

  Axios.prototype[method] = generateHTTPMethod();

  Axios.prototype[method + 'Form'] = generateHTTPMethod(true);
});

export default Axios;
