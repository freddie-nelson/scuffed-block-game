const webpack = require("webpack");

module.exports = {
  mode: "development",
  entry: {
    main: "./src/main.ts",
    "chunk-generator": "./src/ChunkGeneratorWorker.ts",
    "geometry-generator": "./src/GeometryGeneratorWorker.ts",
  },
  output: {
    filename: "./dist/js/[name].js",
    path: __dirname,
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    modules: ["node_modules"],
  },
  plugins: [
    // new webpack.optimize.CommonsChunkPlugin({
    //   name: "commons",
    //   filename: "./dist/js/common.js",
    // }),
    new webpack.BannerPlugin({
      banner: `var window = self; importScripts("./common.js");`,
      raw: true,
      entryOnly: true,
      test: ["./dist/js/chunk-generator.js", "./dist/js/geometry-generator.js"],
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: "all",
      name: () => "common",
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
};
