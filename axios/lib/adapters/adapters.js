import utils from '../utils.js';
import httpAdapter from './http.js';
import xhrAdapter from './xhr.js';
import fetchAdapter from './fetch.js';
import AxiosError from "../core/AxiosError.js";

// 已知的内置的adapter类型
const knownAdapters = {
  http: httpAdapter, // nodejs http 模块
  xhr: xhrAdapter, // XMLHttpRequest
  fetch: fetchAdapter // fetch
}

// 定义适配器的名称，通常是方便于识别和调试
utils.forEach(knownAdapters, (fn, value) => {
  if (fn) {
    // 定义适配器的名称
    // 有些环境name属性是只读的，定义时会报错
    try {
      Object.defineProperty(fn, 'name', { value });
    } catch (e) {
      // eslint-disable-next-line no-empty
    }
    // 定义adapterName属性，与name一致
    Object.defineProperty(fn, 'adapterName', { value });
  }
});

const renderReason = (reason) => `- ${reason}`;

// 检查是否是一个函数、null或false
const isResolvedHandle = (adapter) => utils.isFunction(adapter) || adapter === null || adapter === false;

export default {
  // 获取适配器
  // 遍历一组可能的适配器，并返回第一个有效的适配器
  // 如果没有找到合适的适配器，则会抛出异常
  getAdapter: (adapters) => {
    adapters = utils.isArray(adapters) ? adapters : [adapters]; // 统一转为数组

    const { length } = adapters;
    let nameOrAdapter;
    let adapter;

    const rejectedReasons = {};

    // 遍历adapters
    for (let i = 0; i < length; i++) {
      nameOrAdapter = adapters[i]; // 可能是一个适配器，也可能是一个适配器名称
      let id;

      adapter = nameOrAdapter;

      // 如果nameOrAdapter不是函数，且不为null或false
      // 则转为字符串，并以其作为key从knownAdapters中获取adapter
      if (!isResolvedHandle(nameOrAdapter)) {
        adapter = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()];

        // 没有定义adapter，则抛出异常
        if (adapter === undefined) {
          throw new AxiosError(`Unknown adapter '${id}'`);
        }
      }

      // 如果adapter存在，则跳出循环
      if (adapter) {
        break;
      }

      // 收集所有不合适的适配器及其原因
      rejectedReasons[id || '#' + i] = adapter;
    }

    // 找不到有效的适配器，则根据收集的错误信息，构建最终错误信息并抛出异常
    // 走到这里说明adapter不是函数、false、null，且为falsy的值
    if (!adapter) {

      // 拼接错误信息
      const reasons = Object.entries(rejectedReasons)
        .map(([id, state]) => `adapter ${id} ` +
          (state === false ? 'is not supported by the environment' : 'is not available in the build')
        );

      let s = length ?
        (reasons.length > 1 ? 'since :\n' + reasons.map(renderReason).join('\n') : ' ' + renderReason(reasons[0])) :
        'as no adapter specified';

      throw new AxiosError(
        `There is no suitable adapter to dispatch the request ` + s,
        'ERR_NOT_SUPPORT'
      );
    }
    // 返回得到的adapter
    return adapter;
  },
  adapters: knownAdapters // 内置的adapters
}
