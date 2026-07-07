import { executeCommand, executeSudoCommand, executeShellCommand } from '../core/command'
import { logger } from '../core/logger'

export interface DockerStatus {
  installed: boolean
  version?: string
  running: boolean
  composeInstalled: boolean
  composeVersion?: string
}

export interface ServiceStatus {
  name: string
  installed: boolean
  version?: string
  running: boolean
}

export interface SystemServices {
  docker: DockerStatus
  nginx: ServiceStatus
  apache: ServiceStatus
  php: ServiceStatus
  mysql: ServiceStatus
}

export interface InstallationResult {
  success: boolean
  message: string
  logs: string[]
}

type LogCallback = (log: string) => void

async function checkServiceStatus(name: string, command: string, args: string[] = ['--version']): Promise<ServiceStatus> {
  const result: ServiceStatus = {
    name,
    installed: false,
    running: false
  }

  try {
    const versionResult = await executeCommand(command, args)
    if (versionResult.stdout) {
      result.installed = true
      result.version = versionResult.stdout.trim()
    }
  } catch {
    result.installed = false
  }

  try {
    const statusResult = await executeSudoCommand('systemctl', ['is-active', name])
    result.running = statusResult.stdout.trim() === 'active'
  } catch {
    result.running = false
  }

  return result
}

export async function checkDockerStatus(): Promise<DockerStatus> {
  const result: DockerStatus = {
    installed: false,
    running: false,
    composeInstalled: false
  }

  try {
    const dockerVersionResult = await executeCommand('docker', ['--version'])
    if (dockerVersionResult.stdout) {
      result.installed = true
      result.version = dockerVersionResult.stdout.trim()
    }
  } catch {
    result.installed = false
  }

  try {
    const dockerInfoResult = await executeCommand('docker', ['info'])
    if (dockerInfoResult.stdout) {
      result.running = true
    }
  } catch {
    result.running = false
  }

  try {
    const composeVersionResult = await executeCommand('docker', ['compose', 'version'])
    if (composeVersionResult.stdout) {
      result.composeInstalled = true
      result.composeVersion = composeVersionResult.stdout.trim()
    }
  } catch {
    try {
      const composeVersionResult = await executeCommand('docker-compose', ['--version'])
      if (composeVersionResult.stdout) {
        result.composeInstalled = true
        result.composeVersion = composeVersionResult.stdout.trim()
      }
    } catch {
      result.composeInstalled = false
    }
  }

  return result
}

export async function getAllServicesStatus(): Promise<SystemServices> {
  return {
    docker: await checkDockerStatus(),
    nginx: await checkServiceStatus('nginx', 'nginx', ['-v']),
    apache: await checkServiceStatus('apache2', 'apache2', ['-v']),
    php: await checkPHPStatus(),
    mysql: await checkServiceStatus('mysql', 'mysql', ['--version'])
  }
}

async function checkPHPStatus(): Promise<ServiceStatus> {
  const result: ServiceStatus = {
    name: 'php',
    installed: false,
    running: false
  }

  try {
    const versionResult = await executeCommand('php', ['-v'])
    if (versionResult.stdout) {
      result.installed = true
      result.version = versionResult.stdout.trim()
    }
  } catch {
    result.installed = false
  }

  try {
    const fpmStatusResult = await executeSudoCommand('systemctl', ['is-active', 'php*-fpm'])
    result.running = fpmStatusResult.stdout.trim() === 'active'
  } catch {
    result.running = false
  }

  return result
}

