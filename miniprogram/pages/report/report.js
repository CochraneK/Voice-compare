// pages/report/report.js
const app = getApp();

Page({
  data: {
    hasReport: false,
    summary: null
  },

  onShow() {
    const data = app.globalData.reportData;
    if (!data) {
      this.setData({ hasReport: false, reportDate: '' });
      return;
    }
    this.reportData = data;
    const now = new Date();
    const dd = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
    const tt = [String(now.getHours()).padStart(2,'0'), String(now.getMinutes()).padStart(2,'0')].join(':');
    this.setData({ hasReport: true, summary: this.buildSummary(data), reportDate: dd + ' ' + tt });
    wx.nextTick(() => this.drawCanvas());
  },

  buildSummary(data) {
    const g = (p) => (p.gender === 'female' ? '女声' : p.gender === 'male' ? '男声' : '未知');
    return {
      similarityPercent: data.similarity_percent,
      counselorGender: g(data.counselor),
      clientGender: g(data.client),
      counselorF0: data.counselor.f0_median ? Math.round(data.counselor.f0_median) : null,
      clientF0: data.client.f0_median ? Math.round(data.client.f0_median) : null,
      interpretation: data.interpretation
    };
  },

  drawCanvas() {
    wx.createSelectorQuery()
      .select('#reportCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio) || 2;
        const W = res[0].width;
        const H = res[0].height;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
        this.render(ctx, W, H, this.reportData);
      });
  },

  render(ctx, W, H, data) {
    const pad = 24;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#2b3639';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('音色比对报告', W / 2, 44);
    ctx.fillStyle = '#8b9b9f';
    ctx.font = '13px sans-serif';
    ctx.fillText('咨询师 × 来访者', W / 2, 68);

    const cardY = 92, cardH = 96, gap = 16;
    const cardW = (W - pad * 2 - gap) / 2;
    this.drawPerson(ctx, pad, cardY, cardW, cardH, '咨询师', data.counselor, '#4a7c8f');
    this.drawPerson(ctx, pad + cardW + gap, cardY, cardW, cardH, '来访者', data.client, '#7ba9ba');

    let y = cardY + cardH + 36;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#07c160';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(data.similarity_percent + '%', W / 2, y);
    ctx.fillStyle = '#8b9b9f';
    ctx.font = '14px sans-serif';
    ctx.fillText('音色相似度', W / 2, y + 24);

    y += 48;
    const barX = pad, barW = W - pad * 2, barH = 14;
    ctx.fillStyle = '#f3f7f8';
    this.roundRect(ctx, barX, y, barW, barH, 7); ctx.fill();
    ctx.fillStyle = '#4a7c8f';
    const fillW = Math.max(barH, barW * (data.similarity_percent / 100));
    this.roundRect(ctx, barX, y, fillW, barH, 7); ctx.fill();

    y += barH + 34;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2b3639'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('波形', pad, y);
    this.drawWave(ctx, pad, y + 10, barW, 38, data.counselor.waveform, '#4a7c8f');
    this.drawWave(ctx, pad, y + 58, barW, 38, data.client.waveform, '#c1d5d8');

    y += 116;
    ctx.fillStyle = '#2b3639'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('音高曲线', pad, y);
    this.drawPitch(ctx, pad, y + 10, barW, 38, data.counselor.pitch, '#4a7c8f');
    this.drawPitch(ctx, pad, y + 58, barW, 38, data.client.pitch, '#c1d5d8');

    y += 116;
    ctx.fillStyle = '#2b3639'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('分析解读', pad, y);
    ctx.fillStyle = '#444'; ctx.font = '13px sans-serif';
    this.wrapText(ctx, data.interpretation || '', pad, y + 14, barW, 20);
  },

  drawPerson(ctx, x, y, w, h, title, p, accent) {
    ctx.fillStyle = '#ffffff';
    this.roundRect(ctx, x, y, w, h, 12); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2b3639'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(title, x + 14, y + 26);
    const genderTxt = p.gender === 'female' ? '女声' : p.gender === 'male' ? '男声' : '未知';
    ctx.fillStyle = accent; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(genderTxt, x + 14, y + 54);
    ctx.fillStyle = '#8b9b9f'; ctx.font = '12px sans-serif';
    ctx.fillText(p.f0_median ? ('基频 ~' + Math.round(p.f0_median) + 'Hz') : '基频 —', x + 14, y + 74);
    ctx.fillStyle = '#c1d5d8'; ctx.font = '11px sans-serif';
    ctx.fillText('可信度 ' + Math.round((p.gender_conf || 0) * 100) + '%', x + 14, y + 90);
  },

  drawWave(ctx, x, y, w, h, arr, color) {
    if (!arr || !arr.length) return;
    const n = arr.length;
    const bw = w / n;
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const v = Math.max(0.02, Math.min(1, arr[i]));
      const bh = v * h;
      ctx.fillRect(x + i * bw, y + h - bh, Math.max(1, bw - 1), bh);
    }
  },

  drawPitch(ctx, x, y, w, h, arr, color) {
    if (!arr || !arr.length) return;
    const max = Math.max.apply(null, arr.concat([1]));
    const n = arr.length;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      const v = arr[i] || 0;
      const px = x + (i / (n - 1)) * w;
      const py = y + h - (v / max) * h;
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  wrapText(ctx, text, x, y, maxW, lh) {
    const chars = String(text).split('');
    let line = '';
    let yy = y;
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = chars[i];
        yy += lh;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  },

  saveImage() {
    wx.createSelectorQuery()
      .select('#reportCanvas')
      .fields({ node: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        wx.canvasToTempFilePath({
          canvas: res[0].node,
          success: (r) => {
            wx.saveImageToPhotosAlbum({
              filePath: r.tempFilePath,
              success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
              fail: (e) => {
                if (/auth/.test(e.errMsg)) {
                  wx.showModal({ title: '提示', content: '需要相册权限', confirmText: '去设置', success: (m) => { if (m.confirm) wx.openSetting(); } });
                } else {
                  wx.showToast({ title: '保存失败', icon: 'none' });
                }
              }
            });
          }
        });
      });
  },

  goRecord() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onShareAppMessage() {
    const pct = this.data.summary ? this.data.summary.similarityPercent : '';
    return {
      title: `音色相似度 ${pct}% · 咨询师×来访者比对报告`,
      path: '/pages/index/index'
    };
  }
});
