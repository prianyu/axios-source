'use strict';

import utils from './../utils.js';
import settle from './../core/settle.js';
import buildFullPath from '../core/buildFullPath.js';
import buildURL from './../helpers/buildURL.js';
import { getProxyForUrl } from 'proxy-from-env';
import http from 'http';
import https from 'https';
import util from 'util';
import followRedirects from 'follow-redirects';
import zlib from 'zlib';
import { VERSION } from '../env/data.js';
import transitionalDefaults from '../defaults/transitional.js';
import AxiosError from '../core/AxiosError.js';
import CanceledError from '../cancel/CanceledError.js';
import platform from '../platform/index.js';
import fromDataURI from '../helpers/fromDataURI.js';
import stream from 'stream';
import AxiosHeaders from '../core/AxiosHeaders.js';
import AxiosTransformStream from '../helpers/AxiosTransformStream.js';
import { EventEmitter } from 'events';
import formDataToStream from "../helpers/formDataToStream.js";
import readBlob from "../helpers/readBlob.js";
import ZlibHeaderTransformStream from '../helpers/ZlibHeaderTransformStream.js';
import callbackify from "../helpers/callbackify.js";

// zlib压缩配置
const zlibOptions = {
  flush: zlib.constants.Z_SYNC_FLUSH, // 调用flush时的刷新模式
  finishFlush: zlib.constants.Z_SYNC_FLUSH // 结束压缩或解压缩流时使用的刷新模式
};

// brotli压缩配置
const brotliOptions = {
  flush: zlib.constants.BROTLI_OPERATION_FLUSH,
  finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH
}

// 是否支持brotli压缩
const isBrotliSupported = utils.isFunction(zlib.createBrotliDecompress);

const { http: httpFollow, https: httpsFollow } = followRedirects;

const isHttps = /https:?/; // https匹配的正则

// 支持的协议类型
const supportedProtocols = platform.protocols.map(protocol => {
  return protocol + ':';
});

/**
 * If the proxy or config beforeRedirects functions are defined, call them with the options
 * object.
 *
 * @param {Object<string, any>} options - The options object that was passed to the request.
 *
 * @returns {Object<string, any>}
 */
function dispatchBeforeRedirect(options, responseDetails) {
  if (options.beforeRedirects.proxy) {
    options.beforeRedirects.proxy(options);
  }
  if (options.beforeRedirects.config) {
    options.beforeRedirects.config(options, responseDetails);
  }
}

/**
 * If the proxy or config afterRedirects functions are defined, call them with the options
 *
 * @param {http.ClientRequestArgs} options 请求配置
 * @param {AxiosProxyConfig} configProxy configuration from Axios options object 配置对象中的代理配置
 * @param {string} location 目标URL
 *
 * @returns {http.ClientRequestArgs}
 */
function setProxy(options, configProxy, location) {
  // 尝试先从configProxy中获取代理配置
  // 获取不到则根据location从env配置或环境变量中解析
  let proxy = configProxy;
  if (!proxy && proxy !== false) {
    const proxyUrl = getProxyForUrl(location);
    if (proxyUrl) { // 解析到了转成URL对象
      proxy = new URL(proxyUrl);
    }
  }
  // 设置代理信息
  if (proxy) {
    // Basic proxy authorization
    // 设置身份认证
    if (proxy.username) {
      proxy.auth = (proxy.username || '') + ':' + (proxy.password || '');
    }


    if (proxy.auth) {
      // Support proxy auth object form
      // 对象形式
      // 如果代理的授权对象包含用户名和密码
      if (proxy.auth.username || proxy.auth.password) {
        proxy.auth = (proxy.auth.username || '') + ':' + (proxy.auth.password || '');
      }
      const base64 = Buffer
        .from(proxy.auth, 'utf8')
        .toString('base64');
      options.headers['Proxy-Authorization'] = 'Basic ' + base64;
    }

    options.headers.host = options.hostname + (options.port ? ':' + options.port : ''); // host请求头
    // 更新host和hostname为代理主机名
    const proxyHost = proxy.hostname || proxy.host;
    options.hostname = proxyHost;
    // Replace 'host' since options is not a URL object
    options.host = proxyHost;
    options.port = proxy.port; // 设置代理端口
    options.path = location; // 设置目标路径
    if (proxy.protocol) { // 根据代理协议更新请求协议
      options.protocol = proxy.protocol.includes(':') ? proxy.protocol : `${proxy.protocol}:`;
    }
  }

  // 重定向时保留代理设置
  options.beforeRedirects.proxy = function beforeRedirect(redirectOptions) {
    // Configure proxy for redirected request, passing the original config proxy to apply
    // the exact same logic as if the redirected request was performed by axios directly.
    setProxy(redirectOptions, configProxy, redirectOptions.href);
  };
}
// 是否支持http适配器，确保在node环境下
const isHttpAdapterSupported = typeof process !== 'undefined' && utils.kindOf(process) === 'process';

