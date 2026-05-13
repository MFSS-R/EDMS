# Hermes 上传数据包格式

Hermes 可以直接通过 `/files/` 上传单个或多个文件。对于需要离线打包、审计和批量重试的场景，推荐使用 `package.zip + manifest.json` 作为 Hermes 的内部数据包格式。

当前后端已实现“导入作业 + 文件上传 + 解析预览”的接口骨架；完整 `package.zip` 自动解析可以在后续版本中基于本文档扩展。

## 推荐压缩包结构

```text
package.zip
|-- manifest.json
|-- files/
|   |-- SAMPLE-2026-001/
|   |   |-- XRD/
|   |   |   `-- xrd-001.csv
|   |   `-- VSM/
|   |       |-- vsm-001.csv
|   |       `-- vsm-raw.dat
|   `-- SAMPLE-2026-002/
|       `-- XRD/
|           `-- xrd-002.csv
```

规则：

- `manifest.json` 必须位于 zip 根目录。
- manifest 中的路径必须相对于 zip 根目录，并使用 `/`。
- 路径不能是绝对路径，不能包含 `..`，也不能逃逸出压缩包目录。
- Hermes 应避免写入 `.DS_Store`、`__MACOSX/` 等系统元数据文件。
- 文件名建议使用 UTF-8。

## Manifest 顶层字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `schema_version` | string | 是 | 契约版本。当前建议值：`1.0`。 |
| `package_id` | string | 是 | Hermes 生成的唯一数据包 ID。 |
| `created_at` | string | 是 | ISO 8601 时间戳。 |
| `source` | object | 是 | Hermes agent、版本和主机信息。 |
| `defaults` | object | 否 | 默认项目、测试人、仪器和时区。 |
| `items` | array | 是 | 待导入的实验数据记录。 |

## Item 字段

每个 `items[]` 元素对应一条 EDMS 实验数据记录。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `external_id` | string | 是 | Hermes 侧稳定记录 ID，用于审计和幂等。 |
| `project_code` | string | 推荐 | EDMS 项目标识或别名。 |
| `sample_id` | string | 是 | EDMS 中已有样品 ID。 |
| `test_type` | string | 是 | 测试类型名称，例如 `XRD`、`VSM`。 |
| `test_date` | string | 推荐 | 日期，格式为 `YYYY-MM-DD`。 |
| `instrument` | string | 否 | 仪器名称。 |
| `tester` | string | 否 | 操作者或系统身份。 |
| `notes` | string | 否 | 给人工查看的备注。 |
| `metadata` | object | 否 | 额外机器可读元数据。 |
| `files` | array | 是 | 关联到该实验数据记录的文件列表。 |

## File 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `path` | string | 是 | zip 内相对路径。 |
| `role` | string | 推荐 | `raw`、`processed`、`report`、`image` 或 `other`。 |
| `sha256` | string | 推荐 | 小写十六进制 SHA-256，用于完整性校验。 |
| `mime_type` | string | 否 | 已知 MIME 类型。 |
| `size_bytes` | integer | 推荐 | 压缩前文件大小。 |

## 校验建议

EDMS 应拒绝以下数据包：

- 缺少 `manifest.json`。
- `manifest.json` 不是合法 JSON。
- `schema_version` 不受支持。
- manifest 引用了 zip 中不存在的文件。
- 路径不安全、重复或试图路径穿越。
- 提供了 `sha256` 但实际文件摘要不匹配。
- 当前 service account 无权导入目标项目。
- 样品不存在，且接口未显式允许自动创建样品。
- 压缩包大小、解压后大小、文件数量或 item 数量超过限制。

## 与现有 EDMS 上传的关系

现有网页上传接口 `/api/tests/data/upload_package/` 依赖目录结构推断样品和测试类型。Hermes 应优先使用 agent import job 接口，因为它有明确状态、幂等、审计和确认流程，更适合自动化。
