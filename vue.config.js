module.exports = {
<<<<<<< HEAD
    publicPath: '',
=======
    publicPath: '/',
>>>>>>> 2515fa6184ba14d110c18eea6e0c860ac301a97e
    devServer: {
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8081/',
                ws: true,
                changeOrigin: true,
                pathRewrite: {
                    '^/api': ''
                }
            }
        }
    }
}
