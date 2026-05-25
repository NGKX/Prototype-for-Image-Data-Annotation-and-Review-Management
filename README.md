# 图片数据标注与审核管理平台

基于 Web 的图像标注与审核管理系统，支持多人协作标注、YOLOv8 自动标注、审核工作流和数据导出。

## 技术栈

| 层 | 技术 |
|---|------|
| **后端** | FastAPI (Python 3.11), SQLAlchemy 2.0 (async), Celery, PostgreSQL/SQLite |
| **前端** | React 18, TypeScript, Vite, Tailwind CSS, Fabric.js v6, Recharts, Zustand |
| **ML** | YOLOv8 (ultralytics), 独立 FastAPI 微服务 |
| **基础设施** | Docker Compose, Redis 7, MinIO, Nginx, Celery Beat |

## 快速开始

### 本地开发（无需 Docker）

```bash
# 后端
cd annotation-platform/backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端 (新终端)
cd annotation-platform/frontend
npm install
npm run dev
```

访问 http://localhost:5173

### Docker 部署

```bash
cd annotation-platform
cp .env.example .env
docker compose up -d postgres redis minio backend celery-worker frontend
```

生产模式（含 Nginx）：
```bash
docker compose --profile prod up -d
```

ML 服务（需要 GPU）：
```bash
docker compose --profile ml up -d ml-service
```

## 项目结构

```
annotation-platform/
├── backend/
│   ├── app/
│   │   ├── api/v1/           # REST API (auth, projects, images, annotations, reviews, exports, stats)
│   │   ├── core/             # Config, database, security (JWT + RBAC)
│   │   ├── models/           # SQLAlchemy ORM (10 tables)
│   │   ├── schemas/          # Pydantic models
│   │   ├── services/         # Business logic (image, export)
│   │   ├── tasks/            # Celery tasks (auto-annotation, export)
│   │   └── utils/            # Local storage adapter
│   ├── alembic/              # DB migrations
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/       # Shared UI (ErrorBoundary, layout, ui primitives)
│   │   ├── features/         # Feature pages (annotation, review, export, stats, trash)
│   │   ├── services/         # API client (axios)
│   │   ├── store/            # Zustand state
│   │   └── types/            # TypeScript types
├── ml_service/               # YOLOv8 inference microservice
├── nginx/                    # Production nginx config
├── tests/                    # E2E test suite
└── docker-compose.yml
```

## 功能模块

### P1-P2 基础设施 + 项目管理
- [x] Docker Compose 编排 (8 services)
- [x] JWT 认证 + RBAC (admin/data_manager/reviewer/annotator)
- [x] 项目 CRUD + 图片上传 (MinIO/local)

### P3-P4 标注工具
- [x] Fabric.js v6 画布 (缩放/平移/框选)
- [x] 矩形框 (BBox) + 多边形 (Polygon) 绘制与编辑
- [x] 类别绑定、撤销/重做、自动→手动过渡
- [x] 坐标存储为绝对像素值

### P5 YOLOv8 自动标注
- [x] 独立 ML 微服务 (ultralytics)
- [x] Celery 异步推理 (30s 超时 + 3次重试)
- [x] 自动标注结果以橙色虚线标识

### P6 审核系统 + 软删除
- [x] 审核状态机 (pending → approved/rejected → rework)
- [x] 任务领取锁机制 (30分钟 TTL)
- [x] 双画布审核面板、回收站

### P7 数据导出
- [x] YOLO 格式 (images/ + labels/ + classes.txt)
- [x] COCO JSON 格式
- [x] PASCAL VOC XML 格式
- [x] ZIP 打包 + 分卷支持 (2GB/卷)

### P8 统计仪表盘
- [x] 项目概览 (图片/标注/审核进度)
- [x] 标注员表现表 + 准确率
- [x] 30天趋势图 (Recharts)
- [x] 类别分布饼图

### P9 集成打磨
- [x] 生产容器化 (前端 Nginx + 静态构建)
- [x] React ErrorBoundary
- [x] 空状态提示
- [x] E2E 测试骨架

## API 概览

| 模块 | 端点前缀 | 主要操作 |
|------|---------|---------|
| Auth | `/api/v1/auth` | register, login, me |
| Projects | `/api/v1/projects` | CRUD, archive |
| Images | `/api/v1/images` | upload, list, detail, auto-annotate, submit-review, soft-delete, restore, permanent-delete |
| Categories | `/api/v1/categories` | CRUD, tree, import/export |
| Annotations | `/api/v1/annotations` | CRUD, batch save, version history |
| Reviews | `/api/v1/reviews` | queue, claim, release, approve, reject |
| Exports | `/api/v1/exports` | create, list, download, delete |
| Stats | `/api/v1/stats` | dashboard, annotators, trends, categories |

## 角色权限

| 角色 | 权限 |
|------|------|
| **admin** | 全部权限 (用户管理、项目CRUD、审核、导出、统计) |
| **data_manager** | 项目管理、图片上传、自动标注、导出 |
| **reviewer** | 审核队列、审核通过/退回 |
| **annotator** | 标注编辑、提交审核、查看自己的图片 |

## 数据库模型

10 个核心表: `users`, `projects`, `project_members`, `images`, `categories`, `annotations`, `annotation_versions`, `review_records`, `task_assignments`, `audit_logs`, `export_records`

## 运行测试

```bash
cd annotation-platform
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

## 许可证

MIT
