import { TextEncoder } from 'util';
import { Readable } from 'stream';
import utils from "../utils.js";
import readBlob from "./readBlob.js";

const BOUNDARY_ALPHABET = utils.ALPHABET.ALPHA_DIGIT + '-_'; // 字母数字下_-

const textEncoder = new TextEncoder();

const CRLF = '\r\n';
const CRLF_BYTES = textEncoder.encode(CRLF);
const CRLF_BYTES_COUNT = 2;

class FormDataPart {
  constructor(name, value) {
    const { escapeName } = this.constructor;
    const isStringValue = utils.isString(value);

    let headers = `Content-Disposition: form-data; name="${escapeName(name)}"${!isStringValue && value.name ? `; filename="${escapeName(value.name)}"` : ''
      }${CRLF}`;

    if (isStringValue) {
      value = textEncoder.encode(String(value).replace(/\r?\n|\r\n?/g, CRLF));
    } else {
      headers += `Content-Type: ${value.type || "application/octet-stream"}${CRLF}`
    }

    this.headers = textEncoder.encode(headers + CRLF);

    this.contentLength = isStringValue ? value.byteLength : value.size;

    this.size = this.headers.byteLength + this.contentLength + CRLF_BYTES_COUNT;

    this.name = name;
    this.value = value;
  }

  async *encode() {
    yield this.headers;

    const { value } = this;

    if (utils.isTypedArray(value)) {
      yield value;
    } else {
      yield* readBlob(value);
    }

    yield CRLF_BYTES;
  }

  static escapeName(name) {
    return String(name).replace(/[\r\n"]/g, (match) => ({
      '\r': '%0D',
      '\n': '%0A',
      '"': '%22',
    }[match]));
  }
}

/**
 * 将FormData转换为可读流
 * @param {*} form FormData实例，要转换的表单数据
 * @param {*} headersHandler 处理生成的头部信息的函数
 * @param {*} options 配置对象，包含tag、size、boundary等属性
 * @returns 
 */
const formDataToStream = (form, headersHandler, options) => {
  const {
    tag = 'form-data-boundary', // 用于生成boundary标记
    size = 25,
    boundary = tag + '-' + utils.generateString(size, BOUNDARY_ALPHABET) // 生成一个随机的boundary
  } = options || {};

  if (!utils.isFormData(form)) { // 不是FormData实例
    throw TypeError('FormData instance required');
  }
  // boundary长度不正确
  if (boundary.length < 1 || boundary.length > 70) {
    throw Error('boundary must be 10-70 characters long')
  }

  // 将边界字符串和结束字符串转为字节数组
  const boundaryBytes = textEncoder.encode('--' + boundary + CRLF);
  const footerBytes = textEncoder.encode('--' + boundary + '--' + CRLF + CRLF);
  let contentLength = footerBytes.byteLength; // 长度初始值为结束字符串的长度

  // 将表单项转为FormDataPart实例，并累计内容长度
  const parts = Array.from(form.entries()).map(([name, value]) => {
    const part = new FormDataPart(name, value);
    contentLength += part.size;
    return part;
  });

  // 计算总边界长度
  contentLength += boundaryBytes.byteLength * parts.length;

  // 转为有限的数字
  contentLength = utils.toFiniteNumber(contentLength);

  // 设置头部信息
  const computedHeaders = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  }

  if (Number.isFinite(contentLength)) {
    computedHeaders['Content-Length'] = contentLength;
  }

  // 头部信息处理
  headersHandler && headersHandler(computedHeaders);

  // 返回一个异步生成器，生成表单数据流
  return Readable.from((async function* () {
    for (const part of parts) {
      yield boundaryBytes; // 产出边界字节
      yield* part.encode(); // 输出表单项
    }

    yield footerBytes; // 输出结束字符串
  })());
};

export default formDataToStream;
