#!/bin/bash
# COC AI Keeper 一键启动脚本 (macOS / Linux)
# 用法：chmod +x start.sh && ./start.sh

set -e

echo "=== COC AI Keeper 启动脚本 ==="
echo ""

# 检查 Node.js 版本
echo "[1/4] 检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    echo "错误：未找到 Node.js，请先安装 Node.js 18 或更高版本"
    echo "请访问 https://nodejs.org/ 下载并安装"
    exit 1
fi

NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "错误：需要 Node.js 18 或更高版本，当前版本为 $NODE_VERSION"
    echo "请访问 https://nodejs.org/ 下载并安装最新版本"
    exit 1
fi
echo "  Node.js 版本：$NODE_VERSION"

# 进入项目目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/coc-ai-keeper"

# 检查并安装依赖
echo "[2/4] 检查项目依赖..."
if [ ! -d "node_modules" ]; then
    echo "  首次运行，正在安装依赖..."
    npm install
    echo "  依赖安装完成"
else
    echo "  依赖已安装"
fi

# 检查 .env 文件
echo "[3/4] 检查环境配置..."
if [ ! -f ".env" ]; then
    echo "  未找到 .env 文件，将使用默认配置（模拟AI模式）"
    echo "  如需使用 DeepSeek API，请复制 .env.example 为 .env 并填写 API Key"
else
    echo "  .env 文件已存在"
fi

# 启动开发服务器
echo "[4/4] 启动开发服务器..."
echo ""
echo "========================================"
echo "  COC AI Keeper 即将启动"
echo "  客户端地址：http://127.0.0.1:5173"
echo "  服务端地址：http://127.0.0.1:3001"
echo "========================================"
echo ""

# 自动打开浏览器
if command -v open &> /dev/null; then
    open "http://127.0.0.1:5173"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://127.0.0.1:5173"
fi

# 启动开发服务器
npm run dev
