'use strict';

import utils from './utils.js';
import bind from './helpers/bind.js';
import Axios from './core/Axios.js';
import mergeConfig from './core/mergeConfig.js';
import defaults from './defaults/index.js';
import formDataToJSON from './helpers/formDataToJSON.js';
import CanceledError from './cancel/CanceledError.js';
import CancelToken from './cancel/CancelToken.js';
import isCancel from './cancel/isCancel.js';
import { VERSION } from './env/data.js';
import toFormData from './helpers/toFormData.js';
import AxiosError from './core/AxiosError.js';
import spread from './helpers/spread.js';
import isAxiosError from './helpers/isAxiosError.js';
import AxiosHeaders from "./core/AxiosHeaders.js";
import adapters from './adapters/adapters.js';
import HttpStatusCode from './helpers/HttpStatusCode.js';

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 *
 * @returns {Axios} A new instance of Axios
 * 用于创建axios请求的实例
 */

// Create the default instance to be exported
// 创建axios的默认实例用于导出
const axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
// 在实力上暴露Axios类，
axios.Axios = Axios;

// Expose Cancel & CancelToken
// 暴露Cancel和CancelToken相关的函数等
axios.CanceledError = CanceledError;
axios.CancelToken = CancelToken;
axios.isCancel = isCancel;
axios.VERSION = VERSION;
axios.toFormData = toFormData;

// Expose AxiosError class
// 暴漏创建AxiosError的函数
axios.AxiosError = AxiosError;

// alias for CanceledError for backward compatibility
// 暴漏CanceledError的别名用于兼容
axios.Cancel = axios.CanceledError;

// Expose all/spread
// 添加all方法
axios.all = function all(promises) {
  return Promise.all(promises);
};

// 添加参数扩展方法
// 是Function.prototype.apply的语法糖
// spread(fn)(args) => fn.apply(null, args)
axios.spread = spread;

// Expose isAxiosError
// 用于判断传入的内容是否为一个Axios错误
axios.isAxiosError = isAxiosError;

// Expose mergeConfig
// 用于合并两个axios配置的方法
axios.mergeConfig = mergeConfig;

// 用于管理axios的headers的类
axios.AxiosHeaders = AxiosHeaders;

// 将formData转为json
axios.formToJSON = thing => formDataToJSON(utils.isHTMLForm(thing) ? new FormData(thing) : thing);

// 获取有效的请求适配器
axios.getAdapter = adapters.getAdapter;

// 状态码枚举
axios.HttpStatusCode = HttpStatusCode;

// axios实例自引用，兼容CommonJS
axios.default = axios;

// this module should only have a default export
// 导出默认实例
export default axios
