# Axios 1.7.2源码解读

## Axios导出

Axios导出的内容列表如下：

  + `axios`：默认导出，是一个**Axios实例**
  + `Axios`：Axios类
  + `AxiosError`：Axios错误类，用于创建Axios相关的错误对象
  + `CanceledError`：请求取消错误类
  + `isCancel`：用于判断某个对象是否是一个`CanceledError`实例
  + `CancelToken`：用于创建取消令牌的类
  + `VERSION`：版本号
  + `all`：用于发起多个axios并发请求
  + `Cancel`：`CanceledError`的别名，用于兼容
  + `isAxiosError`：用于判断某个对象是否是一个`AxiosError`（具有`isAxiosError:true`）
  + `spread`：`Function.prototype.apply`的语法糖
  + `toFormData`：将一个对象转化为`FormData`
  + `AxiosHeaders`：用于管理请求头的类
  + `HttpStatusCode`：HTTP状态码列表
  + `formToJSON`：将`FormData`转为`Json`格式
  + `getAdapter`：获取有效的适配器的函数
  + `mergeConfig`：用于合并两个**axios配置**的方法

默认导出的`axios`是由内部的`createInstance`函数调用创建的实例，实例上有一个`create`方法指向`createInstance`函数，可以用于创建自定义的axios实例。其余的导出都是实例上的方法。之所以导出一个`axios`的实例而不是直接导出`Axios`类作为默认导出，是为了使用的方便。一个原始的使用例子如下：

```js
const axios = new Axios()
axios.request(url, config)
```
使用默认导出的`axios`实例，则可以这样使用

```js
axios.get(url, config)
```

`createInstance(defaultConfig)`函数的基本逻辑如下：

```js
function createInstance(defaultConfig) {
  const context = new Axios(defaultConfig); // 创建Axios实例
  const instance = bind(Axios.prototype.request, context); // 创建request的绑定函数

  //  将Axios.prototype上的属性拷贝到instance上
  utils.extend(instance, Axios.prototype, context, { allOwnKeys: true });
  // 将Axios实例上的属性拷贝到instance上
  utils.extend(instance, context, null, { allOwnKeys: true });

  // 添加create方法，用于创建新的axios实例
  instance.create = function create(instanceConfig) {
    // 合并配置并创建实例
    return createInstance(mergeConfig(defaultConfig, instanceConfig));
  };

  return instance;
}
```

导出逻辑：

```js
const axios = createInstance(defaults);
axios.Axios = Axios;// 在实力上暴露Axios类
// 接下来在axios上添加其它需要导出的属性和方法
// ...

axios.default = axios;
export default axios
```

可见导出的axios对象实际上`Axios.prototype.request`方法的绑定方法，该方法还拷贝了`Axios.prototype`以及`Axios实例`上的所有属性和方法，同时添加了其它需要导出的类和方法，如`AxiosError`，`CancelToken`等。

## axios调用

```js
axios.post('/user', {
  firstName: 'Fred',
  lastName: 'Flintstone'
}, {
  headers: {
    'Content-Type': 'application/json'
  },
  transformRequest: [
    function(data, headers) {}
  ],
  transformResponse: [
    function(data) {}
  ],
  adapter: function(config) {
    return ['xhr']
  },
  //...

})
.then(function (response) {
  console.log(response);
})
.catch(function (error) {
  console.log(error);
});
```
当我们按照类似如上方法调用`axios`发起一个请求时，axios内部做了以下的事情：

+ 参数统一，`Axios.prototype.request`既可以接收一个**url+config**，也可以只接收一个**包含url属性的config**
+ 合并选项：合并默认的选项以及传入的选项
+ 获取请求方法等属性
+ 解析请求头，生成最终用于创建发起请求的头部信息
+ 初始化一个请求拦截器的链（数组）
+ 设置请求拦截器，将所有请求拦截器逐个压入拦截器链的头部（倒序）
+ 初始化一个响应拦截器的链（数组）
+ 设置响应拦截器，将所有的响应拦截器逐个压入拦截器链的尾部
+ 如果存在异步的请求拦截器
  + 初始化一个请求链，并将`dispatchRequest`（用于发起请求的方法）压入链
  + 将请求拦截器放到该链的前面，将响应拦截器放到该链的后面，这样就形成了一条：**请求拦截器->请求->响应拦截器**的链
  + 使用`Promise.resolve(config)`创建一个初始的`promise`
  + 遍历整个链，逐个调用`promise`的`then`方法，这样就形成了一条完整的promise链式调用
  + 返回最终的`promise`
