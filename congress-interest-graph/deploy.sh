#!/bin/bash

# 美国国会利益关联图谱系统 - 一键部署脚本
# 使用方法: ./deploy.sh [dev|prod]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    print_info "检查依赖..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    print_success "依赖检查通过"
}

# 检查环境变量文件
check_env() {
    if [ ! -f .env ]; then
        print_warning ".env 文件不存在，正在从 .env.example 创建..."
        if [ -f .env.example ]; then
            cp .env.example .env
            print_warning "请编辑 .env 文件配置数据库密码等信息"
        else
            print_error ".env.example 文件不存在"
            exit 1
        fi
    fi
}

# 启动开发环境
start_dev() {
    print_info "启动开发环境..."
    
    # 启动服务
    docker compose up --build -d
    
    print_info "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    docker compose ps
    
    print_success "开发环境启动成功！"
    print_info "前端地址: http://localhost:3000"
    print_info "API 文档: http://localhost:8000/docs"
    print_info "Neo4j 浏览器: http://localhost:7474"
}

# 启动生产环境
start_prod() {
    print_info "启动生产环境..."
    
    # 检查 nginx 配置
    if [ ! -d nginx ]; then
        mkdir -p nginx
    fi
    
    # 启动服务
    docker compose -f docker-compose.prod.yml up --build -d
    
    print_info "等待服务启动..."
    sleep 45
    
    # 检查服务状态
    docker compose -f docker-compose.prod.yml ps
    
    print_success "生产环境启动成功！"
    print_info "访问地址: http://localhost"
    print_info "API 文档: http://localhost/docs"
}

# 初始化数据
init_data() {
    print_info "初始化数据..."
    
    # 等待数据库就绪
    print_info "等待数据库就绪..."
    sleep 10
    
    # 导入议员数据
    print_info "导入议员基础数据..."
    docker compose exec backend python3 -m app.etl.import_real_members
    
    # 导入 FEC 数据
    print_info "导入 FEC 竞选献金数据..."
    docker compose exec backend python3 -m app.etl.import_fec_data
    
    # 导入持股数据
    print_info "导入持股披露数据..."
    docker compose exec backend python3 -m app.etl.import_holdings
    
    # 导入议员档案
    print_info "导入议员档案数据..."
    docker compose exec backend python3 -m app.etl.import_congress_profiles
    
    print_success "数据初始化完成！"
}

# 停止服务
stop() {
    print_info "停止服务..."
    docker compose down
    print_success "服务已停止"
}

# 停止生产环境
stop_prod() {
    print_info "停止生产环境..."
    docker compose -f docker-compose.prod.yml down
    print_success "生产环境已停止"
}

# 查看日志
logs() {
    docker compose logs -f
}

# 查看生产环境日志
logs_prod() {
    docker compose -f docker-compose.prod.yml logs -f
}

# 清理资源
cleanup() {
    print_warning "这将删除所有容器、网络和数据卷"
    read -p "确认继续？(y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        docker compose down -v
        docker system prune -a
        print_success "清理完成"
    else
        print_info "取消清理"
    fi
}

# 备份数据库
backup() {
    print_info "备份数据库..."
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    docker compose exec postgres pg_dump -U congress_user congress_graph > "$BACKUP_FILE"
    print_success "备份完成: $BACKUP_FILE"
}

# 恢复数据库
restore() {
    if [ -z "$1" ]; then
        print_error "请指定备份文件: ./deploy.sh restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$1" ]; then
        print_error "备份文件不存在: $1"
        exit 1
    fi
    
    print_info "恢复数据库: $1"
    docker compose exec -T postgres psql -U congress_user congress_graph < "$1"
    print_success "恢复完成"
}

# 更新项目
update() {
    print_info "更新项目..."
    git pull origin master
    docker compose down
    docker compose up --build -d
    print_success "更新完成"
}

# 显示帮助
show_help() {
    echo "美国国会利益关联图谱系统 - 部署脚本"
    echo ""
    echo "使用方法:"
    echo "  ./deploy.sh <command>"
    echo ""
    echo "命令:"
    echo "  dev          启动开发环境"
    echo "  prod         启动生产环境"
    echo "  init         初始化数据"
    echo "  stop         停止开发环境"
    echo "  stop-prod    停止生产环境"
    echo "  logs         查看开发环境日志"
    echo "  logs-prod    查看生产环境日志"
    echo "  backup       备份数据库"
    echo "  restore      恢复数据库"
    echo "  update       更新项目"
    echo "  cleanup      清理所有资源"
    echo "  help         显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh dev          # 启动开发环境"
    echo "  ./deploy.sh prod         # 启动生产环境"
    echo "  ./deploy.sh init         # 初始化数据"
    echo "  ./deploy.sh backup       # 备份数据库"
    echo "  ./deploy.sh restore backup_20240101_120000.sql"
}

# 主函数
main() {
    # 检查依赖
    check_dependencies
    
    # 检查环境变量
    check_env
    
    # 解析命令
    case "${1:-help}" in
        dev)
            start_dev
            ;;
        prod)
            start_prod
            ;;
        init)
            init_data
            ;;
        stop)
            stop
            ;;
        stop-prod)
            stop_prod
            ;;
        logs)
            logs
            ;;
        logs-prod)
            logs_prod
            ;;
        backup)
            backup
            ;;
        restore)
            restore "$2"
            ;;
        update)
            update
            ;;
        cleanup)
            cleanup
            ;;
        help|*)
            show_help
            ;;
    esac
}

# 执行主函数
main "$@"
