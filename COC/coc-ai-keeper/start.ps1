# COC AI Keeper 一键启动脚本 (Windows)
# 用法：右键 -> 使用 PowerShell 运行，或在终端中执行 .\start.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== COC AI Keeper 启动脚本 ===" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js 版本
Write-Host "[1/4] 检查 Node.js 版本..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($versionNumber -lt 18) {
        Write-Host "错误：需要 Node.js 18 或更高版本，当前版本为 $nodeVersion" -ForegroundColor Red
        Write-Host "请访问 https://nodejs.org/ 下载并安装最新版本" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Node.js 版本：$nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "错误：未找到 Node.js，请先安装 Node.js 18 或更高版本" -ForegroundColor Red
    Write-Host "请访问 https://nodejs.org/ 下载并安装" -ForegroundColor Red
    exit 1
}

# 进入项目目录
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$scriptPath\coc-ai-keeper"

# 检查并安装依赖
Write-Host "[2/4] 检查项目依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "  首次运行，正在安装依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误：依赖安装失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "  依赖安装完成" -ForegroundColor Green
} else {
    Write-Host "  依赖已安装" -ForegroundColor Green
}

# 检查 .env 文件
Write-Host "[3/4] 检查环境配置..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "  未找到 .env 文件，将使用默认配置（模拟AI模式）" -ForegroundColor Yellow
    Write-Host "  如需使用 DeepSeek API，请复制 .env.example 为 .env 并填写 API Key" -ForegroundColor Yellow
} else {
    Write-Host "  .env 文件已存在" -ForegroundColor Green
}

# 启动开发服务器
Write-Host "[4/4] 启动开发服务器..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COC AI Keeper 即将启动" -ForegroundColor Cyan
Write-Host "  客户端地址：http://127.0.0.1:5173" -ForegroundColor Cyan
Write-Host "  服务端地址：http://127.0.0.1:3001" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 自动打开浏览器
Start-Process "http://127.0.0.1:5173"

# 启动开发服务器
npm run dev
