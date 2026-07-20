// pages/record/record.js
const app = getApp();
const { uploadStep } = require('../../services/api');

Page({
  data: {
    category: 'counselor',
    token: '',
    categoryLabel: '咨询师',
    // 状态机: idle | recording | recorded
    phase: 'idle',       // 'idle' | 'recording' | 'recorded'
    seconds: 0,
    tempFilePath: '',
    // 回听
    playing: false,
    playSeconds: 0,
    // 波形装饰条（固定 7 条，CSS 动画驱动）
    waveItems: [14,14,14,14,14,14,14],
  },

  onLoad(options) {
    const category = options.category || 'counselor';
    this.setData({
      category,
      token: options.token || '',
      categoryLabel: category === 'counselor' ? '咨询师' : '来访者',
    });

    this.rm = wx.getRecorderManager();
    this.rm.onStop(res => this.onRecordStop(res));
    this.rm.onError(err => {
      wx.showToast({ title: '录音失败', icon: 'none' });
      console.error('recorder error', err);
    });

    // 回听播放器
    this.audio = wx.createInnerAudioContext();
    this.audio.onPlay(() => this.setData({ playing: true }));
    this.audio.onPause(() => this.setData({ playing: false }));
    this.audio.onTimeUpdate(() => {
      const current = Math.floor(this.audio.currentTime);
      this.setData({ playSeconds: current });
    });
    this.audio.onEnded(() => {
      this.setData({ playing: false, playSeconds: 0 });
    });

    const agreed = wx.getStorageSync('privacy_agreed');
    if (!agreed) this.setData({ showPrivacy: true });
  },

  onAgreePrivacy() {
    wx.setStorageSync('privacy_agreed', true);
    this.setData({ showPrivacy: false });
  },

  onDeclinePrivacy() {
    wx.showModal({ title: '提示', content: '需要同意隐私说明才能使用录音比对功能', showCancel: false });
  },

  ensureRecordAuth() {
    return new Promise(resolve => {
      wx.getSetting({
        success: set => {
          if (set.authSetting['scope.record']) return resolve(true);
          wx.authorize({
            scope: 'scope.record',
            success: () => resolve(true),
            fail: () => {
              wx.showModal({
                title: '需要录音权限',
                content: '请在设置中开启录音权限后重试',
                confirmText: '去设置',
                success: r => { if (r.confirm) wx.openSetting(); }
              });
              resolve(false);
            }
          });
        },
        fail: () => resolve(false)
      });
    });
  },

  toggleRecord() {
    console.log('toggleRecord called, phase:', this.data.phase, 'uploading:', this.data.uploading);
    if (this.data.uploading) {
      console.log('uploading true, return');
      return;
    }
    if (this.data.phase === 'recording') {
      console.log('stop recording');
      this.rm.stop();
      return;
    }
    if (this.data.phase === 'recorded') {
      // 重新录制
      console.log('reset recorded to idle');
      this.audio.stop();
      this.setData({ phase: 'idle', seconds: 0, tempFilePath: '', playing: false, playSeconds: 0 });
      return;
    }
    // idle → 开始
    console.log('starting ensureRecordAuth');
    this.ensureRecordAuth().then(ok => {
      console.log('ensureRecordAuth result:', ok);
      if (!ok) {
        console.log('auth failed');
        wx.showToast({ title: '请先授权录音权限', icon: 'none' });
        return;
      }
      this.setData({ phase: 'recording', seconds: 0, tempFilePath: '' });
      this.timer = setInterval(() => {
        const s = this.data.seconds + 1;
        if (s >= 60) { this.rm.stop(); return; }
        this.setData({ seconds: s });
      }, 1000);
      this.rm.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        format: 'wav'
      }).then(() => {
        console.log('recorder start success');
      }).catch(err => {
        console.error('recorder start error:', err);
        wx.showToast({ title: '录音启动失败', icon: 'none' });
        this.setData({ phase: 'idle' });
      });
    });
  },

  onRecordStop(res) {
    if (this.timer) clearInterval(this.timer);
    this.setData({
      phase: 'recorded',
      tempFilePath: res.tempFilePath,
      seconds: this.data.seconds
    });
    // 预加载音频
    this.audio.src = res.tempFilePath;
  },

  togglePlay() {
    if (!this.audio.src) return;
    if (this.data.playing) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
  },

  resetRecord() {
    this.audio.stop();
    if (this.timer) clearInterval(this.timer);
    this.setData({ phase: 'idle', seconds: 0, tempFilePath: '', playing: false, playSeconds: 0 });
  },

  async onUpload() {
    if (!this.data.tempFilePath || this.data.uploading) return;
    this.setData({ uploading: true });
    wx.showLoading({ title: '分析中…' });
    try {
      const res = await uploadStep(this.data.tempFilePath, this.data.category, this.data.token);
      wx.hideLoading();
      this.setData({ uploading: false });
      // 防御：res 不符合预期时给出友好提示
      if (!res || typeof res !== 'object') {
        wx.showToast({ title: '服务器返回异常，请重试', icon: 'none' });
        return;
      }
      if (this.data.category === 'counselor') {
        if (!app.globalData) app.globalData = {};
        app.globalData.sessionToken = res.token || '';
        app.globalData.counselorDone = true;
        wx.showToast({ title: '咨询师音色已采集', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 900);
      } else {
        if (!app.globalData) app.globalData = {};
        app.globalData.reportData = res;
        wx.switchTab({ url: '/pages/report/report' });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ uploading: false });
      const msg = err && err.message ? err.message : '分析失败，请检查网络';
      wx.showToast({ title: msg, icon: 'none' });
    }
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
    this.audio.stop();
  }
});