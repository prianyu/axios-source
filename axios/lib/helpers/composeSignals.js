import CanceledError from "../cancel/CanceledError.js";
import AxiosError from "../core/AxiosError.js";

// 组合Signal
// 创建一个新的AbortSignal，可以用于同时监听多个AbortSignal
const composeSignals = (signals, timeout) => {
  let controller = new AbortController();

  let aborted;

  // 中断回调函数
  const onabort = function (cancel) {
    if (!aborted) { // 防止重复触发
      aborted = true;
      unsubscribe(); // 清理监听器
      // 根据传入的取消原因，创建适当的错误对象，触发新的controller的abort方法
      const err = cancel instanceof Error ? cancel : this.reason;
      controller.abort(err instanceof AxiosError ? err : new CanceledError(err instanceof Error ? err.message : err));
    }
  }

  // 超时定时器，超时时触发onabort
  let timer = timeout && setTimeout(() => {
    onabort(new AxiosError(`timeout ${timeout} of ms exceeded`, AxiosError.ETIMEDOUT))
  }, timeout)

  // 清理所有的监听器和定时器
  const unsubscribe = () => {
    if (signals) {
      // 清除定时器
      timer && clearTimeout(timer);
      timer = null;
      // 清除所有的监听器
      signals.forEach(signal => {
        signal &&
          (signal.removeEventListener ? signal.removeEventListener('abort', onabort) : signal.unsubscribe(onabort));
      });
      signals = null;
    }
  }

  // 遍历信号，监听信号中断事件
  signals.forEach((signal) => signal && signal.addEventListener && signal.addEventListener('abort', onabort));

  const { signal } = controller;

  // 添加unsubscribe方法
  signal.unsubscribe = unsubscribe;

  //  返回信号和定时器取消方法
  return [signal, () => {
    timer && clearTimeout(timer);
    timer = null;
  }];
}

export default composeSignals;