export async function installDocker(mirror: 'official' | 'aliyun' | 'daocloud' = 'official', logCallback?: LogCallback): Promise<InstallationResult> {
  const logs: string[] = []
  
  const mirrors = {
    official: {
      name: '官方镜像',
      gpgUrl: 'https://download.docker.com/linux/ubuntu/gpg',
      repoUrl: 'https://download.docker.com/linux'
    },
    aliyun: {
      name: '阿里云镜像',
      gpgUrl: 'https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg',
      repoUrl: 'https://mirrors.aliyun.com/docker-ce/linux'
    },
    daocloud: {
      name: 'DaoCloud镜像',
      gpgUrl: 'https://download.docker.com/linux/ubuntu/gpg',
      repoUrl: 'https://mirrors.daocloud.io/docker-ce/linux'
    }
  }
  
  const selectedMirror = mirrors[mirror] || mirrors.official
  
  const pushLog = (log: string) => {
    logs.push(log)
    logCallback?.(log)
  }
  
  try {
    logger.info('Starting Docker installation')
    pushLog(`[INFO] 开始安装 Docker (镜像源: ${selectedMirror.name})`)

    pushLog('[STEP] 执行 apt-get update...')
    await executeShellCommand('apt-get update', pushLog)
    pushLog('[DONE] apt-get update 完成')

    pushLog('[STEP] 安装依赖包...')
    await executeShellCommand('apt-get install -y ca-certificates curl gnupg lsb-release', pushLog)
    pushLog('[DONE] 依赖包安装完成')

    pushLog('[STEP] 创建密钥目录...')
    await executeShellCommand('mkdir -p /etc/apt/keyrings')
    pushLog('[DONE] 密钥目录创建完成')

    pushLog('[STEP] 下载 Docker GPG 密钥...')
    const keyResult = await executeShellCommand(`curl -fsSL ${selectedMirror.gpgUrl}`)
    pushLog(`[INFO] 密钥长度: ${keyResult.stdout.length} 字节`)
    pushLog('[DONE] 密钥下载完成')

    pushLog('[STEP] 安装 GPG 密钥...')
    await executeShellCommand(`echo "${keyResult.stdout}" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg`)
    pushLog('[DONE] GPG 密钥安装完成')

    pushLog('[STEP] 获取系统架构...')
    const archResult = await executeShellCommand('dpkg --print-architecture')
    pushLog(`[INFO] 架构: ${archResult.stdout.trim()}`)

    pushLog('[STEP] 获取系统版本...')
    const osResult = await executeShellCommand('lsb_release -si')
    const osName = osResult.stdout.trim().toLowerCase() || 'ubuntu'
    pushLog(`[INFO] 系统: ${osName}`)
    
    pushLog('[STEP] 获取系统代号...')
    const codenameResult = await executeShellCommand('lsb_release -cs')
    const codename = codenameResult.stdout.trim()
    pushLog(`[INFO] 代号: ${codename}`)
    
    pushLog('[STEP] 添加 Docker 源...')
    await executeShellCommand(`echo "deb [arch=${archResult.stdout.trim()} signed-by=/etc/apt/keyrings/docker.gpg] ${selectedMirror.repoUrl}/${osName} ${codename} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null`)
    pushLog(`[INFO] 使用镜像源: ${selectedMirror.repoUrl}`)
    pushLog('[DONE] Docker 源添加完成')

    pushLog('[STEP] 更新软件包列表...')
    await executeShellCommand('apt-get update', pushLog)
    pushLog('[DONE] 软件包列表更新完成')

    pushLog('[STEP] 安装 Docker Engine...')
    await executeShellCommand('apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin', pushLog)
    pushLog('[DONE] Docker Engine 安装完成')

    pushLog('[STEP] 启用 Docker 服务...')
    await executeSudoCommand('systemctl', ['enable', 'docker'])
    pushLog('[DONE] Docker 服务已启用')

    pushLog('[STEP] 启动 Docker 服务...')
    await executeSudoCommand('systemctl', ['start', 'docker'])
    pushLog('[DONE] Docker 服务已启动')

    pushLog('[STEP] 配置用户组...')
    const currentUserResult = await executeShellCommand('whoami')
    await executeSudoCommand('usermod', ['-aG', 'docker', currentUserResult.stdout.trim()])
    pushLog(`[INFO] 用户 ${currentUserResult.stdout.trim()} 已添加到 docker 组`)
    pushLog('[DONE] 用户组配置完成')

    logger.info('Docker installation completed')
    pushLog('[SUCCESS] Docker 安装完成！')

    return {
      success: true,
      message: 'Docker installed successfully',
      logs
    }
  } catch (error: any) {
    const errorMessage = error.message || (error.stderr || error.stdout || 'Unknown error').toString()
    pushLog(`[ERROR] 安装失败: ${errorMessage}`)
    logger.error(`Docker installation failed: ${errorMessage}`)
    return {
      success: false,
      message: errorMessage,
      logs
    }
  }
}

export async function installDockerCompose(logCallback?: LogCallback): Promise<InstallationResult> {
  const logs: string[] = []
  
  const pushLog = (log: string) => {
    logs.push(log)
    logCallback?.(log)
  }
  
  try {
    logger.info('Starting Docker Compose installation')
    pushLog('[INFO] 开始安装 Docker Compose')

    pushLog('[STEP] 获取最新版本...')
    const latestVersionResult = await executeShellCommand('curl -s https://api.github.com/repos/docker/compose/releases/latest')
    const version = latestVersionResult.stdout.match(/"tag_name":\s*"([^"]+)"/)?.[1] || 'v2.24.0'
    pushLog(`[INFO] 最新版本: ${version}`)

    pushLog('[STEP] 下载 Docker Compose...')
    await executeShellCommand(`curl -SL https://github.com/docker/compose/releases/download/${version}/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose`, pushLog)
    pushLog('[DONE] Docker Compose 下载完成')
    
    pushLog('[STEP] 设置执行权限...')
    await executeShellCommand('chmod +x /usr/local/bin/docker-compose')
    pushLog('[DONE] 执行权限设置完成')

    logger.info('Docker Compose installation completed')
    pushLog('[SUCCESS] Docker Compose 安装完成！')

    return {
      success: true,
      message: 'Docker Compose installed successfully',
      logs
    }
  } catch (error: any) {
    const errorMessage = error.message || (error.stderr || error.stdout || 'Unknown error').toString()
    pushLog(`[ERROR] 安装失败: ${errorMessage}`)
    logger.error(`Docker Compose installation failed: ${errorMessage}`)
    return {
      success: false,
      message: errorMessage,
      logs
    }
  }
}

