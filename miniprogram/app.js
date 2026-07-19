// app.js - 全局配置与内存态数据
App({
  globalData: {
    // ⚠️ 替换为你的 HTTPS 域名，并在微信公众平台「开发管理-服务器域名」中
    // 将 uploadFile 合法域名、request 合法域名都加上该域名（否则真机失败）
    baseUrl: 'https://flask-txdz-284276-10-1455787640.sh.run.tcloudbase.com',

    // 两步比对的内存态（不落盘，仅本次会话）
    sessionToken: '',        // 咨询师录音后由后端返回
    counselorDone: false,
    reportData: null         // 来访者比对完成后写入，跳报告页读取
  },

  onLaunch() {
    // 可在此做环境区分（dev / prod）
  }
});
