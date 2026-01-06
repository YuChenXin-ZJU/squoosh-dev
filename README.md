# Squoosh-Desktop

[![中文](https://img.shields.io/badge/README-中文-blue)](#中文) [![English](https://img.shields.io/badge/README-English-blue)](#english) [![Releases](https://img.shields.io/badge/Download-Releases-brightgreen)](https://github.com/YuChenXin-ZJU/Squoosh-Desktop/releases)

## 中文

Squoosh-Desktop 是一个离线优先的图片压缩/转码桌面应用（Windows / macOS / Linux），提供压缩前后对比预览、参数调节与批量处理能力。

本项目基于 Google 的开源项目 Squoosh（二次开发与桌面化封装），用于把 Squoosh 的核心能力以桌面应用形式交付。

### 下载

从 Releases 下载最新版本：

- Windows 安装版（NSIS）：`Squoosh-Desktop.Setup.*.exe`
- Windows 免安装版（Portable）：`Squoosh-Desktop.*.exe`
- macOS（DMG）：`Squoosh-Desktop-*.dmg`
- Linux：`Squoosh-Desktop-*.AppImage` / `Squoosh-Desktop_*.deb`

### 支持的格式

输入（导入）：

- 常见格式：JPEG、PNG、GIF、BMP、TIFF、WebP（具体取决于系统/Chromium 内核支持）
- 额外解码支持：AVIF、JPEG XL（JXL）、WebP2、QOI（在系统不原生支持时会走内置解码器）

输出（导出）：

- JPEG（MozJPEG / 浏览器编码）
- PNG（OxiPNG / 浏览器编码）
- WebP
- AVIF
- JPEG XL（JXL）
- GIF（浏览器编码）
- QOI
- WebP2

### 主要功能

- 本地处理：图片压缩/转码在本机完成，不需要上传到服务器
- 对比预览：前后画质与体积对照查看
- 参数可调：质量、尺寸、颜色量化等（以应用内选项为准）
- 批量处理：一次导入多张图片并导出（支持打包下载）
- 多语言：支持中文 / English / 日本語

### 与 Google 原版（Web）相比的优势

| 项目       | Squoosh（Web）              | Squoosh-Desktop                     |
| ---------- | --------------------------- | ----------------------------------- |
| 离线使用   | 受浏览器/缓存影响           | 安装即用，离线优先                  |
| 批量导出   | 依赖浏览器体验/实现差异     | 内置批量处理与打包下载              |
| 隐私与合规 | 可能受网站统计/网络请求影响 | 本地处理为主，便于内网/离线环境使用 |
| 系统集成   | 受浏览器文件选择限制        | 桌面应用入口更直接                  |
| 多平台分发 | 无安装包                    | 提供 Windows / macOS / Linux 安装包 |

### 使用方法

1. 启动应用
2. 拖拽图片到窗口（或使用选择按钮）
3. 选择目标格式与参数
4. 对比压缩前/后效果与大小
5. 导出保存结果（批量模式支持打包下载）

### 隐私说明（Analytics）

本项目上游 Squoosh 默认包含 Google Analytics 统计代码，桌面版如果复用上游前端资源，仍可能请求 `https://www.google-analytics.com/analytics.js` 并发送页面访问等统计事件：

- 对应实现位置：`src/client/initial-app/index.tsx`
- 如你发布自己的分发包且希望完全禁用统计，请在构建前移除/禁用该段逻辑并重新打包

### 从源码运行与打包

依赖：

- Node.js（建议 16+）
- npm

本地开发（桌面应用）：

```sh
npm install
npm run desktop:dev
```

构建安装包/免安装包：

```sh
npm run desktop:dist
```

构建完成后，产物位于 `release-Squoosh-Desktop/`。

### 开源声明与致谢

- 上游项目：Squoosh（Google 开源项目）
  - 在线版本：https://squoosh.app
- 本项目为基于上游的二次开发与桌面封装，不代表 Google 官方出品或背书

### 许可证

本项目以 Apache License 2.0 发布，详见 [LICENSE](/LICENSE)。

---

## English

Squoosh-Desktop is an offline-first desktop image compressor/transcoder for Windows / macOS / Linux. It includes side-by-side comparison, tunable codec options, and batch processing.

This project is based on Google’s open-source Squoosh (with desktop packaging and additional changes) to deliver Squoosh’s core capabilities as a desktop app.

### Download

Get the latest build from Releases:

- Windows (NSIS installer): `Squoosh-Desktop.Setup.*.exe`
- Windows (Portable): `Squoosh-Desktop.*.exe`
- macOS (DMG): `Squoosh-Desktop-*.dmg`
- Linux: `Squoosh-Desktop-*.AppImage` / `Squoosh-Desktop_*.deb`

### Supported Formats

Input:

- Common formats: JPEG, PNG, GIF, BMP, TIFF, WebP (depends on the Chromium runtime)
- Extra decoders: AVIF, JPEG XL (JXL), WebP2, QOI (fallback decoders when not natively supported)

Output:

- JPEG (MozJPEG / browser encoder)
- PNG (OxiPNG / browser encoder)
- WebP
- AVIF
- JPEG XL (JXL)
- GIF (browser encoder)
- QOI
- WebP2

### Features

- Local processing: no server upload required
- Side-by-side preview: compare quality & file size
- Tunable options: quality, resize, quantization, etc. (see in-app options)
- Batch processing: import multiple files and export (with zip download)
- UI languages: 中文 / English / 日本語

### Advantages vs the original Squoosh (Web)

| Item                          | Squoosh (Web)              | Squoosh-Desktop                 |
| ----------------------------- | -------------------------- | ------------------------------- |
| Offline usage                 | depends on browser/cache   | install & use, offline-first    |
| Batch export                  | varies by browser UX       | built-in batch + zip download   |
| Privacy / offline environment | website requests may apply | local-first, works well offline |
| Distribution                  | no installers              | Windows / macOS / Linux builds  |

### Usage

1. Launch the app
2. Drag images into the window (or use the picker)
3. Choose output format and options
4. Compare before/after quality and file size
5. Export/download the result

### Privacy (Analytics)

Upstream Squoosh includes Google Analytics. If upstream frontend code is reused, the app may request `https://www.google-analytics.com/analytics.js` and send page-visit events:

- Location: `src/client/initial-app/index.tsx`
- To fully disable analytics in your distribution, remove/disable that logic before building and package again

### Build from Source

Requirements:

- Node.js (16+ recommended)
- npm

Desktop development:

```sh
npm install
npm run desktop:dev
```

Build distributables:

```sh
npm run desktop:dist
```

Outputs are placed under `release-Squoosh-Desktop/`.
