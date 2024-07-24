const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")

module.exports = {
  entry: "./demos/client.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js"
  },
  mode: "development",
  devtool: "inline-source-map",
  devServer: {
    hot: true,
    port: 5000
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './demos/index.html'
    })
  ]
}