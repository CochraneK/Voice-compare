// utils/request.js
// 统一网络层：wx.request（JSON） + wx.uploadFile（音频），带 baseUrl / token / 错误处理
const app = getApp();

const BASE = () => (app && app.globalData ? app.globalData.baseUrl : '');

// 普通 JSON 请求
const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = app.globalData && app.globalData.authToken;
    wx.request({
      url: BASE() + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.header || {})
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({ code: res.statusCode, message: (res.data && res.data.message) || '请求失败' });
        }
      },
      fail: (err) => reject({ code: -1, message: '网络错误', detail: err })
    });
  });
};

// 音频上传（wx.uploadFile 返回的是字符串，需解析）
const uploadFile = (options) => {
  return new Promise((resolve, reject) => {
    const token = app.globalData && app.globalData.authToken;
    wx.uploadFile({
      url: BASE() + options.url,
      filePath: options.filePath,
      name: options.name || 'audio',
      formData: options.formData || {},
      header: token ? { Authorization: 'Bearer ' + token } : {},
      success: (res) => {
        let data = res.data;
        try { data = JSON.parse(res.data); } catch (e) { /* 保持原字符串 */ }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject({ code: res.statusCode, message: (data && data.message) || '上传失败' });
        }
      },
      fail: (err) => reject({ code: -1, message: '上传失败', detail: err })
    });
  });
};

module.exports = { request, uploadFile };
