# 音色比对小程序 · 第一版概览

## 做了什么
一个微信小程序 + Python 后端，支持「咨询师 / 来访者」两类音色录制，生成**双人比对报告**（相似度 + 性别 + 波形/音高曲线 + 文字解读）与**个人报告**（性别、基频），报告用 Canvas 自绘、可存图分享。

- 前端：`miniprogram/`（录音页、首页、Canvas 报告页、隐私说明分包）
- 后端：`server/`（FastAPI，两步比对，内存态不落盘）

## 架构流程
```
小程序 RecorderManager(mp3)
   │  wx.uploadFile
   ▼
POST /api/analyze-step {audio, category='counselor'}
   │  服务端提取声纹向量 + 性别，返回 token（仅存内存）
   ▼
POST /api/analyze-step {audio, category='client', token}
   │  余弦相似度比对，返回完整结果后清除会话
   ▼
小程序 Canvas 绘制报告 → 保存/分享
```
**数据不留存**：服务端只把声纹向量放在内存字典里，比对完成立即 `pop` 删除，不写磁盘、不进数据库。

## 后端分析原理（低成本）
- 相似度：librosa 提 MFCC 统计量 + 谱对比度 → 固定向量 → 余弦相似度
- 性别：librosa `pyin` 提基频 F0，男声中位数 < 180Hz、女声 ≥ 180Hz
- 报告图数据：波形包络 + 音高曲线（归一化数组回传前端，Canvas 绘制）
- 若 librosa 未安装，自动回退 demo 模式（保证服务可起、契约可测）

## 如何运行
```bash
# 后端
C:/Users/cunyi/.workbuddy/binaries/python/envs/default/Scripts/python.exe -m pip install -r server/requirements.txt
C:/Users/cunyi/.workbuddy/binaries/python/envs/default/Scripts/python.exe -m uvicorn server.main:app --port 8000
# 健康检测
curl http://127.0.0.1:8000/health
```
- 小程序：`app.js` 里 `baseUrl` 改为你的 HTTPS 域名；**必须**在微信公众平台「开发管理-服务器域名」把该域名加入 `uploadFile` 与 `request` 合法域名（否则真机失败）。
- 录音格式已改为 **wav**（`pages/record/record.js`），服务端 librosa 读 wav 只需 `libsndfile`（Dockerfile 已装），**无需 ffmpeg**。
- **一键部署**：`server/Dockerfile` 已就绪，可上传到微信云托管 / 腾讯云 CNB 部署，自动获得已备案 HTTPS 域名。
- **完整部署+真机联调步骤见 [`DEPLOY.md`](./DEPLOY.md)**（含平台对比、白名单配置、开发者工具下载与真机预览）。

## 微信审核 / 隐私要点
- 声纹 = 生物识别信息（PIPL 敏感个人信息）：必须有**授权弹窗 + 隐私协议页**（已含 `subpackages/more/privacy`），并说明用途。
- 审核易拒点：无明确用途就申请录音权限、未写隐私协议、把音频外传第三方。本方案「仅本次不留存 + 不出公网」最稳。
- 主包 < 2MB：图表用 Canvas 自绘、未引组件库，报告/隐私放分包。

## 升级路径
- 精度提升：`resemblyzer` / `speechbrain` ECAPA-TDNN / `wespeaker` 替换 MFCC 向量（仍是自托管，数据不出门）。
- 历史趋势：放开「留存 embedding」需补隐私合规与授权（当前不做）。

## API 返回结构（节选）
```json
{
  "success": true, "step": "result",
  "counselor": {"gender":"female","gender_conf":0.92,"f0_median":210,"waveform":[...],"pitch":[...]},
  "client":    {"gender":"male",  "gender_conf":0.88,"f0_median":120,"waveform":[...],"pitch":[...],"similarity_percent":73},
  "similarity": 0.73, "similarity_percent": 73,
  "interpretation": "咨询师判定为女声..."
}
```
