# `/api/agent/import-jobs/` API 契约

本文档描述 Hermes 面向 EDMS 的导入作业接口。字段名、路径、状态值保持英文，说明文字使用中文。

## 统一响应格式

EDMS API 通常返回如下外壳：

```json
{
  "code": 200,
  "data": {},
  "message": "success"
}
```

自动化逻辑应优先读取 `data`，错误分支应读取 `data.error_code` 或字段级错误。

## 创建导入作业

```http
POST /api/agent/import-jobs/
Authorization: Bearer <access-token>
Content-Type: application/json
```

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `idempotency_key` | string | 推荐 | 幂等键。同一用户重复提交相同键时返回同一个作业。 |
| `source` | string | 否 | 数据来源，默认可使用 `hermes`。 |
| `project` | integer | 否 | EDMS 项目 ID。若提供，必须属于当前用户或 service account 授权范围。 |
| `experiment` | integer | 否 | EDMS 实验 ID。若提供，必须属于同一项目。 |

成功响应：

```json
{
  "code": 201,
  "data": {
    "id": 12,
    "idempotency_key": "hermes-run-20260513-001",
    "source": "hermes",
    "project": 1,
    "experiment": null,
    "status": "created",
    "counts": {
      "files": 0,
      "items": 0,
      "uploaded": 0,
      "parsed": 0,
      "imported": 0,
      "errors": 0,
      "warnings": 0
    },
    "error": {},
    "created_by": 3,
    "item_count": 0,
    "audit_events": [],
    "created_at": "2026-05-13T10:00:00Z",
    "updated_at": "2026-05-13T10:00:00Z"
  },
  "message": "import job created"
}
```

## 查询作业列表

```http
GET /api/agent/import-jobs/?status=uploaded
Authorization: Bearer <access-token>
```

说明：

- 只返回当前用户创建的作业，或当前用户拥有项目权限的作业。
- `status` 可选，用于过滤作业状态。

响应：

```json
{
  "code": 200,
  "data": {
    "count": 1,
    "results": [
      {
        "id": 12,
        "source": "hermes",
        "status": "uploaded",
        "counts": {
          "files": 2,
          "items": 2,
          "uploaded": 2,
          "parsed": 0,
          "imported": 0,
          "errors": 0,
          "warnings": 0
        }
      }
    ]
  },
  "message": "success"
}
```

## 查询作业详情

```http
GET /api/agent/import-jobs/{id}/
Authorization: Bearer <access-token>
```

返回该作业的当前状态、计数、错误和审计事件。无权限访问时返回 `404`，避免泄露其他用户作业是否存在。

## 上传文件

```http
POST /api/agent/import-jobs/{id}/files/
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
```

表单字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `files` | file[] | 是 | 一个或多个实验数据文件。 |
| `file_keys` | string[] | 推荐 | 与 `files` 顺序一致的稳定文件键。未提供时后端使用文件名。 |
| `sha256` | string[] | 推荐 | 与 `files` 顺序一致的小写 SHA-256。提供时后端会校验。 |

成功响应包含 `created` 和 `skipped`。同一作业内相同 `file_key` 或相同 `sha256` 会被视为重复并跳过。

SHA-256 不匹配时返回：

```json
{
  "code": 400,
  "data": {
    "error_code": "sha256_mismatch",
    "file_key": "xrd-001.csv",
    "expected_sha256": "abc...",
    "actual_sha256": "def..."
  },
  "message": "sha256 does not match uploaded file"
}
```

## 解析作业

```http
POST /api/agent/import-jobs/{id}/parse/
Authorization: Bearer <access-token>
```

当前实现执行基础校验：至少需要一个已上传 item，并校验 `file_key`、`sha256` 等基础字段。解析成功后作业进入 `awaiting_confirmation`。

## 获取预览

```http
GET /api/agent/import-jobs/{id}/preview/
Authorization: Bearer <access-token>
```

响应：

```json
{
  "code": 200,
  "data": {
    "job": {},
    "items": [
      {
        "id": 1,
        "file_key": "xrd-001.csv",
        "original_filename": "xrd-001.csv",
        "sha256": "9c56...",
        "size": 2048,
        "content_type": "text/csv",
        "status": "parsed",
        "metadata": {},
        "errors": [],
        "warnings": []
      }
    ],
    "errors": [],
    "warnings": []
  },
  "message": "success"
}
```

## 确认导入

```http
POST /api/agent/import-jobs/{id}/confirm/
Authorization: Bearer <access-token>
```

只有 `status=awaiting_confirmation` 且存在已解析 item 的作业可以确认。当前实现会将已解析 item 标记为 `imported`，并将作业标记为 `succeeded`。

未就绪时返回：

```json
{
  "code": 409,
  "data": {
    "error_code": "job_not_ready"
  },
  "message": "import job is not ready to confirm"
}
```

## 重试

```http
POST /api/agent/import-jobs/{id}/retry/
Authorization: Bearer <access-token>
Content-Type: application/json
```

请求体可选：

```json
{
  "item_id": 3
}
```

说明：

- 提供 `item_id` 时，仅重置指定 item。
- 未提供 `item_id` 时，只允许对 `failed` 或 `partial_failed` 作业重试。

## 幂等性

Hermes 应为每次导入生成稳定 `idempotency_key`。同一用户重复提交同一键时，EDMS 返回已有作业，避免重复创建导入任务。
