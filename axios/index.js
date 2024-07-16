import axios from './lib/axios.js';

// This module is intended to unwrap Axios default export as named.
// Keep top-level export same with static properties
// so that it can keep same with es module or cjs

// 将Axios的默认导出解包为命名导出，使得模块既可以作为ES模块，也可以作为CJS模块
const {
  Axios,
  AxiosError,
  CanceledError,
  isCancel,
  CancelToken,
  VERSION,
  all,
  Cancel,
  isAxiosError,
  spread,
  toFormData,
  AxiosHeaders,
  HttpStatusCode,
  formToJSON,
  getAdapter,
  mergeConfig
} = axios;

export {
  axios as default,
  Axios,
  AxiosError,
  CanceledError,
  isCancel,
  CancelToken,
  VERSION,
  all,
  Cancel,
  isAxiosError,
  spread,
  toFormData,
  AxiosHeaders,
  HttpStatusCode,
  formToJSON,
  getAdapter,
  mergeConfig
}