// temporary hotfix

// 包装一个异步执行函数，返回一个promise
// 该promise可以接收一个回调函数，在Promise被解决或者拒绝时执行该回调
const wrapAsync = (asyncExecutor) => {
  return new Promise((resolve, reject) => {
    let onDone;
    let isDone;

    // 将isDone标记为true并执行onDone回调
    const done = (value, isRejected) => {
      if (isDone) return;
      isDone = true;
      onDone && onDone(value, isRejected);
    }

    const _resolve = (value) => {
      done(value);
      resolve(value);
    };

    const _reject = (reason) => {
      done(reason, true);
      reject(reason);
    }

    asyncExecutor(_resolve, _reject, (onDoneHandler) => (onDone = onDoneHandler)).catch(_reject);
  })
};
// 处理和返回一个包含地址和地址族（IPv4或IPv6）的对象
const resolveFamily = ({ address, family }) => {
  if (!utils.isString(address)) { // 地址不是字符串就报错
    throw TypeError('address must be a string');
  }
  // 返回地址和地址族信息对象
  return ({
    address, // 地址
    // 如果传入了family则使用family，否则通过判断地址是否包含'.'来判断是否为IPv4地址，不包含则认为是IPv6地址
    family: family || (address.indexOf('.') < 0 ? 6 : 4)
  });
}

// 构建地址信息对象
const buildAddressEntry = (address, family) => resolveFamily(utils.isObject(address) ? address : { address, family });

