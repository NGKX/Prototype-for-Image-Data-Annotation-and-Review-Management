# GitHub 使用指南 — 图片数据标注与审核管理平台

## 目录

1. [获取代码](#1-获取代码)
2. [本地运行项目](#2-本地运行项目)
3. [浏览项目结构](#3-浏览项目结构)
4. [使用 Issues 跟踪任务](#4-使用-issues-跟踪任务)
5. [提交代码 (Pull Request)](#5-提交代码-pull-request)
6. [使用 GitHub Actions（可选）](#6-使用-github-actions可选)
7. [GitHub Pages 部署前端（可选）](#7-github-pages-部署前端可选)
8. [使用 Release 发布版本](#8-使用-release-发布版本)
9. [团队协作流程](#9-团队协作流程)

---

## 1. 获取代码

### 方法一：直接克隆（推荐）

```bash
git clone https://github.com/NGKX/Prototype-for-Image-Data-Annotation-and-Review-Management.git
cd Prototype-for-Image-Data-Annotation-and-Review-Management
```

### 方法二：下载 ZIP

1. 打开仓库主页：https://github.com/NGKX/Prototype-for-Image-Data-Annotation-and-Review-Management
2. 点击绿色 **Code** 按钮
3. 选择 **Download ZIP**
4. 解压到本地目录

### 方法三：使用 GitHub Desktop

1. 安装 [GitHub Desktop](https://desktop.github.com/)
2. 打开后点击 **File → Clone Repository**
3. 输入仓库 URL 或搜索仓库名称
4. 选择本地目录，点击 **Clone**

---

## 2. 本地运行项目

### 环境准备

| 工具 | 下载地址 | 备注 |
|------|---------|------|
| Python 3.11+ | https://www.python.org/downloads/ | 勾选 "Add Python to PATH" |
| Node.js 20+ | https://nodejs.org/ | 推荐 LTS 版本 |
| Git | https://git-scm.com/ | 用于代码管理 |

验证安装：

```bash
python --version    # 应显示 Python 3.11.x 或更高
node --version      # 应显示 v20.x.x 或更高
git --version       # 确认 Git 已安装
```

### 启动步骤

```bash
# 1. 进入项目目录
cd Prototype-for-Image-Data-Annotation-and-Review-Management/annotation-platform

# 2. 安装后端依赖并启动
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
# 后端运行在 http://localhost:8000

# 3. 新开一个终端，启动前端
cd ../frontend
npm install
npm run dev
# 前端运行在 http://localhost:5173
```

浏览器打开 `http://localhost:5173`，注册账号即可开始使用。

### 使用 Docker（无需配置环境）

```bash
# 在项目根目录下
cd annotation-platform
cp .env.example .env
docker compose up -d postgres redis minio backend celery-worker frontend
```

---

## 3. 浏览项目结构

打开 GitHub 仓库主页，可以看到完整的文件目录树：

```
├── README.md              ← 项目说明文档
├── annotation-platform/   ← 主项目代码
│   ├── backend/           ← FastAPI 后端
│   │   ├── app/
│   │   │   ├── api/v1/    ← REST API 接口
│   │   │   ├── models/    ← 数据库模型
│   │   │   └── services/  ← 业务逻辑
│   │   ├── alembic/       ← 数据库迁移
│   │   └── requirements.txt
│   ├── frontend/          ← React 前端
│   │   ├── src/
│   │   │   ├── features/  ← 各功能页面
│   │   │   ├── services/  ← API 调用
│   │   │   └── components/← 通用组件
│   │   └── package.json
│   ├── ml_service/        ← YOLOv8 推理服务
│   ├── nginx/             ← Nginx 配置
│   ├── tests/             ← 测试用例
│   └── docker-compose.yml ← Docker 编排
└── 使用说明.md            ← 用户使用手册
```

### 在线查看代码

GitHub 的代码浏览器支持：
- **语法高亮：** Python、TypeScript、SQL 等自动高亮
- **代码跳转：** 点击函数名/类名可跳转到定义
- **Blame 视图：** 查看每一行代码是谁在什么时间修改的
- **搜索：** 按 `/` 键或点击搜索框，可全局搜索代码

---

## 4. 使用 Issues 跟踪任务

### 创建 Issue

1. 打开仓库 → 点击 **Issues** 标签
2. 点击 **New Issue**
3. 填写标题和描述
4. 右侧可设置：
   - **Assignees：** 指派负责人
   - **Labels：** 标签（bug / enhancement / documentation）
   - **Projects：** 关联项目看板

### Issue 模板建议

```markdown
**问题描述**
简要描述遇到的问题或需要实现的功能。

**复现步骤（Bug）**
1. 打开 xxx 页面
2. 点击 xxx 按钮
3. 观察到 xxx 错误

**期望行为**
描述期望的正确行为。

**运行环境**
- 操作系统：Windows 11 / macOS 14 / Ubuntu 22.04
- Python 版本：3.11.x
- 浏览器：Chrome 120
```

### Labels 标签说明

| 标签 | 含义 |
|------|------|
| `bug` | 缺陷/错误 |
| `enhancement` | 功能增强 |
| `documentation` | 文档相关 |
| `good first issue` | 适合新手 |
| `help wanted` | 需要帮助 |

---

## 5. 提交代码 (Pull Request)

### 标准流程

```bash
# 1. 确保本地代码是最新的
git checkout main
git pull origin main

# 2. 创建新分支（以功能命名）
git checkout -b feature/add-user-dashboard

# 3. 编写代码...

# 4. 查看修改内容
git status
git diff

# 5. 提交代码
git add .
git commit -m "feat: 添加用户仪表盘统计功能"

# 6. 推送到 GitHub
git push origin feature/add-user-dashboard
```

### 提交信息规范

推荐使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
feat: 添加数据导出功能

- 支持 YOLO/COCO/VOC 三种格式
- ZIP 打包支持分卷
- 异步导出 + 状态轮询
```

常用前缀：

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat:` | 新功能 | `feat: 添加审核面板` |
| `fix:` | 修复 Bug | `fix: 修复标注撤销崩溃问题` |
| `docs:` | 文档更新 | `docs: 更新使用说明` |
| `refactor:` | 代码重构 | `refactor: 提取通用上传组件` |
| `test:` | 添加测试 | `test: 添加导出功能测试` |
| `style:` | 格式调整 | `style: 统一缩进格式` |

### 发起 Pull Request

1. 推送分支后，在 GitHub 仓库页面会出现 **Compare & pull request** 按钮
2. 点击后填写：
   - **Title：** 简明扼要的标题
   - **Description：** 详细描述改动内容、原因、测试方法
3. 右侧设置 Reviewers（审核人）、Assignees（负责人）
4. 点击 **Create pull request**

### 代码审查

1. PR 创建后，Reviewer 会在 **Files changed** 中逐行查看代码
2. Reviewer 可以点击行号旁边的 **+** 添加行级评论
3. 提交者根据评论修改代码后再次 push，PR 自动更新
4. 所有评论解决后，Reviewer 点击 **Merge pull request**

### 合并方式

| 方式 | 说明 |
|------|------|
| **Merge commit** | 保留完整提交历史（推荐） |
| **Squash and merge** | 压缩为单个提交 |
| **Rebase and merge** | 变基合并，保持线性历史 |

---

## 6. 使用 GitHub Actions（可选）

本项目可以配置 GitHub Actions 实现 CI/CD。

### 示例：自动测试

在仓库中创建 `.github/workflows/test.yml`：

```yaml
name: Run Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install dependencies
        run: |
          cd annotation-platform/backend
          pip install -r requirements.txt
      - name: Run tests
        run: |
          cd annotation-platform
          pytest tests/ -v
```

### 示例：前端构建检查

```yaml
name: Frontend Build

on:
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install & Build
        run: |
          cd annotation-platform/frontend
          npm ci
          npm run build
```

---

## 7. GitHub Pages 部署前端（可选）

GitHub Pages 可以免费部署静态前端页面（仅限前端展示，后端需要单独部署）。

### 部署步骤

1. 在仓库 **Settings → Pages** 中，Source 选择 **GitHub Actions**
2. 创建 `.github/workflows/deploy-pages.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd annotation-platform/frontend && npm ci && npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./annotation-platform/frontend/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

部署后前端可通过 `https://NGKX.github.io/Prototype-for-Image-Data-Annotation-and-Review-Management/` 访问。

---

## 8. 使用 Release 发布版本

### 创建 Release

1. 打开仓库 → 点击 **Releases** → **Create a new release**
2. 填写：
   - **Tag version：** `v1.0.0`（遵循 [Semantic Versioning](https://semver.org/)）
   - **Release title：** `v1.0.0 — 首个完整版本`
   - **Description：** 填写更新日志

### 更新日志模板

```markdown
## 新增功能
- 数据导出支持 YOLO/COCO/VOC 三种格式
- 统计仪表盘（标注员表现、30天趋势、类别分布）
- 生产容器化部署

## Bug 修复
- 修复标注画布缩放时坐标偏移问题

## 更新内容
- 完善 README 和使用说明
- 添加 E2E 测试骨架
```

### 版本号规则

| 版本号 | 含义 | 示例 |
|--------|------|------|
| 主版本号 | 不兼容的 API 修改 | `1.x.x → 2.0.0` |
| 次版本号 | 向后兼容的新功能 | `1.0.x → 1.1.0` |
| 修订号 | 向后兼容的 Bug 修复 | `1.0.0 → 1.0.1` |

---

## 9. 团队协作流程

### 日常开发流程

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 创建    │ →  │ 开发    │ →  │ 提交    │ →  │ 代码    │
│ Issue   │    │ Feature │    │ PR      │    │ Review  │
│         │    │ Branch  │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └────┬────┘
                                                  │
                                            ┌─────┴─────┐
                                            │ 通过？    │
                                            └─┬──────┬──┘
                                          ✅是│      │❌否
                                            ↓      │
                                      ┌─────────┐ │
                                      │ Merge   │ │
                                      │ to Main │←┘
                                      └─────────┘
```

### 分支命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| 新功能 | `feature/<功能名>` | `feature/export-yolo-format` |
| Bug修复 | `fix/<问题描述>` | `fix/canvas-zoom-offset` |
| 文档 | `docs/<内容>` | `docs/api-reference` |
| 重构 | `refactor/<模块>` | `refactor/annotation-store` |

### 日常命令速查

```bash
# 查看当前分支
git branch

# 切换到 main 并拉取最新代码
git checkout main && git pull

# 创建并切换到新分支
git checkout -b feature/my-feature

# 查看修改状态
git status

# 添加修改
git add .                                    # 添加所有修改
git add annotation-platform/backend/app/     # 添加指定目录

# 提交
git commit -m "feat: 描述你的改动"

# 推送
git push origin feature/my-feature

# 如果 main 有更新，合并到自己分支
git checkout main && git pull
git checkout feature/my-feature
git merge main
```

### 冲突解决

当两个人修改了同一文件时会产生冲突：

```bash
# 合并 main 时出现冲突
git merge main
# Auto-merging xxx.py
# CONFLICT: Merge conflict in xxx.py

# 1. 手动编辑冲突文件，保留正确的代码
# 2. 标记冲突已解决
git add xxx.py

# 3. 完成合并
git commit -m "merge: 解决与 main 的冲突"

# 4. 推送
git push origin feature/my-feature
```

---

> **仓库地址：** https://github.com/NGKX/Prototype-for-Image-Data-Annotation-and-Review-Management
>
> 如有问题，请提交 [Issue](https://github.com/NGKX/Prototype-for-Image-Data-Annotation-and-Review-Management/issues)
