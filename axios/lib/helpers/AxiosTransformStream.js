'use strict';

import stream from 'stream';
import utils from '../utils.js';
import throttle from './throttle.js';
import speedometer from './speedometer.js';

const kInternals = Symbol('internals'); // 用于存储内部状态的唯一标识符

// 自定义的Transform流，用于处理数据的上传速率控制和报告
class AxiosTransformStream extends stream.Transform {
  constructor(options) {
    // 合并配置项和默认配置项
    options = utils.toFlatObject(options, {
      maxRate: 0, // 最大传输速率（字节/秒）
      chunkSize: 64 * 1024, // 每个数据块的大小
      minChunkSize: 100, // 最小数据块的大小
      timeWindow: 500, // 时间窗口（ms）
      ticksRate: 2, // 更新进度的频率（每秒更新次数）
      samplesCount: 15 // 用于速度测量的样本数量
    }, null, (prop, source) => {
      return !utils.isUndefined(source[prop]);
    });

    // 调用stream.Transform构造函数
    super({
      readableHighWaterMark: options.chunkSize
    });

    const self = this;

    // 内部的初始状态的存储
    const internals = this[kInternals] = {
      length: options.length,
      timeWindow: options.timeWindow,
      ticksRate: options.ticksRate,
      chunkSize: options.chunkSize,
      maxRate: options.maxRate,
      minChunkSize: options.minChunkSize,
      bytesSeen: 0,
      isCaptured: false,
      notifiedBytesLoaded: 0,
      ts: Date.now(),
      bytes: 0,
      onReadCallback: null
    };

    // 速度计算器
    const _speedometer = speedometer(internals.ticksRate * options.samplesCount, internals.timeWindow);

    // 监听新的监听器事件，如果事件为'progress'，则标记内部状态为需要捕获进度更新
    this.on('newListener', event => {
      if (event === 'progress') {
        if (!internals.isCaptured) {
          internals.isCaptured = true;
        }
      }
    });

    let bytesNotified = 0;

    // 定义一个更新进度的节流函数
    internals.updateProgress = throttle(function throttledHandler() {
      const totalBytes = internals.length; // 总的字节数
      const bytesTransferred = internals.bytesSeen; // 已传输的字节数
      const progressBytes = bytesTransferred - bytesNotified; // 本次增加的字节数
      if (!progressBytes || self.destroyed) return; // 已销毁或没有进度

      const rate = _speedometer(progressBytes); // 传输速度

      bytesNotified = bytesTransferred;

      process.nextTick(() => {
        self.emit('progress', {
          loaded: bytesTransferred, // 已传输的字节数
          total: totalBytes, // 总的字节数
          progress: totalBytes ? (bytesTransferred / totalBytes) : undefined, // 已完成进度
          bytes: progressBytes, // 本次传输的字节数
          rate: rate ? rate : undefined, // 传输速度
          estimated: rate && totalBytes && bytesTransferred <= totalBytes ?
            (totalBytes - bytesTransferred) / rate : undefined, // 预估剩余的传输时间
          lengthComputable: totalBytes != null  // 是否可以计算总长度
        });
      });
    }, internals.ticksRate);

    const onFinish = () => {
      internals.updateProgress.call(true);
    };

    this.once('end', onFinish); // 处理完成
    this.once('error', onFinish); // 处理错误
  }

  // 重写流读取的方法
  _read(size) {
    const internals = this[kInternals];

    // 如果存在读取回调就执行
    if (internals.onReadCallback) {
      internals.onReadCallback();
    }

    // 调用父类的_read方法
    return super._read(size);
  }

