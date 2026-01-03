# Squoosh Desktop（桌面版图片压缩工具）

Squoosh Desktop 是一个离线优先的图片压缩/转码桌面应用（Windows 可用），支持多种编码格式与参数调节，并提供压缩前后对比预览。

本项目基于 Google 的开源项目 Squoosh（二次开发与桌面化封装），用于将 Squoosh 的核心能力以桌面应用形式交付。

## 主要功能

- 本地压缩：图片处理在本机完成，不需要把图片上传到服务器
- 多格式导出：JPEG/PNG/WebP/AVIF 等（具体以应用内选项为准）
- 可视化对比：压缩前后画质与体积一目了然
- 参数可调：质量、尺寸、颜色量化等（具体以应用内选项为准）

## 下载与安装（Windows）

若你是普通用户，推荐从项目 Releases 下载：

- 安装版（NSIS）：`Squoosh Desktop Setup <version>.exe`
- 免安装版（Portable）：`Squoosh Desktop <version>.exe`

如果你是从源码本地打包，构建产物默认输出到 `release-desktop/` 目录。

## 使用方法

1. 启动应用
2. 将图片拖拽进窗口（或使用导入按钮）
3. 在右侧选择目标格式与参数
4. 对比压缩前/后效果与大小
5. 点击下载/导出保存结果

## 隐私说明

- 图片内容：压缩与转码在本机完成，不会被本项目主动上传到服务器
- 统计：项目上游 Squoosh 默认包含 Google Analytics 统计代码，桌面版如果直接复用上游前端资源，仍可能请求 `https://www.google-analytics.com/analytics.js` 并发送页面访问等统计事件
  - 对应实现位置：`src/client/initial-app/index.tsx`
  - 如你发布自己的分发包且希望完全禁用统计，请在构建前移除/禁用该段逻辑并重新打包

## 从源码运行与打包

### 依赖

- Node.js（建议 16+）
- npm

### 本地开发（桌面应用）

```sh
npm install
npm run desktop:dev
```

### 构建安装包/免安装包（Windows）

```sh
npm run desktop:dist
```

构建完成后，产物位于 `release-desktop/`。

## 开源声明与致谢

- 上游项目：Squoosh（Google 开源项目）
  - 在线版本：https://squoosh.app
  - 代码与版权归属以本仓库内各文件头部声明与 LICENSE 为准
- 本项目为基于上游的二次开发与桌面封装，不代表 Google 官方出品或背书

## 许可证

本项目以 Apache License 2.0 发布，详见 [LICENSE](/LICENSE)。

## 第三方许可证

本项目包含多种编解码器与依赖库。与编解码器相关的许可证信息位于 `codecs/**/LICENSE.codec.md`。

## 贡献

欢迎提交 Issue/PR。贡献规范见 [CONTRIBUTING.md](/CONTRIBUTING.md)。
