import URLSearchParams from './classes/URLSearchParams.js'
import FormData from './classes/FormData.js'

export default {
  isNode: true, // 标记Node环境
  classes: {
    URLSearchParams, // url库的URLSearchParams类
    FormData, // form-data库
    Blob: typeof Blob !== 'undefined' && Blob || null
  },
  protocols: ['http', 'https', 'file', 'data'] // 协议列表
}