  // 数据转换方法
  _transform(chunk, encoding, callback) {
    const self = this;
    const internals = this[kInternals];
    const maxRate = internals.maxRate; // 每秒最大的传输字节数

    const readableHighWaterMark = this.readableHighWaterMark;

    const timeWindow = internals.timeWindow; // 时间窗口的大小（ms）

    const divider = 1000 / timeWindow; // 每秒有多少个时间窗口
    const bytesThreshold = (maxRate / divider); // 每一个时间窗口允许传输的最大字节数
    // 最小数据块大小，取minChunkSize和bytesThreshold * 0.01中的较大者
    // 确保数据块最小值为一个合理的值，数据块大小可能会增加调用函数和上下文切换的频率，降低整体传输效率
    // 同时每一个小的数据块也会有固定的开销，如定时器、回调等，数据块太小会导致资源浪费
    const minChunkSize = internals.minChunkSize !== false ? Math.max(internals.minChunkSize, bytesThreshold * 0.01) : 0;

    // 将数据块推送到流中
    function pushChunk(_chunk, _callback) {
      const bytes = Buffer.byteLength(_chunk); // 推送的字节数
      internals.bytesSeen += bytes; // 已处理的总字节数
      internals.bytes += bytes; // 当前时间窗口内已传输的字节数

      // 如果需要捕获进度，则更新进度
      if (internals.isCaptured) {
        internals.updateProgress();
      }

      // 尝试推送数据块，如果推送成功则立即调用回调函数
      if (self.push(_chunk)) {
        process.nextTick(_callback);
      } else {// 如果推送失败，则设置回调函数，当可以继续推送时再调用回调
        internals.onReadCallback = () => {// 在_read被调用时会执行
          internals.onReadCallback = null; //清除回调的引用
          process.nextTick(_callback);
        };
      }
    }

    // 根据设定的速率转换数据块
    const transformChunk = (_chunk, _callback) => {
      const chunkSize = Buffer.byteLength(_chunk); // 当前数据块的大小
      let chunkRemainder = null; // 分割后剩余的数据块
      let maxChunkSize = readableHighWaterMark; // 最大的数据块大小
      let bytesLeft; // 当前时间窗口内剩余可传输字节数额度，根据速率限制计算
      let passed = 0; // 当前时间窗口已经过去的时间

      if (maxRate) { // 设置了最大速率
        const now = Date.now();

        // internals.ts是当前时间窗口的开始时间，是上次记录的时间戳
        // 如果是第一次或者当前时间与上次记录的时间差超过了时间窗口，则重置计数器并更新时间戳
        if (!internals.ts || (passed = (now - internals.ts)) >= timeWindow) {
          internals.ts = now; // 更新时间戳
          bytesLeft = bytesThreshold - internals.bytes; // 当前时间窗口剩余的字节数
          // 前一个时间窗口内传输的字节数已经超出了bytesThreshold，则将超出部分计入到新的时间窗口
          // 意味着新的时间窗口开始时，已经预先消耗了一部分的传输额度
          // 这种情况发生在数据传输速率不均匀或各种因素导致瞬间传输量大于预期时
          internals.bytes = bytesLeft < 0 ? -bytesLeft : 0;
          passed = 0; // 重置已过的时间
        }

        // 更新剩余可用传输的字节=每个时间窗口最大传输数-当前时间窗口已经传输的字节数
        bytesLeft = bytesThreshold - internals.bytes;
      }

      //设置了最大速率
      if (maxRate) {
        if (bytesLeft <= 0) {
          // next time window
          // 当前时间窗口还未结束，到那时已经没有传输的额度了
          // 将_callback推迟到下一个时间窗口后执行，推迟的时间为剩余的时间窗口值
          return setTimeout(() => {
            _callback(null, _chunk);
          }, timeWindow - passed);
        }

        // 调整最大数据块大小，确保在当前时间窗口内不会超过剩余的可出传输字节数，避免超出设定的最大速率
        if (bytesLeft < maxChunkSize) {
          maxChunkSize = bytesLeft;
        }
      }

      // 检查是否需要拆分数据块
      // 当传入maxChunkSize且数据块大于它，而且拆分后剩余的数据块大于最小数据块限制则进行拆分
      if (maxChunkSize && chunkSize > maxChunkSize && (chunkSize - maxChunkSize) > minChunkSize) {
        chunkRemainder = _chunk.subarray(maxChunkSize);// 拆分后剩下数据块为maxChunkSize长度后的数据块
        _chunk = _chunk.subarray(0, maxChunkSize);// 更新_chunk为前maxChunkSize长度的数据块
      }

      // 推送数据块到可读流中
      // 如果还有剩余的数据块，则递归调用transformNextChunk处理剩余的数据块
      pushChunk(_chunk, chunkRemainder ? () => {
        process.nextTick(_callback, null, chunkRemainder);
      } : _callback);
    };

    // 处理并转换数据块
    transformChunk(chunk, function transformNextChunk(err, _chunk) {
      if (err) {// 处理错误
        return callback(err);
      }

      if (_chunk) { // 如果有剩余的chunk则递归处理
        transformChunk(_chunk, transformNextChunk);
      } else { // 所有数据处理完毕
        callback(null);
      }
    });
  }

  setLength(length) { // 设置总长度
    this[kInternals].length = +length;
    return this;
  }
}

export default AxiosTransformStream;
