// pages/index/index.js
const app = getApp();

Page({
  data: {
    counselorDone: false
  },

  onShow() {
    this.setData({ counselorDone: app.globalData.counselorDone });
  },

  goRecord(e) {
    const category = e.currentTarget.dataset.cat;
    if (category === 'client' && !app.globalData.counselorDone) {
      wx.showToast({ title: '请先完成咨询师录制', icon: 'none' });
      return;
    }
    const token = category === 'client' ? app.globalData.sessionToken : '';
    wx.navigateTo({ url: `/pages/record/record?category=${category}&token=${token}` });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/subpackages/more/privacy/privacy' });
  },

  goAbout() {
    wx.navigateTo({ url: '/subpackages/more/about/about' });
  }
});