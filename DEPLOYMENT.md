# EDMS 部署说明

本文档说明 EDMS 的推荐部署方式、环境变量、常用运维命令和版本发布流程。

## 推荐方案

生产或服务器环境推荐使用：

- Ubuntu / Debian Linux
- Docker Compose
- PostgreSQL
- Nginx 或 Caddy 作为 HTTPS 入口

本地开发推荐使用：

- 后端：`127.0.0.1:8000`
- 前端：`127.0.0.1:5173`
- 前端通过 Vite 代理 `/api` 和 `/media` 到后端。

## 服务器准备

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable docker
sudo systemctl start docker
```

## 拉取项目

```bash
git clone <your-repo-url> edms
cd edms
```

## 配置环境变量

复制后端环境变量模板：

```bash
cp backend/.env.example backend/.env
```

生产环境至少需要修改：

```env
DEBUG=False
SECRET_KEY=替换为高强度随机字符串
ALLOWED_HOSTS=your-domain.com,服务器公网IP

DATABASE_URL=postgresql://edms:change-me@db:5432/edms
POSTGRES_DB=edms
POSTGRES_USER=edms
POSTGRES_PASSWORD=change-me
POSTGRES_HOST=db
POSTGRES_PORT=5432

CORS_ALLOWED_ORIGINS=https://your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com
CORS_ALLOW_ALL_ORIGINS=False
SECURE_SSL_REDIRECT=False

JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
```

如果暂时没有 HTTPS，可以先保留 `SECURE_SSL_REDIRECT=False`。正式上线并配置证书后再改为 `True`。

## 启动服务

```bash
docker compose up -d --build
```

首次启动时，后端容器会执行：

- `python manage.py migrate`
- `python manage.py collectstatic --noinput`
- 启动 `gunicorn`

## 创建管理员账号

```bash
docker compose exec backend python manage.py createsuperuser
```

## 访问地址

默认 Docker Compose 将前端容器映射到宿主机 `8081`：

- 前端首页：`http://服务器地址:8081`
- Django Admin：`http://服务器地址:8081/admin/`
- Swagger：`http://服务器地址:8081/swagger/`
- ReDoc：`http://服务器地址:8081/redoc/`
- OpenAPI Schema：`http://服务器地址:8081/api/schema/`

## 本地开发端口

本地开发不走 Docker 时：

- 后端：`http://127.0.0.1:8000`
- 前端：`http://127.0.0.1:5173`
- API：前端同源访问 `/api`，由 Vite 代理到后端。
- 媒体文件：前端同源访问 `/media`，由 Vite 代理到后端。

Windows 可直接运行：

```bat
start_services.bat
```

停止服务：

```bat
stop_services.bat
```

## Hermes Agent 导入部署注意事项

Hermes Agent 通过 `/api/agent/import-jobs/` 系列接口导入实验数据。

生产部署建议：

- 为 Hermes 创建独立 service account。
- 使用最小权限，只允许写入指定项目。
- 定期轮换 token。
- 保留导入作业、item 和 audit event 记录。
- 对上传数据包设置大小、文件数和频率限制。

详细接口和数据包规范见：

- `docs/agent/README.md`
- `docs/agent/api-contract.md`
- `docs/agent/upload-package.md`
- `docs/agent/error-codes.md`
- `docs/agent/permissions.md`

## 常用命令

查看全部日志：

```bash
docker compose logs -f
```

查看后端日志：

```bash
docker compose logs -f backend
```

重启服务：

```bash
docker compose restart
```

停止服务：

```bash
docker compose down
```

重新构建并启动：

```bash
docker compose up -d --build
```

执行数据库迁移：

```bash
docker compose exec backend python manage.py migrate
```

进入 Django shell：

```bash
docker compose exec backend python manage.py shell
```

## 数据目录

Docker Compose 使用以下 volume：

- `postgres_data`：PostgreSQL 数据。
- `media_data`：用户上传文件。
- `static_data`：Django 静态文件。

这些 volume 不应在升级时删除。

## HTTPS 建议

正式生产环境建议：

- 为域名配置 DNS。
- 在服务前放置 Nginx、Caddy、宝塔或云负载均衡。
- 使用 HTTPS 证书。
- 证书生效后设置 `SECURE_SSL_REDIRECT=True`。
- 将 `CORS_ALLOWED_ORIGINS` 和 `CSRF_TRUSTED_ORIGINS` 改为 `https://你的域名`。

## 测试与发布检查

发布前建议执行：

```bash
cd backend
..\venv\Scripts\python.exe manage.py test
..\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

```bash
cd frontend
npm test -- --run
npm run lint
npm run build
```

当前说明：

- `npm run lint` 可能输出 React Hooks warnings，但不阻断命令。
- `npm run build` 可能输出 Vite chunk size warning，但构建成功即可部署。

## 版本号管理

项目根目录的 `VERSION` 文件记录当前版本，例如：

```text
1.1.0
```

准备发布时建议：

1. 修改 `VERSION`。
2. 更新 `README.md` 和 `DEPLOYMENT.md`。
3. 运行后端和前端检查。
4. 提交代码。
5. 创建 Git tag。

示例：

```bash
git add VERSION README.md DEPLOYMENT.md
git commit -m "docs: update release documentation"
git tag v1.1.0
git push
git push origin v1.1.0
```

前端设置页会通过 `/api/system/version/` 显示当前版本号。
