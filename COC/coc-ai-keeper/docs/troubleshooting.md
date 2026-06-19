# COC AI Keeper 故障排除指南

## 安装问题

### npm install 失败

**症状**：执行 `npm install` 时出现错误

**可能原因**：
1. Node.js 版本过低
2. 网络连接问题
3. npm 缓存损坏

**解决方案**：

```bash
# 检查 Node.js 版本（需要 18+）
node --version

# 清除 npm 缓存
npm cache clean --force

# 删除 node_modules 并重新安装
rm -rf node_modules package-lock.json
npm install

# 如果网络问题，尝试使用淘宝镜像
npm install --registry=https://registry.npmmirror.com
```

### 缺少 Python 环境

**症状**：安装某些依赖时提示需要 Python

**解决方案**：
- Windows 用户：安装 Python 3.x 并添加到 PATH
- macOS 用户：`brew install python3`
- Linux 用户：`sudo apt install python3` 或 `sudo dnf install python3`

## 启动问题

### 端口被占用

**症状**：启动时提示 `EADDRINUSE: address already in use :::3001`

**解决方案**：

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS / Linux
lsof -i :3001
kill -9 <PID>

# 或者修改端口
# 在 .env 文件中添加：PORT=3002
```

### DeepSeek API Key 配置错误

**症状**：AI 回应生成失败，提示 API 错误

**解决方案**：
1. 检查 `.env` 文件中的 API Key 是否正确
2. 确认 API Key 有足够的额度
3. 检查网络连接是否正常
4. 如果问题持续，删除 `DEEPSEEK_API_KEY` 配置，使用模拟 AI

### 客户端无法连接服务端

**症状**：浏览器页面空白或提示连接错误

**解决方案**：
1. 确认服务端已启动（检查终端输出）
2. 检查防火墙设置
3. 确认端口没有被占用
4. 尝试访问 http://127.0.0.1:3001/api/health 检查服务端状态

## 功能问题

### 资料导入失败

**症状**：上传资料文件后提示导入失败

**可能原因**：
1. 文件格式不支持（仅支持 .md、.txt、.pdf）
2. 文件编码问题
3. 文件过大

**解决方案**：
1. 确认文件格式正确
2. 将文件转换为 UTF-8 编码
3. 将大文件拆分为多个小文件
4. 检查 `sources` 目录权限

### 角色卡导入失败

**症状**：上传 XLSX 角色卡后提示导入失败

**可能原因**：
1. XLSX 格式不符合 COC 7e 标准
2. 文件损坏
3. 工作表名称不正确

**解决方案**：
1. 使用标准的 COC 7e 角色卡模板
2. 检查文件是否可以正常打开
3. 确认工作表名称包含"人物卡"或"简化卡"
4. 尝试使用 JSON 格式的角色卡

### AI 回应生成失败

**症状**：提交行动后，AI 没有生成回应

**可能原因**：
1. DeepSeek API 调用失败
2. 网络连接问题
3. API 配额耗尽

**解决方案**：
1. 检查终端是否有错误日志
2. 确认网络连接正常
3. 如果使用 DeepSeek API，检查配额是否充足
4. 删除 `DEEPSEEK_API_KEY` 配置，使用模拟 AI

### 掷骰结果不正确

**症状**：掷骰结果与预期不符

**可能原因**：
1. 技能值设置错误
2. 检定难度理解错误
3. 系统 Bug

**解决方案**：
1. 检查角色卡中的技能值是否正确
2. 确认检定难度（常规、困难、极难）的定义
3. 如果怀疑是 Bug，请记录详细的重现步骤并反馈

## 性能问题

### 消息流卡顿

**症状**：消息列表滚动不流畅

**可能原因**：
1. 消息数量过多
2. 浏览器性能不足
3. 网络延迟

**解决方案**：
1. 刷新页面重新加载
2. 关闭其他占用资源的标签页
3. 检查网络连接

### AI 回应生成缓慢

**症状**：提交行动后等待很长时间才收到回应

**可能原因**：
1. DeepSeek API 响应慢
2. 网络延迟
3. 资料库过大

**解决方案**：
1. 检查网络连接
2. 如果使用 DeepSeek API，可能是服务器繁忙，稍后重试
3. 减少资料库中的文件数量
4. 使用模拟 AI 模式（删除 DEEPSEEK_API_KEY 配置）

## 兼容性问题

### 浏览器兼容性

**支持的浏览器**：
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**不支持的浏览器**：
- Internet Explorer
- 旧版浏览器

**解决方案**：
- 更新浏览器到最新版本
- 使用推荐的浏览器

### 操作系统兼容性

**支持的操作系统**：
- Windows 10/11
- macOS 11+
- Linux（Ubuntu 20.04+, Debian 10+）

**已知问题**：
- 某些 Linux 发行版可能需要手动安装依赖
- macOS Apple Silicon 可能需要 Rosetta 2

## 获取帮助

如果以上方法都无法解决问题：

1. 查看终端输出的错误日志
2. 检查浏览器的开发者控制台（F12）
3. 搜索项目的 GitHub Issues
4. 创建新的 Issue 并附上详细的错误信息

**反馈模板**：
```
## 问题描述
[简要描述问题]

## 重现步骤
1. [步骤 1]
2. [步骤 2]
3. [步骤 3]

## 期望行为
[描述你期望的正确行为]

## 实际行为
[描述实际发生的行为]

## 环境信息
- 操作系统：[Windows/macOS/Linux]
- Node.js 版本：[版本号]
- 浏览器：[Chrome/Firefox/Safari/Edge]

## 错误日志
[粘贴终端或浏览器控制台的错误信息]
```
