const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;

// 使用 CORS 中间件，并配置允许的设置
app.use(cors({
  origin: 'http://localhost:5000', // 替换为允许访问的前端地址
  credentials: true, // 允许携带凭证
}));

// 使用 Cookie 解析中间件
app.use(cookieParser());

// 添加一个示例路由，用于读取 Cookies
app.get('/', (req, res) => {
  // 从请求中读取 Cookies
  const cookies = req.cookies;
  console.log('Cookies:', cookies);

  // 返回一个响应，其中包括收到的 Cookies
  res.json({
    message: 'Cookies received',
    cookies: cookies,
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
