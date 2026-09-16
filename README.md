# 城市视图

城市视图是一套面向城市运营人员和数据分析人员的可视化管理平台，提供城市运行指标仪表盘、动态图表配置、地图与 3D 场景、AI 数据助手以及用户和角色权限管理。

- 在线地址：<https://city.elinew.tech/>
- 技术栈：React 19、TypeScript、Redux Toolkit、React Router、Ant Design、ECharts、React Three Fiber、高德地图 JS API、Axios 和 Vite

## 功能模块

- 城市数据仪表盘与 CSV 导出
- 数据源、数据表和字段级联图表编辑器
- 柱状图、折线图、饼图和散点图统一渲染
- 基于高德地图的标记点、空气质量覆盖层、交通热力图和城市周边距离分析
- 基于 React Three Fiber 的城市沙盘建筑交互、楼层展开与三维指标对比
- 登录鉴权、角色菜单过滤与路由访问控制
- AI 城市数据问答与分析建议

## 本地开发

```bash
npm install
npm run dev
```

## 质量检查

```bash
npm run lint
npm run build
```

生产环境由 Cloudflare Pages 托管，`/api` 请求通过 Pages Function 转发至 `http://182.92.74.1:8080`。本地 Vite 代理使用同一后端。项目接口文档位于 <http://182.92.74.1:9999/>。

登录页照片：[Denys Nevozhai / Unsplash](https://unsplash.com/photos/shanghai-skyline-and-huangpu-river-D8iZPlX-2fs)。