export async function installNginx(logCallback?: LogCallback): Promise<InstallationResult> {
  const logs: string[] = []
  
  const pushLog = (log: string) => {
    logs.push(log)
    logCallback?.(log)
  }
  
  try {
    logger.info('Starting Nginx installation')
    pushLog('[INFO] 开始安装 Nginx')

    pushLog('[STEP] 执行 apt-get update...')
    await executeShellCommand('apt-get update', pushLog)
    pushLog('[DONE] apt-get update 完成')

    pushLog('[STEP] 安装 Nginx...')
    const nginxResult = await executeShellCommand('apt-get install -y nginx', pushLog)
    pushLog('[DONE] Nginx 安装完成')

    pushLog('[STEP] 启用 Nginx 服务...')
    await executeSudoCommand('systemctl', ['enable', 'nginx'])
    pushLog('[DONE] Nginx 服务已启用')

    pushLog('[STEP] 启动 Nginx 服务...')
    await executeSudoCommand('systemctl', ['start', 'nginx'])
    pushLog('[DONE] Nginx 服务已启动')

    pushLog('[STEP] 配置防火墙规则...')
    await executeShellCommand('ufw allow "Nginx Full"')
    pushLog('[DONE] 防火墙规则配置完成')

    logger.info('Nginx installation completed')
    pushLog('[SUCCESS] Nginx 安装完成！')

    return {
      success: true,
      message: 'Nginx installed successfully',
      logs
    }
  } catch (error: any) {
    const errorMessage = error.message || (error.stderr || error.stdout || 'Unknown error').toString()
    pushLog(`[ERROR] 安装失败: ${errorMessage}`)
    logger.error(`Nginx installation failed: ${errorMessage}`)
    return {
      success: false,
      message: errorMessage,
      logs
    }
  }
}

export async function installApache(logCallback?: LogCallback): Promise<InstallationResult> {
  const logs: string[] = []
  
  const pushLog = (log: string) => {
    logs.push(log)
    logCallback?.(log)
  }
  
  try {
    logger.info('Starting Apache installation')
    pushLog('[INFO] 开始安装 Apache')

    pushLog('[STEP] 执行 apt-get update...')
    await executeShellCommand('apt-get update', pushLog)
    pushLog('[DONE] apt-get update 完成')

    pushLog('[STEP] 安装 Apache...')
    const apacheResult = await executeShellCommand('apt-get install -y apache2', pushLog)
    pushLog('[DONE] Apache 安装完成')

    pushLog('[STEP] 启用 Apache 服务...')
    await executeSudoCommand('systemctl', ['enable', 'apache2'])
    pushLog('[DONE] Apache 服务已启用')

    pushLog('[STEP] 启动 Apache 服务...')
    await executeSudoCommand('systemctl', ['start', 'apache2'])
    pushLog('[DONE] Apache 服务已启动')

    pushLog('[STEP] 配置防火墙规则...')
    await executeShellCommand('ufw allow "Apache Full"')
    pushLog('[DONE] 防火墙规则配置完成')

    logger.info('Apache installation completed')
    pushLog('[SUCCESS] Apache 安装完成！')

    return {
      success: true,
      message: 'Apache installed successfully',
      logs
    }
  } catch (error: any) {
    const errorMessage = error.message || (error.stderr || error.stdout || 'Unknown error').toString()
    pushLog(`[ERROR] 安装失败: ${errorMessage}`)
    logger.error(`Apache installation failed: ${errorMessage}`)
    return {
      success: false,
      message: errorMessage,
      logs
    }
  }
}

