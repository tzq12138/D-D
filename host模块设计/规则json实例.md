> 说明：本文件是 JSON5/受限 DSL 示例，不是严格 JSON。生产实现不得 eval `condition` 字符串；应解释白名单算子，或调用规则插件 handler。

```json5
{
  "system_id": "coc_7th",
  "system_name": "Call of Cthulhu 7th Edition",
  "version": "1.0.0",

  "base_mechanic": {
    "dice": "1d100",
    "objective": "roll_under",
    "evaluation_order": "sequential" // 必须按 resolutions 数组顺序从上往下判定
  },

  "difficulties": {
    "regular": { "multiplier": 1.0, "description": "常规难度" },
    "hard": { "multiplier": 0.5, "description": "困难难度(半值)", "rounding": "floor" },
    "extreme": { "multiplier": 0.2, "description": "极难难度(五分之一值)", "rounding": "floor" }
  },

  "resolutions": [
    {
      "result_id": "critical_success",
      "label": "大成功",
      "condition": { "op": "eq", "left": { "var": "roll" }, "right": 1 }
    },
    {
      "result_id": "fumble",
      "label": "大失败",
      "condition": {
        "op": "or",
        "args": [
          {
            "op": "and",
            "args": [
              { "op": "lt", "left": { "var": "base_target" }, "right": 50 },
              { "op": "gte", "left": { "var": "roll" }, "right": 96 }
            ]
          },
          { "op": "eq", "left": { "var": "roll" }, "right": 100 }
        ]
      }
    },
    {
      "result_id": "extreme_success",
      "label": "极难成功",
      "condition": {
        "op": "lte",
        "left": { "var": "roll" },
        "right": { "op": "floor_mul", "value": { "var": "base_target" }, "factor": 0.2 }
      }
    },
    {
      "result_id": "hard_success",
      "label": "困难成功",
      "condition": {
        "op": "lte",
        "left": { "var": "roll" },
        "right": { "op": "floor_mul", "value": { "var": "base_target" }, "factor": 0.5 }
      }
    },
    {
      "result_id": "regular_success",
      "label": "成功",
      "condition": { "op": "lte", "left": { "var": "roll" }, "right": { "var": "target" } }
    },
    {
      "result_id": "failure",
      "label": "失败",
      "condition": { "op": "gt", "left": { "var": "roll" }, "right": { "var": "target" } }
    }
  ],

  "modifiers": {
    "bonus_penalty_dice": {
      "handler": "coc_7th.bonus_penalty_tens_replacement",
      "max_stack": 2, // 规则书建议最多叠加2个奖惩骰
      "description": "掷额外的十位骰，奖励骰取小，惩罚骰取大"
    }
  },

  "special_rules": {
    "push_roll": {
      "allowed": true,
      // 只有常规判定失败，且非战斗/理智检定（san_check）时，才允许孤注一掷
      "condition": {
        "op": "and",
        "args": [
          { "op": "eq", "left": { "var": "previous_result_id" }, "right": "failure" },
          { "op": "not", "arg": { "var": "in_combat" } },
          { "op": "neq", "left": { "var": "check_type" }, "right": "san" }
        ]
      }
    },
    "luck_spending": {
      "allowed": true,
      // 消耗幸运改判：大失败和理智检定不能用幸运修改
      "condition": {
        "op": "and",
        "args": [
          { "op": "neq", "left": { "var": "previous_result_id" }, "right": "fumble" },
          { "op": "neq", "left": { "var": "check_type" }, "right": "san" },
          { "op": "neq", "left": { "var": "check_type" }, "right": "luck" }
        ]
      }
    }
  }
}
```
