import speedometer from "./speedometer.js";
import throttle from "./throttle.js";

// 按照指定的频率触发上传或下载进度回调函数
export default (listener, isDownloadStream, freq = 3) => {
  let bytesNotified = 0; // 上一次通知的字节数，用于计算本次进度的差异
  const _speedometer = speedometer(50, 250); // 速度计算器

  // 返回节流后的处理函数
  // e是由fetchProgressDecorator生成的函数传入的包含loaded/lengthComputable/total属性的对象
  return throttle(e => {
    const loaded = e.loaded; // 已经加载的字节数
    const total = e.lengthComputable ? e.total : undefined; // 总字节数
    const progressBytes = loaded - bytesNotified; // 自上次通知以来加载的字节数（本次加载的字节数）
    const rate = _speedometer(progressBytes); //  计算速度
    const inRange = loaded <= total; // 是否在总字节数范围内

    bytesNotified = loaded; // 更新已通知的字节数

    const data = {
      loaded, // 已加载的字节数
      total, // 总的字节数
      progress: total ? (loaded / total) : undefined, // 进度百分比
      bytes: progressBytes, // 本次加载的字节数
      rate: rate ? rate : undefined, // 当前速度
      estimated: rate && total && inRange ? (total - loaded) / rate : undefined, // 预计剩余时间
      event: e, // 原始事件对象
      lengthComputable: total != null // 是否可以计算总长度
    };

    // 上传还是下载的标记
    data[isDownloadStream ? 'download' : 'upload'] = true;

    // 调用监听器
    listener(data);
  }, freq);
}