export async function installPHP(version: string = '8.3', logCallback?: LogCallback): Promise<InstallationResult> {
  const logs: string[] = []
  
  const pushLog = (log: string) => {
    logs.push(log)
    logCallback?.(log)
  }
  
  try {
    logger.info(`Starting PHP ${version} installation`)
    pushLog(`[INFO] 开始安装 PHP ${version}`)

    pushLog('[STEP] 执行 apt-get update...')
    await executeShellCommand('apt-get update', pushLog)
    pushLog('[DONE] apt-get update 完成')

    pushLog('[STEP] 安装软件属性工具...')
    await executeShellCommand('apt-get install -y software-properties-common', pushLog)
    pushLog('[DONE] 软件属性工具安装完成')
    
    pushLog('[STEP] 添加 Ondrej PHP PPA...')
    await executeShellCommand('add-apt-repository -y ppa:ondrej/php', pushLog)
    pushLog('[DONE] PPA 添加完成')

    pushLog('[STEP] 更新软件包列表...')
    await executeShellCommand('apt-get update', pushLog)
    pushLog('[DONE] 软件包列表更新完成')

    pushLog(`[STEP] 安装 PHP ${version} 及扩展...`)
    const phpResult = await executeShellCommand(`apt-get install -y php${version} php${version}-fpm php${version}-mysql php${version}-curl php${version}-gd php${version}-mbstring php${version}-xml php${version}-zip`, pushLog)
    pushLog(`[DONE] PHP ${version} 及扩展安装完成`)

    pushLog(`[STEP] 启用 PHP-FPM 服务...`)
    await executeSudoCommand('systemctl', ['enable', `php${version}-fpm`])
    pushLog(`[DONE] PHP-FPM ${version} 服务已启用`)

    pushLog(`[STEP] 启动 PHP-FPM 服务...`)
    await executeSudoCommand('systemctl', ['start', `php${version}-fpm`])
    pushLog(`[DONE] PHP-FPM ${version} 服务已启动`)

    logger.info(`PHP ${version} installation completed`)
    pushLog(`[SUCCESS] PHP ${version} 安装完成！`)

    return {
      success: true,
      message: `PHP ${version} installed successfully`,
      logs
    }
  } catch (error: any) {
    const errorMessage = error.message || (error.stderr || error.stdout || 'Unknown error').toString()
    pushLog(`[ERROR] 安装失败: ${errorMessage}`)
    logger.error(`PHP ${version} installation failed: ${errorMessage}`)
    return {
      success: false,
      message: errorMessage,
      logs
    }
  }
}

export async function installMySQL(logCallback?: LogCallback): Promise<InstallationResult> {
  const logs: string[] = []
  
  const pushLog = (log: string) => {
    logs.push(log)
    logCallback?.(log)
  }
  
  try {
    logger.info('Starting MySQL installation')
    pushLog('[INFO] 开始安装 MySQL')

    pushLog('[STEP] 执行 apt-get update...')
    await executeShellCommand('apt-get update', pushLog)
    pushLog('[DONE] apt-get update 完成')
    
    pushLog('[STEP] 设置 MySQL root 密码...')
    await executeShellCommand('echo "mysql-server mysql-server/root_password password lpanel@123" | debconf-set-selections')
    await executeShellCommand('echo "mysql-server mysql-server/root_password_again password lpanel@123" | debconf-set-selections')
    pushLog('[DONE] MySQL 密码设置完成')

    pushLog('[STEP] 安装 MySQL Server...')
    const mysqlResult = await executeShellCommand('apt-get install -y mysql-server', pushLog)
    pushLog('[DONE] MySQL Server 安装完成')

    pushLog('[STEP] 启用 MySQL 服务...')
    await executeSudoCommand('systemctl', ['enable', 'mysql'])
    pushLog('[DONE] MySQL 服务已启用')

    pushLog('[STEP] 启动 MySQL 服务...')
    await executeSudoCommand('systemctl', ['start', 'mysql'])
    pushLog('[DONE] MySQL 服务已启动')

    pushLog('[STEP] 配置防火墙规则...')
    await executeShellCommand('ufw allow mysql')
    pushLog('[DONE] 防火墙规则配置完成')

    pushLog('[STEP] 配置 MySQL 认证方式...')
    await executeShellCommand('mysql -u root -plpanel@123 -e "ALTER USER \'root\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'lpanel@123\'; FLUSH PRIVILEGES;"')
    pushLog('[DONE] MySQL 认证方式配置完成')

    logger.info('MySQL installation completed')
    pushLog('[SUCCESS] MySQL 安装完成！')

    return {
      success: true,
      message: 'MySQL installed successfully',
      logs
    }
  } catch (error: any) {
    const errorMessage = error.message || (error.stderr || error.stdout || 'Unknown error').toString()
    pushLog(`[ERROR] 安装失败: ${errorMessage}`)
    logger.error(`MySQL installation failed: ${errorMessage}`)
    return {
      success: false,
      message: errorMessage,
      logs
    }
  }
}