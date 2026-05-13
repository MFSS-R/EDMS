# Hermes Agent 权限模型

Hermes 导入应遵循最小权限原则。service account 只应拥有指定项目的导入权限，不应继承管理员权限。

## 推荐角色

| 角色 | 使用对象 | 说明 |
| --- | --- | --- |
| `agent_importer` | Hermes service account | 创建导入作业、上传文件、读取自己的作业状态。 |
| `project_member` | 普通 EDMS 用户 | 读取项目数据，使用现有网页上传流程。 |
| `project_owner` | 实验室负责人或项目管理员 | 管理项目成员，审核导入作业。 |
| `admin` | EDMS 系统管理员 | 管理 service account、token、全局限制和所有导入作业。 |

## 权限矩阵

| 能力 | Agent Importer | Project Member | Project Owner | Admin |
| --- | --- | --- | --- | --- |
| 创建 agent 导入作业 | 是，仅限授权项目 | 否 | 可选 | 是 |
| dry-run 校验数据包 | 是，仅限授权项目 | 否 | 可选 | 是 |
| 读取自己的导入作业状态 | 是 | 否 | 是，限项目内作业 | 是 |
| 读取项目内全部导入作业 | 否 | 否 | 是 | 是 |
| 取消排队中的导入作业 | 仅限自己的排队作业 | 否 | 项目内作业 | 是 |
| 通过 agent 接口创建样品 | 默认否 | 否 | 可选 | 是 |
| 创建实验数据和文件 | 是，通过导入作业 | 是，按现有网页/API 权限 | 是 | 是 |
| 删除导入文件 | 否 | 按现有项目规则 | 是 | 是 |
| 管理 agent token | 否 | 否 | 否 | 是 |
| 修改数据包大小限制 | 否 | 否 | 否 | 是 |
| 创建后查看 token 明文 | 否 | 否 | 否 | 否 |

## Service Account 建议

- 每个 Hermes 部署或仪器组使用一个独立 service account。
- 每个 service account 绑定明确的项目 allowlist。
- 保存 token 元数据：负责人、用途、创建时间、过期时间、最后使用时间、允许的 `agent_id`。
- 定期轮换 token；项目人员变更后立即轮换。
- 优先使用短期 access token，并搭配可撤销的 refresh token 或 API secret。
- 每次接收或拒绝导入请求都应记录：`agent_id`、service account id、项目范围、数据包摘要和 request id。

## 管理员控制项

管理员应能够：

- 全局启用或停用 agent 导入。
- 启用或停用指定 service account。
- 配置最大压缩包大小、最大解压后大小、每包最大文件数量、每小时最大导入作业数量。
- 查看导入历史和错误。
- 审核错误后重新排队或取消失败作业。

## 默认策略

默认使用显式项目 allowlist。若一个数据包引用多个项目，只有 service account 对全部项目都有权限时才允许继续；否则返回 `PROJECT_SCOPE_DENIED`。
