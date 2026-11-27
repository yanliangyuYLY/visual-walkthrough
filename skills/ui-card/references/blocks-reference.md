# UI Card 13 类积木详细示例参考

作者：a

本参考文件供按需查阅，避免在主 `SKILL.md` 中占据常驻上下文。

## 1. Code Review 综合卡（`metrics` + `tabs` + `findings` + `diff`）

```json
{
  "title": "Code Review：用户认证模块排查",
  "subtitle": "勾选需要修复的问题或行内添加批注后一键提交",
  "commentable": true,
  "allowCustomInput": true,
  "blocks": [
    {
      "type": "metrics",
      "items": [
        { "label": "高危问题", "value": "1 项", "tone": "bad" },
        { "label": "中危建议", "value": "1 项", "tone": "warn" },
        { "label": "单测覆盖", "value": "94%", "delta": "+3%", "tone": "good" }
      ]
    },
    {
      "type": "tabs",
      "defaultTab": "findings",
      "tabs": [
        {
          "id": "findings",
          "label": "问题清单",
          "badge": "2",
          "blocks": [
            {
              "type": "findings",
              "selectable": true,
              "commentable": true,
              "submitLabel": "修复已勾选问题",
              "items": [
                {
                  "severity": "high",
                  "title": "未校验 user.email 为空导致异常",
                  "fileRef": "src/auth/login.ts:41",
                  "fileUri": "file:///abs/path/src/auth/login.ts",
                  "rule": "null-safety",
                  "detail": "SSO 回调可能缺少 `email` 字段，直接 `.toLowerCase()` 会抛 `TypeError`。",
                  "fixIsDiff": true,
                  "fix": "@@ -40,3 +40,3 @@\n export function norm(user: User) {\n-  return user.email.toLowerCase();\n+  return (user.email ?? \"\").trim().toLowerCase();\n }",
                  "defaultSelected": true
                }
              ]
            }
          ]
        },
        {
          "id": "patch",
          "label": "完整补丁 Diff",
          "blocks": [
            {
              "type": "diff",
              "title": "空邮箱兜底补丁",
              "fileRef": "src/auth/login.ts",
              "fileUri": "file:///abs/path/src/auth/login.ts",
              "patch": "--- a/src/auth/login.ts\n+++ b/src/auth/login.ts\n@@ -40,3 +40,3 @@\n export function norm(user: User) {\n-  return user.email.toLowerCase();\n+  return (user.email ?? \"\").trim().toLowerCase();\n }"
            }
          ]
        }
      ]
    }
  ]
}
```

## 2. 实施计划审批卡（`plan`）

```json
{
  "title": "接口限流改造实施计划",
  "allowCustomInput": true,
  "blocks": [
    {
      "type": "plan",
      "commentable": true,
      "submitLabel": "批准并开始实施",
      "steps": [
        {
          "title": "封装按 Host 隔离的令牌桶",
          "detail": "避免单个慢上游阻塞其余域名的并发请求。",
          "files": [{ "fileRef": "src/net/limiter.ts", "fileUri": "file:///abs/path/src/net/limiter.ts" }],
          "risk": "high",
          "estimate": "2h"
        },
        {
          "title": "补充弱网重试微提示",
          "risk": "low",
          "estimate": "30m",
          "optional": true,
          "defaultChecked": false
        }
      ]
    }
  ]
}
```

## 3. 加权技术选型卡（`decision` + `queue`）

```json
{
  "title": "任务队列方案对比",
  "blocks": [
    {
      "type": "decision",
      "submitLabel": "采用当前首选方案",
      "criteria": [
        { "name": "吞吐量", "weight": 2 },
        { "name": "运维成本", "weight": 4, "note": "小团队优先减少基础设施" },
        { "name": "事务一致性", "weight": 3 }
      ],
      "options": [
        {
          "name": "pg-boss",
          "scores": [4, 5, 5],
          "recommended": true,
          "pros": ["复用现有 Postgres", "与业务写同一事务提交"],
          "cons": ["极高 QPS 下轮询有额外开销"],
          "actionText": "采用 pg-boss 接入异步任务队列，复用现有 Postgres。"
        },
        {
          "name": "BullMQ",
          "scores": [5, 2, 3],
          "pros": ["低延迟、内置速率限制与延迟任务"],
          "cons": ["需额外运维持久化 Redis"],
          "actionText": "采用 BullMQ + Redis 接入异步任务队列。"
        }
      ]
    },
    {
      "type": "actions",
      "buttons": [
        {
          "label": "暂存：先跑本地压测",
          "variant": "secondary",
          "action": {
            "type": "queue",
            "label": "先补压测",
            "text": "最终实施前请先编写脚本对两种队列做本地吞吐压测。"
          }
        }
      ]
    }
  ]
}
```
