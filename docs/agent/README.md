# Hermes Agent 接入说明

本目录定义 Hermes agent 与 EDMS 之间的导入接口约定。目标是让 Hermes 能够整理实验数据、上传文件、触发解析预览，并在确认后将数据纳入 EDMS。

## 基础地址

Hermes 使用与前端相同的 EDMS API 地址。

- 本地 Docker 默认地址：`http://localhost:8081/api`
- 后端开发服务默认地址：`http://localhost:8000/api`
- Agent 导入入口：`/api/agent/import-jobs/`

不要在 Hermes 代码中硬编码环境地址。建议从配置读取，例如：

- `EDMS_API_BASE_URL`：API 基础地址，通常以 `/api` 结尾。
- `EDMS_AGENT_TOKEN`：短期访问令牌，或用于换取访问令牌的密钥。
- `EDMS_AGENT_ID`：稳定的 agent 逻辑标识，例如 `hermes-lab-a`。
- `EDMS_AGENT_TIMEOUT_SECONDS`：上传和查询请求超时时间。

## 认证方式

Hermes 应使用专用 EDMS service account。当前推荐沿用 EDMS API 的 Bearer Token 认证方式：

```http
Authorization: Bearer <access-token>
```

令牌应限制在 agent 导入权限范围内，并由管理员定期轮换。不要让 Hermes 复用普通用户的长期登录令牌。

## 推荐导入流程

当前后端使用“导入作业”模型，而不是让 Hermes 直接复用人工上传弹窗。

1. Hermes 创建导入作业：`POST /api/agent/import-jobs/`。
2. Hermes 上传文件：`POST /api/agent/import-jobs/{id}/files/`。
3. Hermes 触发解析：`POST /api/agent/import-jobs/{id}/parse/`。
4. EDMS 返回预览、警告和错误：`GET /api/agent/import-jobs/{id}/preview/`。
5. 人工或 Hermes 显式确认：`POST /api/agent/import-jobs/{id}/confirm/`。
6. Hermes 查询状态：`GET /api/agent/import-jobs/{id}/`。
7. 失败或部分失败时重试：`POST /api/agent/import-jobs/{id}/retry/`。

作业状态使用后端状态机：`created`、`uploaded`、`awaiting_confirmation`、`importing`、`succeeded`、`failed`、`partial_failed`。

## 文档索引

- [API 契约](api-contract.md)
- [上传数据包格式](upload-package.md)
- [错误码](error-codes.md)
- [权限矩阵](permissions.md)
- [Manifest 示例](examples/manifest.example.json)
