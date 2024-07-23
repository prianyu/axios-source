import platform from "../platform/index.js";
import utils from "../utils.js";
import AxiosError from "../core/AxiosError.js";
import composeSignals from "../helpers/composeSignals.js";
import { trackStream } from "../helpers/trackStream.js";
import AxiosHeaders from "../core/AxiosHeaders.js";
import progressEventReducer from "../helpers/progressEventReducer.js";
import resolveConfig from "../helpers/resolveConfig.js";
import settle from "../core/settle.js";

// fetch进度信息的修饰器
// 接收总长度和回调函数，返回一个接收进度的新函数
// 新函数执行后会执行回调函数并接收进度信息
const fetchProgressDecorator = (total, fn) => {
  const lengthComputable = total != null;
  return (loaded) => setTimeout(() => fn({
    lengthComputable,
    total,
    loaded
  }));
}

// 判断是否支持fetch
const isFetchSupported = typeof fetch === 'function' && typeof Request === 'function' && typeof Response === 'function';
// 是否支持ReadableStream
const isReadableStreamSupported = isFetchSupported && typeof ReadableStream === 'function';

// used only inside the fetch adapter
//
const encodeText = isFetchSupported && (typeof TextEncoder === 'function' ?
  // 使用TextEncoder解析文本
  ((encoder) => (str) => encoder.encode(str))(new TextEncoder()) :
  // 使用UnityArray解析文本
  async (str) => new Uint8Array(await new Response(str).arrayBuffer())
);
// 是否支持请求流的能力检测
// https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests?hl=zh-cn
// 如果宿主环境的body不支持ReadableStream类型，它会调用其toString方法转为[object ReadableStream]
// 当body被转为string时，Content-Type也会被设置成text/plain;charset=UTF-8
// 所以可以通过判断Content-Type是否被设置来判断是否支持请求流
// 但是Safari中虽然支持ReadableStream，但是不支持duplex属性，所以可以通过判断是否读取了duplex属性来附加判断
const supportsRequestStream = isReadableStreamSupported && (() => {
  let duplexAccessed = false;

  const hasContentType = new Request(platform.origin, {
    body: new ReadableStream(), // 传入一个可读流
    method: 'POST',
    get duplex() { // 跟踪是否访问了duplex属性
      duplexAccessed = true;
      return 'half'; // 目前half是duplex唯一的有效值
    },
  }).headers.has('Content-Type'); // 是否包含content-type请求头

  // 访问过duplex属性，且没有content-type请求头，说明支持请求流
  return duplexAccessed && !hasContentType;
})();

const DEFAULT_CHUNK_SIZE = 64 * 1024;

// 通过判断Response的body实例属性是否为ReadableStream，判断是否支持响应流
const supportsResponseStream = isReadableStreamSupported && !!(() => {
  try {
    return utils.isReadableStream(new Response('').body);
  } catch (err) {
    // return undefined
  }
})();

//定义响应体解析函数
// 解析stream
const resolvers = {
  stream: supportsResponseStream && ((res) => res.body)
};

// 解析text, arrayBuffer, blob, formData, stream
isFetchSupported && (((res) => {
  ['text', 'arrayBuffer', 'blob', 'formData', 'stream'].forEach(type => {
    !resolvers[type] && (resolvers[type] = utils.isFunction(res[type]) ? (res) => res[type]() :
      (_, config) => { // 不支持的类型
        throw new AxiosError(`Response type '${type}' is not supported`, AxiosError.ERR_NOT_SUPPORT, config);
      })
  });
})(new Response));

// 获取请求体字节长度
const getBodyLength = async (body) => {
  if (body == null) {
    return 0;
  }

  // blob返回size
  if (utils.isBlob(body)) {
    return body.size;
  }

  // formData
  if (utils.isSpecCompliantForm(body)) {
    return (await new Request(body).arrayBuffer()).byteLength;
  }

  // arrayBuffer
  if (utils.isArrayBufferView(body)) {
    return body.byteLength;
  }
  // URLSearchParams
  if (utils.isURLSearchParams(body)) {
    body = body + '';
  }

  if (utils.isString(body)) {
    return (await encodeText(body)).byteLength;
  }
}

// 获取请求体字节长度，优先使用headers中的Content-Length
const resolveBodyLength = async (headers, body) => {
  const length = utils.toFiniteNumber(headers.getContentLength());

  return length == null ? getBodyLength(body) : length;
}

