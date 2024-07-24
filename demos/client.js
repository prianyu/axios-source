import axios from "../axios/lib/axios"
// 使用原生的fetch函数发送请求
fetch('http://localhost:3000', {
  method: 'GET',
  credentials: 'include' // 确保请求中包含凭证
})
  .then(response => response.json())
  .then(data => console.log("原生fetch", data))
  .catch(error => console.error('Error:', error));

// 使用axios适配器

axios.get('http://localhost:3000', {
  withCredentials: true,
  adapter: ['fetch']
})
  .then(response => console.log("axios-fetch-adapter", response.data)) // 响应数据
  .catch(error => console.error('Error:', error));