/*eslint consistent-return:0*/
export default isHttpAdapterSupported && function httpAdapter(config) {
  return wrapAsync(async function dispatchHttpRequest(resolve, reject, onDone) {
    let { data, lookup, family } = config; // 数据，dns查询函数，dns查询地址
    const { responseType, responseEncoding } = config; // 响应类型，响应编码
    const method = config.method.toUpperCase(); // 请求方法
    let isDone;
    let rejected = false;
    let req;

    // 定义了lookup函数
    if (lookup) {
      // 如果是async函数则转为callback形式
      const _lookup = callbackify(lookup, (value) => utils.isArray(value) ? value : [value]);
      // hotfix to support opt.all option which is required for node 20.x
      // 定义一个新的lookup函数
      // 兼容Node20.x中opt.all选项的新特性：https://nodejs.org/api/dns.html#dns_dns_lookup_hostname_options_callback
      // 要查找的主机名，opt选项（含all），回调函数（会在查找完成后执行）
      lookup = (hostname, opt, cb) => {
        _lookup(hostname, opt, (err, arg0, arg1) => {
          if (err) { // 查找错误
            return cb(err);
          }

          // 构建地址信息对象，将每一个地址转为{address, family }信息对象
          const addresses = utils.isArray(arg0) ? arg0.map(addr => buildAddressEntry(addr)) : [buildAddressEntry(arg0, arg1)];

          // 如果all为true，则将所有的传入cb
          // 否则将第一个地址传入cb
          opt.all ? cb(err, addresses) : cb(err, addresses[0].address, addresses[0].family);
        });
      }
    }

    // temporary internal emitter until the AxiosRequest class will be implemented
    // 事件触发器
    const emitter = new EventEmitter();

    const onFinished = () => {
      if (config.cancelToken) { // 移除取消订阅
        config.cancelToken.unsubscribe(abort);
      }

      if (config.signal) { // 移除abort监听
        config.signal.removeEventListener('abort', abort);
      }

      // 移除所有事件
      emitter.removeAllListeners();
    }

    // 添加onDone回调
    onDone((value, isRejected) => {
      isDone = true;
      // 拒绝时取消所有订阅和事件监听
      if (isRejected) {
        rejected = true;
        onFinished();
      }
    });

    function abort(reason) {
      emitter.emit('abort', !reason || reason.type ? new CanceledError(null, config, req) : reason);
    }

    // 添加abort监听
    emitter.once('abort', reject);

    // 取消订阅
    if (config.cancelToken || config.signal) {
      config.cancelToken && config.cancelToken.subscribe(abort);
      if (config.signal) { // 已中断则立即触发abort，否则添加监听
        config.signal.aborted ? abort() : config.signal.addEventListener('abort', abort);
      }
    }

    // Parse url
    // 解析url
    const fullPath = buildFullPath(config.baseURL, config.url);
    const parsed = new URL(fullPath, 'http://localhost');
    const protocol = parsed.protocol || supportedProtocols[0]; // 协议，默认是http:

    // 如果是data:协议的请求，则在get请求时返回解析后的结果
    // 否则响应不支持的请求方法
    if (protocol === 'data:') {
      let convertedData;

      // 如果不是get请求则提示请求的方法不被允许
      if (method !== 'GET') {
        return settle(resolve, reject, {
          status: 405,
          statusText: 'method not allowed',
          headers: {},
          config
        });
      }

      try { // 尝试将dataURI转换为blob
        convertedData = fromDataURI(config.url, responseType === 'blob', {
          Blob: config.env && config.env.Blob
        });
      } catch (err) { // 解析失败
        throw AxiosError.from(err, AxiosError.ERR_BAD_REQUEST, config);
      }

      // 响应类型为text类型
      if (responseType === 'text') {
        convertedData = convertedData.toString(responseEncoding); // 转换为字符串

        // 没有指定编码或者编码为utf8，则移除BOM头
        if (!responseEncoding || responseEncoding === 'utf8') {
          convertedData = utils.stripBOM(convertedData);
        }
      } else if (responseType === 'stream') {
        //如果响应类型是stream类型， 则转换为可读流
        convertedData = stream.Readable.from(convertedData);
      }

      // 直接响应结果
      return settle(resolve, reject, {
        data: convertedData,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config
      });
    }

    // 不支持的请求协议
    if (supportedProtocols.indexOf(protocol) === -1) {
      return reject(new AxiosError(
        'Unsupported protocol ' + protocol,
        AxiosError.ERR_BAD_REQUEST,
        config
      ));
    }

    // 规范化请求头
    const headers = AxiosHeaders.from(config.headers).normalize();

    // Set User-Agent (required by some servers)
    // See https://github.com/axios/axios/issues/69
    // User-Agent is specified; handle case where no UA header is desired
    // Only set header if it hasn't been set in config
    // 设置User-Agent请求头，该请求头只有在header中本身没有User-Agent时才会被设置
    // 这是为了解决某些服务器要求请求头中需要包含User-Agent的问题
    headers.set('User-Agent', 'axios/' + VERSION, false);

    const onDownloadProgress = config.onDownloadProgress; // 下载进度回调
    const onUploadProgress = config.onUploadProgress; // 上传进度回调
    const maxRate = config.maxRate; // 限速
    let maxUploadRate = undefined; // 上传限速
    let maxDownloadRate = undefined; // 下载限速

    // support for spec compliant FormData objects
    if (utils.isSpecCompliantForm(data)) { // 符合规范的form-data数据
      // 从content-type头部中提取boundary分隔符
      const userBoundary = headers.getContentType(/boundary=([-_\w\d]{10,70})/i);

      // 将表单转为可流式传输的数据
      data = formDataToStream(data, (formHeaders) => {
        headers.set(formHeaders); // 设置content-type和content-length头
      }, {
        tag: `axios-${VERSION}-boundary`,
        boundary: userBoundary && userBoundary[1] || undefined // 使用boundary提取值
      });
      // support for https://www.npmjs.com/package/form-data api
    } else if (utils.isFormData(data) && utils.isFunction(data.getHeaders)) { // FormData实例
      headers.set(data.getHeaders()); // 设置头部

      // 没有content-length头部则尝试设置content-length
      if (!headers.hasContentLength()) {
        try {
          const knownLength = await util.promisify(data.getLength).call(data); // 尝试调用getLength方法
          Number.isFinite(knownLength) && knownLength >= 0 && headers.setContentLength(knownLength); // 有则设置
          /*eslint no-empty:0*/
        } catch (e) {
        }
      }
    } else if (utils.isBlob(data)) { // 如果data是Blob实例
      data.size && headers.setContentType(data.type || 'application/octet-stream'); // 设置content-type
      headers.setContentLength(data.size || 0); // 设置content-length
      data = stream.Readable.from(readBlob(data)); // 转为可读流
    } else if (data && !utils.isStream(data)) { // data不是stream类型
      if (Buffer.isBuffer(data)) { // 是buffer不做处理
        // Nothing to do...
      } else if (utils.isArrayBuffer(data)) { // 是arraybuffer则转为buffer
        data = Buffer.from(new Uint8Array(data));
      } else if (utils.isString(data)) { // 是字符串则转为buffer
        data = Buffer.from(data, 'utf-8');
      } else { // 不是上述类型则响应错误
        return reject(new AxiosError(
          'Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream',
          AxiosError.ERR_BAD_REQUEST,
          config
        ));
      }

      // Add Content-Length header if data exists
      headers.setContentLength(data.length, false);

      if (config.maxBodyLength > -1 && data.length > config.maxBodyLength) {
        return reject(new AxiosError(
          'Request body larger than maxBodyLength limit',
          AxiosError.ERR_BAD_REQUEST,
          config
        ));
      }
    }

    const contentLength = utils.toFiniteNumber(headers.getContentLength()); // 获取content-length

    // 设置上传下载的速度限制
    if (utils.isArray(maxRate)) {
      maxUploadRate = maxRate[0];
      maxDownloadRate = maxRate[1];
    } else {
      maxUploadRate = maxDownloadRate = maxRate;
    }

    if (data && (onUploadProgress || maxUploadRate)) {
      if (!utils.isStream(data)) { // 确保数据为可读流
        data = stream.Readable.from(data, { objectMode: false });
      }

      // 创建管道流
      data = stream.pipeline([data, new AxiosTransformStream({
        length: contentLength,
        maxRate: utils.toFiniteNumber(maxUploadRate)
      })], utils.noop);

      // 监听上传进度
      onUploadProgress && data.on('progress', progress => {
        onUploadProgress(Object.assign(progress, {
          upload: true
        }));
      });
    }

    // HTTP basic authentication
    // 身份验证
    let auth = undefined;
    if (config.auth) {
      const username = config.auth.username || '';
      const password = config.auth.password || '';
      auth = username + ':' + password;
    }

    // 没有认证信息则从url中解析
    if (!auth && parsed.username) {
      const urlUsername = parsed.username;
      const urlPassword = parsed.password;
      auth = urlUsername + ':' + urlPassword;
    }

    auth && headers.delete('authorization'); // 有认证信息，则删除authorization头

    let path;

    // 尝试创建带参数的url
    try {
      path = buildURL(
        parsed.pathname + parsed.search,
        config.params,
        config.paramsSerializer
      ).replace(/^\?/, '');
    } catch (err) {
      const customErr = new Error(err.message);
      customErr.config = config;
      customErr.url = config.url;
      customErr.exists = true;
      return reject(customErr);
    }

    // 添加Accept-Encoding头
    headers.set(
      'Accept-Encoding',
      'gzip, compress, deflate' + (isBrotliSupported ? ', br' : ''), false
    );

    // 请求配置
    const options = {
      path,
      method: method,
      headers: headers.toJSON(),
      agents: { http: config.httpAgent, https: config.httpsAgent }, // 请求代理对象
      auth,
      protocol,
      family,
      beforeRedirect: dispatchBeforeRedirect, // 重定向前的处理函数
      beforeRedirects: {} // 用于存储重定向信息的对象
    };

    // cacheable-lookup integration hotfix 添加DNS查找函数
    !utils.isUndefined(lookup) && (options.lookup = lookup);

    if (config.socketPath) {
      options.socketPath = config.socketPath;
    } else {
      options.hostname = parsed.hostname;
      options.port = parsed.port;
      // 设置请求代理
      setProxy(options, config.proxy, protocol + '//' + parsed.hostname + (parsed.port ? ':' + parsed.port : '') + options.path);
    }

    let transport;
    const isHttpsRequest = isHttps.test(options.protocol); // 是否是https请求
    options.agent = isHttpsRequest ? config.httpsAgent : config.httpAgent; // 设置代理
    if (config.transport) { //如果指定了transform，则使用自定义的transport
      transport = config.transport;
    } else if (config.maxRedirects === 0) { // 如果无需处理重定向，则直接使用http或https模块
      transport = isHttpsRequest ? https : http;
    } else { // 需要处理重定向
      if (config.maxRedirects) { // 设置最大重定向次数
        options.maxRedirects = config.maxRedirects;
      }
      if (config.beforeRedirect) { // 设置重定向之前的回调
        options.beforeRedirects.config = config.beforeRedirect;
      }
      transport = isHttpsRequest ? httpsFollow : httpFollow; // 使用follow-redirects模块
    }

    // 设置最大的请求体大小
    if (config.maxBodyLength > -1) {
      options.maxBodyLength = config.maxBodyLength;
    } else {
      // follow-redirects does not skip comparison, so it should always succeed for axios -1 unlimited
      // follow-redirects库需要一个具体的数值来进行比较，设置成无限大，表示没有限制
      options.maxBodyLength = Infinity;
    }

    // 是否启用非安全的http解析器
    if (config.insecureHTTPParser) {
      options.insecureHTTPParser = config.insecureHTTPParser;
    }

    // Create the request
    // 创建请求
    req = transport.request(options, function handleResponse(res) {
      if (req.destroyed) return; // 如果请求被销毁，则不做任何处理

      const streams = [res];  // 响应流数组

      const responseLength = +res.headers['content-length']; // 响应内容长度

      // 下载进度处理
      // 如果有下载监听回调，则创建一个新的AxiosTransformStream， 用于监控下载进度，并将其添加到streams中
      if (onDownloadProgress) {
        const transformStream = new AxiosTransformStream({
          length: utils.toFiniteNumber(responseLength),
          maxRate: utils.toFiniteNumber(maxDownloadRate)
        });

        onDownloadProgress && transformStream.on('progress', progress => {
          onDownloadProgress(Object.assign(progress, {
            download: true
          }));
        });

        streams.push(transformStream);
      }

      // 解压缩处理
      // decompress the response body transparently if required
      let responseStream = res;

      // return the last request in case of redirects
      const lastRequest = res.req || req;

      // if decompress disabled we should not decompress
      // 没有禁用解压缩且content-encoding存在，则解压缩
      if (config.decompress !== false && res.headers['content-encoding']) {
        // if no content, but headers still say that it is encoded,
        // remove the header not confuse downstream operations
        // 如果没有内容，但头信息中声明了编码，则删除头信息，避免干扰下游操作
        if (method === 'HEAD' || res.statusCode === 204) {
          delete res.headers['content-encoding'];
        }

        // 根据压缩类型添加不同类型的解压缩流
        switch ((res.headers['content-encoding'] || '').toLowerCase()) {
          /*eslint default-case:0*/
          case 'gzip':
          case 'x-gzip':
          case 'compress':
          case 'x-compress':
            // add the unzipper to the body stream processing pipeline
            // 添加解压流到流数组中
            streams.push(zlib.createUnzip(zlibOptions));

            // remove the content-encoding in order to not confuse downstream operations
            //  数据已经不再是压缩的了
            delete res.headers['content-encoding'];
            break;
          case 'deflate':
            streams.push(new ZlibHeaderTransformStream());

            // add the unzipper to the body stream processing pipeline
            streams.push(zlib.createUnzip(zlibOptions));

            // remove the content-encoding in order to not confuse downstream operations
            delete res.headers['content-encoding'];
            break;
          case 'br':
            if (isBrotliSupported) {
              streams.push(zlib.createBrotliDecompress(brotliOptions));
              delete res.headers['content-encoding'];
            }
        }
      }

      // 设置响应流，如果存在多个流则连接成一个管道，否则使用单独的流
      responseStream = streams.length > 1 ? stream.pipeline(streams, utils.noop) : streams[0];

      // 流操作完成后，解除事件监听和执行回调
      const offListeners = stream.finished(responseStream, () => {
        offListeners();
        onFinished();
      });

      const response = {
        status: res.statusCode,
        statusText: res.statusMessage,
        headers: new AxiosHeaders(res.headers),
        config,
        request: lastRequest
      };

      // 根据响应类型处理响应数据，设置Promise的状态
      if (responseType === 'stream') {
        response.data = responseStream;
        settle(resolve, reject, response);
      } else {
        const responseBuffer = [];
        let totalResponseBytes = 0;

        // 每当流中有数据块产生时，将其推入缓冲区并更新总的字节数
        responseStream.on('data', function handleStreamData(chunk) {
          responseBuffer.push(chunk);
          totalResponseBytes += chunk.length;

          // make sure the content length is not over the maxContentLength if specified
          // 检查内容的长度是否超过指定的最大长度
          if (config.maxContentLength > -1 && totalResponseBytes > config.maxContentLength) {
            // stream.destroy() emit aborted event before calling reject() on Node.js v16
            rejected = true;
            responseStream.destroy();
            reject(new AxiosError('maxContentLength size of ' + config.maxContentLength + ' exceeded',
              AxiosError.ERR_BAD_RESPONSE, config, lastRequest));
          }
        });

        // 监听中断事件，还未拒绝时，创建一个错误并拒绝Promise
        responseStream.on('aborted', function handlerStreamAborted() {
          if (rejected) {
            return;
          }

          const err = new AxiosError(
            'maxContentLength size of ' + config.maxContentLength + ' exceeded',
            AxiosError.ERR_BAD_RESPONSE,
            config,
            lastRequest
          );
          responseStream.destroy(err);
          reject(err);
        });

        // 监听错误事件，如果请求被销毁，则不做任何处理，否则创建一个错误并拒绝Promise
        responseStream.on('error', function handleStreamError(err) {
          if (req.destroyed) return;
          reject(AxiosError.from(err, null, config, lastRequest));
        });

        // 监听结束事件，当流数据完全读取完毕时，合并缓冲区数据，并根据 responseType 进行适当的处理，然后解决 Promise
        responseStream.on('end', function handleStreamEnd() {
          try {
            // 合并缓冲区
            let responseData = responseBuffer.length === 1 ? responseBuffer[0] : Buffer.concat(responseBuffer);
            if (responseType !== 'arraybuffer') {
              responseData = responseData.toString(responseEncoding);
              if (!responseEncoding || responseEncoding === 'utf8') { // 移除BOM头
                responseData = utils.stripBOM(responseData);
              }
            }
            response.data = responseData;
          } catch (err) {
            return reject(AxiosError.from(err, null, config, response.request, response));
          }
          settle(resolve, reject, response);
        });
      }

      // 因为其它各种原因导致的请求被中止也要处理
      // 确保系统能够正确的关闭资源和通知上层应用
      emitter.once('abort', err => {
        if (!responseStream.destroyed) {
          responseStream.emit('error', err);
          responseStream.destroy();
        }
      });
    });

    // 其它原因中断则拒绝Promise并销毁请求
    emitter.once('abort', err => {
      reject(err);
      req.destroy(err);
    });

    // Handle errors
    // 请求过程中的错误处理
    req.on('error', function handleRequestError(err) {
      // @todo remove
      // if (req.aborted && err.code !== AxiosError.ERR_FR_TOO_MANY_REDIRECTS) return;
      reject(AxiosError.from(err, null, config, req));
    });

    // set tcp keep alive to prevent drop connection by peer
    // 设置keepAlive 选项，时间间间隔为60s
    req.on('socket', function handleRequestSocket(socket) {
      // default interval of sending ack packet is 1 minute
      socket.setKeepAlive(true, 1000 * 60);
    });

    // Handle request timeout
    // 超时处理
    if (config.timeout) {
      // This is forcing a int timeout to avoid problems if the `req` interface doesn't handle other types.
      const timeout = parseInt(config.timeout, 10); // 转为整数

      // 确保timeout是数字类型
      if (Number.isNaN(timeout)) {
        reject(new AxiosError(
          'error trying to parse `config.timeout` to int',
          AxiosError.ERR_BAD_OPTION_VALUE,
          config,
          req
        ));

        return;
      }

      // Sometime, the response will be very slow, and does not respond, the connect event will be block by event loop system.
      // And timer callback will be fired, and abort() will be invoked before connection, then get "socket hang up" and code ECONNRESET.
      // At this time, if we have a large number of request, nodejs will hang up some socket on background. and the number will up and up.
      // And then these socket which be hang up will devouring CPU little by little.
      // ClientRequest.setTimeout will be fired on the specify milliseconds, and can make sure that abort() will be fired after connect.
      // 有时候服务器的响应非常慢，甚至不响应，这种情况下，请求的connect事件可能会被事件循环系统阻塞
      // 如果超时计时器触发了，那么abort方法就会在建立连接之前调用，这时就会收到ECONNRESET错误，即"socket hang up"错误
      // 当大量的请求出现这种情况的时候，Nodejs会在后台挂起一些socket，并且数量会增加，当这些socket被挂起的时候，CPU消耗也会增加
      // 为了避免上述问题，采用req.setTimeout设置请求超时时间，确保abort在连接后触发

      req.setTimeout(timeout, function handleRequestTimeout() {
        if (isDone) return;
        let timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
        const transitional = config.transitional || transitionalDefaults;
        if (config.timeoutErrorMessage) {
          timeoutErrorMessage = config.timeoutErrorMessage;
        }
        reject(new AxiosError(
          timeoutErrorMessage,
          transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
          config,
          req
        ));
        abort();
      });
    }


    // Send the request
    // 发送请求
    // stream使用pipe，其他的使用
    if (utils.isStream(data)) {
      let ended = false;
      let errored = false;

      data.on('end', () => { // 流读取结束
        ended = true;
      });

      data.once('error', err => { // 流读取出错
        errored = true;
        req.destroy(err);
      });

      data.on('close', () => { // 流读取关闭
        if (!ended && !errored) {
          abort(new CanceledError('Request stream has been aborted', config, req));
        }
      });

      data.pipe(req); // 将数据流数据发送到请求
    } else {
      req.end(data);  // 发送请求
    }
  });
}

export const __setProxy = setProxy;
