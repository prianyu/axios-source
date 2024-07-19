import URLSearchParams from './classes/URLSearchParams.js'
import FormData from './classes/FormData.js'
import Blob from './classes/Blob.js'

export default {
  isBrowser: true, // 标记浏览器环境
  classes: {
    URLSearchParams, // 原生的URLSearchParams或自定义的AxiosURLSearchParams
    FormData, // 原生的FormData或null
    Blob // 原生的Blob或null
  },
  protocols: ['http', 'https', 'file', 'blob', 'url', 'data'] // 协议列表
};