export default isFetchSupported && (async (config) => {
  let {
    url,
    method,
    data,
    signal,
    cancelToken,
    timeout,
    onDownloadProgress,
    onUploadProgress,
    responseType,
    headers,
    withCredentials = 'same-origin',
    fetchOptions
  } = resolveConfig(config); // 解析config

  // 响应类型
  responseType = responseType ? (responseType + '').toLowerCase() : 'text';

  // 获取组合signal和停止超时处理的函数
  let [composedSignal, stopTimeout] = (signal || cancelToken || timeout) ?
    composeSignals([signal, cancelToken], timeout) : [];

  let finished, request;

  const onFinish = () => {
    // 移除signal的abort监听
    !finished && setTimeout(() => {
      composedSignal && composedSignal.unsubscribe();
    });

    // 标记为请求完成
    finished = true;
  }

  let requestContentLength;

  try {
    // 支持请求流且传入了上传进度回调
    // 且请求体长度不为0、请求方法不为get、head
    if (
      onUploadProgress && supportsRequestStream && method !== 'get' && method !== 'head' &&
      (requestContentLength = await resolveBodyLength(headers, data)) !== 0
    ) {
      // 创建请求对象
      let _request = new Request(url, {
        method: 'POST',
        body: data,
        duplex: "half"
      });

      let contentTypeHeader;
      // 如果是FormData则获取content-type并设置
      if (utils.isFormData(data) && (contentTypeHeader = _request.headers.get('content-type'))) {
        headers.setContentType(contentTypeHeader)
      }

      // 追踪数据流
      const fetchProgressDecorator = (total, fn) => {
        const lengthComputable = total != null;
        return (loaded) => setTimeout(() => fn({
          lengthComputable,
          total,
          loaded
        }));
      }

      /**
        1. trackStream第三个参数是一个接收已加载长度的函数，会不断的更新缓冲区并执行
        2. fetchProgressDecorator会返回一个接收loaded参数的函数，该异步执行传入的fn，而fn接收一个包含
          total（即requestContentLength）/loaded/lengthComputable属性的对象
        3. progressEventReducer会返回一个节流函数，该函数最终会以包含各种进度信息的对象为参数调用onUploadProgress
       */
      if (_request.body) {
        data = trackStream(_request.body, DEFAULT_CHUNK_SIZE, fetchProgressDecorator(
          requestContentLength,
          progressEventReducer(onUploadProgress)
        ), null, encodeText);
      }
    }

    // 是否在跨域请求下发送cookies
    // omit: 从不发送；same-origin: 默认值，同源发送cookies；include: 发送cookies
    // @suspense
    if (!utils.isString(withCredentials)) {
      withCredentials = withCredentials ? 'cors' : 'omit';
    }

    // 创建fetch的Request对象
    request = new Request(url, {
      ...fetchOptions,
      signal: composedSignal, // 组合信号
      method: method.toUpperCase(), // 方法
      headers: headers.normalize().toJSON(), // 请求头
      body: data, // 请求体
      duplex: "half", // 双工通信
      withCredentials
    });

    // 发送请求
    let response = await fetch(request);

    // 是否是流响应
    const isStreamResponse = supportsResponseStream && (responseType === 'stream' || responseType === 'response');

    // 支持流响应
    if (supportsResponseStream && (onDownloadProgress || isStreamResponse)) {
      const options = {};
      // 获取响应的status、statusText、headers
      ['status', 'statusText', 'headers'].forEach(prop => {
        options[prop] = response[prop];
      });

      // content-length响应头
      const responseContentLength = utils.toFiniteNumber(response.headers.get('content-length'));

      response = new Response(
        trackStream(response.body, DEFAULT_CHUNK_SIZE, onDownloadProgress && fetchProgressDecorator(
          responseContentLength,
          progressEventReducer(onDownloadProgress, true)
        ), isStreamResponse && onFinish, encodeText),
        options
      );
    }

    // 响应类型
    responseType = responseType || 'text';

    // 根据响应类型解析响应体
    let responseData = await resolvers[utils.findKey(resolvers, responseType) || 'text'](response, config);

    // 响应完成
    !isStreamResponse && onFinish();

    // 取消超时处理定时器
    stopTimeout && stopTimeout();

    return await new Promise((resolve, reject) => {
      // 处理响应
      settle(resolve, reject, {
        data: responseData,
        headers: AxiosHeaders.from(response.headers),
        status: response.status,
        statusText: response.statusText,
        config,
        request
      })
    })
  } catch (err) { // 请求出错（如URL格式错误、网络错误）
    onFinish();

    if (err && err.name === 'TypeError' && /fetch/i.test(err.message)) {
      throw Object.assign(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, request),
        {
          cause: err.cause || err
        }
      )
    }

    throw AxiosError.from(err, err && err.code, config, request);
  }
});


