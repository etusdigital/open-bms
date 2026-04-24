module.exports = {
  devServer: {
    host: '0.0.0.0',
    port: 44357,
    public: 'localhost:44357',
    disableHostCheck: true,
    sockHost: 'localhost',
    sockPort: 44357,
  },
  // Provide postcss config inline so bootstrap.min.css (hoisted deep inside
  // node_modules/.pnpm/*) doesn't trigger postcss-load-config lookup failures.
  css: {
    loaderOptions: {
      postcss: {
        plugins: [require('autoprefixer')],
      },
    },
  },
};
