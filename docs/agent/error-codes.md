# Hermes Agent 错误码

错误码是给 Hermes 自动化逻辑使用的稳定标识。`message` 文本可以调整，自动化分支应优先依赖 `error_code` 或 `code`。

## 当前后端已使用的错误码

| 错误码 | HTTP | 含义 | 是否建议重试 |
| --- | --- | --- | --- |
| `job_not_found` | 404 | 导入作业不存在，或当前用户无权访问。 | 否 |
| `files_required` | 400 | 上传文件接口缺少 `files[]`。 | 否 |
| `sha256_mismatch` | 400 | 提供的 SHA-256 与上传文件内容不一致。 | 否 |
| `no_valid_items` | 409 | 作业中没有可解析 item。 | 否 |
| `job_not_ready` | 409 | 作业还未进入可确认状态。 | 否 |
| `item_not_found` | 404 | 指定 item 不存在或不属于当前作业。 | 否 |
| `retry_not_allowed` | 409 | 当前作业状态不允许重试。 | 否 |
| `project_not_found` | 400/403 | 项目不存在或当前用户不可用。 | 否 |
| `experiment_not_found` | 400/403 | 实验不存在或当前用户不可用。 | 否 |
| `experiment_project_mismatch` | 400 | 实验不属于指定项目。 | 否 |

## 建议补充的认证和授权错误码

| 错误码 | HTTP | 含义 | 是否建议重试 |
| --- | --- | --- | --- |
| `AUTH_TOKEN_MISSING` | 401 | 缺少 `Authorization` 请求头。 | 否 |
| `AUTH_TOKEN_INVALID` | 401 | Token 格式错误、过期、被撤销或签名无效。 | 刷新 token 后重试 |
| `AGENT_ID_MISMATCH` | 403 | 请求中的 `agent_id` 与 token 授权范围不一致。 | 否 |
| `IMPORT_PERMISSION_DENIED` | 403 | 当前账号无权创建目标项目的导入作业。 | 否 |
| `PROJECT_SCOPE_DENIED` | 403 | 数据包引用了授权范围外的项目。 | 否 |

## 建议补充的数据包校验错误码

| 错误码 | HTTP | 含义 | 是否建议重试 |
| --- | --- | --- | --- |
| `PACKAGE_FIELD_MISSING` | 400 | multipart 请求缺少 `package` 文件。 | 否 |
| `PACKAGE_NOT_ZIP` | 415 | 上传内容不是 zip 文件。 | 否 |
| `PACKAGE_TOO_LARGE` | 413 | 压缩包或解压后内容超过限制。 | 否 |
| `PACKAGE_UNSAFE_PATH` | 400 | 压缩包内存在绝对路径或路径穿越。 | 否 |
| `MANIFEST_MISSING` | 400 | zip 根目录缺少 `manifest.json`。 | 否 |
| `MANIFEST_JSON_INVALID` | 400 | `manifest.json` 不是合法 JSON。 | 否 |
| `MANIFEST_SCHEMA_UNSUPPORTED` | 400 | `schema_version` 不受支持。 | 否 |
| `MANIFEST_SCHEMA_INVALID` | 400 | manifest 不符合当前 schema。 | 否 |
| `FILE_PATH_NOT_FOUND` | 422 | manifest 引用了 zip 中不存在的文件。 | 否 |
| `FILE_DIGEST_MISMATCH` | 422 | `sha256` 与文件内容不一致。 | 否 |
| `FILE_DUPLICATE_PATH` | 400 | 同一路径被声明多次。 | 否 |

## 建议补充的业务校验错误码

| 错误码 | HTTP | 含义 | 是否建议重试 |
| --- | --- | --- | --- |
| `PROJECT_NOT_FOUND` | 422 | 项目标识不存在。 | 否 |
| `SAMPLE_NOT_FOUND` | 422 | 样品 ID 不存在。 | 否 |
| `TEST_TYPE_INVALID` | 422 | 测试类型为空或不符合命名规则。 | 否 |
| `TEST_DATE_INVALID` | 422 | 测试日期非法或超出允许范围。 | 否 |
| `IMPORT_CONFLICT` | 409 | 数据包与现有 EDMS 记录冲突。 | 否 |
| `IDEMPOTENCY_KEY_REUSED` | 409 | 同一幂等键被用于不同内容。 | 否 |

## 建议补充的处理和限流错误码

| 错误码 | HTTP | 含义 | 是否建议重试 |
| --- | --- | --- | --- |
| `RATE_LIMITED` | 429 | Agent 超过请求或作业创建频率限制。 | 按 `Retry-After` 重试 |
| `IMPORT_QUEUE_FULL` | 429 | 服务端暂时无法接收更多导入作业。 | 是 |
| `IMPORT_JOB_FAILED` | 500 | 作业接收后处理失败。 | 取决于作业错误详情 |
| `INTERNAL_ERROR` | 500 | 未预期服务端错误。 | 指数退避后重试 |

## 错误响应示例

```json
{
  "code": 422,
  "data": {
    "error_code": "SAMPLE_NOT_FOUND",
    "details": [
      {
        "field": "items[0].sample_id",
        "error_code": "SAMPLE_NOT_FOUND",
        "message": "Unknown sample id."
      }
    ],
    "request_id": "req_01HX9E0K6C3M3D3"
  },
  "message": "Sample SAMPLE-2026-404 was not found."
}
```