+ 如果不存在异步的请求拦截器
  + 创建一个新的配置对象`newConfig`
  + 遍历请求拦截器，将其结果不断赋值给`newConfig`
  + 这个过程如果有发生错误则会抛出错误停止执行
  + 使用`newConfig`这个新的配置调用`dispatchRequest`函数发起请求，其返回值为一个`promise`
  + 遍历响应拦截器，调用`promise`的then方法，形成一条新的promise链
  + 返回`promise`

## `dispatchRequest(config)`函数

`dispatchRequest`函数是整个请求处理链条的核心，也是实际发起请求的地方。`dispatchRequest`函数接收一个`config`配置对象，返回一个`promise`，其调用后执行的过程如下：

+ 检查请求是否已经取消（使用`CancelToken`或者`new AbortController().signal`），如果已经取消了，则会抛出中断的错误
+ 实例化请求头为**AxiosHeader实例**
+ 遍历请求转换器，传入相关配置调用请求转换器，生成转换后的请求数据
+ 规范化请求头
+ 根据配置获取请求适配器，目前支持`['xhr', 'http', 'fetch']`，也可以自定义适配器
+ 使用获取到的适配器发起请求
+ 请求成功
  + 判断请求是否已经取消了，如果取消了，则会抛出中断错误
  + 调用响应转换器，转换并生成最终响应的数据
  + 响应头转为`AxiosHeaders`实例
  + 返回响应结果
+ 请求失败，接收失败对象`reason`
  + 如果`reason`不是`CancelError`
    + 判断请求是否已经取消了，如果取消了，则会抛出中断错误
    + 如果有错误中包含`reason.response`属性（有响应，但是状态码超过了定义的成功范围），则调用响应转换器，转换并生成最终响应的数据，并将响应头转为`AxiosHeaders`实例
  + 返回一个拒绝的`Promise`

## 总结

Axios的核心其实是非常简单的，它接收配置后生成一个用于请求和处理请求数据、响应数据的链条，在发起请求成功或者失败后，将结果返回。Axios源码中比较复杂的部分是每一个适配器内部的参数处理，包括参数的序列化、规范化、流的处理等逻辑。尤其是`FormData`和`Stream`的处理。这部分的内容比较繁杂，详情查看源码注释。

另外，**Axios**新增的`fetch`适配器是有bug的，目前发现了一个处理跨域携带凭证信息时，处理`withCredentials`配置的bug。在fetch适配器中有如下代码：

```js
// lib/adapters/fetch.js

if (!utils.isString(withCredentials)) {
  withCredentials = withCredentials ? 'cors' : 'omit';
}

request = new Request(url, {
  ...fetchOptions,
  signal: composedSignal,
  method: method.toUpperCase(),
  headers: headers.normalize().toJSON(),
  body: data, 
  duplex: "half",
  withCredentials
});
```

实际上，`Request`构造器是不支持`withCredentials`配置的，正确的配置是`credentials`，其有效值为`omit`、`same-origin`和`include`，并不包含`cors`。所以现有的现有适配器实现会导致跨域访问时无法设置携带Cookie。如下代码，`withCredentials`设置成`true`后，携带的Cookie仍然会是个空的对象。

```js
axios.get('http://localhost:3000', {
  withCredentials: true,
  adapter: ['fetch']
})
.then(response => console.log(response.data))
  .catch(error => console.error('Error:', error));
```

修复这个bug只需要将源码修改如下：

```js
if (!utils.isString(withCredentials)) {
  withCredentials = withCredentials ? 'include' : 'omit';
}

request = new Request(url, {
  ...fetchOptions,
  signal: composedSignal,
  method: method.toUpperCase(),
  headers: headers.normalize().toJSON(),
  body: data, 
  duplex: "half",
  credentials: withCredentials
});

```

我已经给axios提了issue：[Fix fetch request config#6505](https://github.com/axios/axios/pull/6505)