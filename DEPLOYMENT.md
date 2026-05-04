# EDMS 部署说明

## 推荐方案

推荐使用 `Ubuntu + Docker Compose + PostgreSQL` 部署。

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

至少修改这些值：

```env
DEBUG=False
SECRET_KEY=替换成高强度随机字符串
ALLOWED_HOSTS=your-domain.com,服务器公网IP

DATABASE_URL=postgresql://edms:change-me@db:5432/edms
POSTGRES_DB=edms
POSTGRES_USER=edms
POSTGRES_PASSWORD=change-me

CORS_ALLOWED_ORIGINS=https://your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com
SECURE_SSL_REDIRECT=False
```

如果你暂时没有 HTTPS，可以先保留 `SECURE_SSL_REDIRECT=False`。

## 启动服务

```bash
docker compose up -d --build
```

首次启动时，后端容器会自动执行：

- `python manage.py migrate`
- `python manage.py collectstatic --noinput`
- 启动 `gunicorn`

## 创建管理员账户

```bash
docker compose exec backend python manage.py createsuperuser
```

## 访问地址

- 前端首页：`http://你的域名或服务器IP:8081`
- Django Admin：`http://你的域名或服务器IP:8081/admin/`
- Swagger：`http://你的域名或服务器IP:8081/swagger/`
- ReDoc：`http://你的域名或服务器IP:8081/redoc/`

## 常用命令

查看日志：

```bash
docker compose logs -f
```

仅查看后端日志：

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

## HTTPS 建议

正式生产建议：

- 给域名配置 DNS
- 在服务器前面加 Nginx / Caddy / 宝塔 / 云负载均衡做 HTTPS
- 证书生效后，把 `SECURE_SSL_REDIRECT=True`
- 同时把 `CORS_ALLOWED_ORIGINS` 和 `CSRF_TRUSTED_ORIGINS` 改成 `https://你的域名`

## 目录说明

- PostgreSQL 数据：Docker volume `postgres_data`
- 用户上传文件：Docker volume `media_data`
- Django 静态文件：Docker volume `static_data`

## 备注

当前部署方案已经支持：

- React 前端静态构建
- Django + Gunicorn
- PostgreSQL
- nginx 反向代理
- 静态文件与上传文件持久化

## 版本号管理

项目根目录有一个 `VERSION` 文件，例如：

```text
1.0.1
```

建议每次准备发版时：

1. 修改 `VERSION`
2. 提交代码
3. 打 Git tag

示例：

```bash
git add VERSION
git commit -m "Release v1.0.2"
git tag v1.0.2
git push
git push origin v1.0.2
```

前端设置页会通过 `/api/system/version/` 自动显示当前版本号。

如果后面你想继续增强，我建议下一步加：

- 自动备份数据库
- HTTPS 自动签发
- CI/CD 自动发布
- `.env` 分环境管理
