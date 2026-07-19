// services/api.js
// 两步比对流程：先传咨询师音色（拿 token），再传来访者音色（拿完整比对结果）
const { uploadFile } = require('../utils/request');

// category: 'counselor' | 'client'
// token: 第二步（client）需要带上第一步返回的 session token
const uploadStep = (filePath, category, token) => {
  return uploadFile({
    url: '/api/analyze-step',
    filePath,
    name: 'audio',
    formData: {
      category,
      token: token || ''
    }
  });
};

module.exports = { uploadStep };
