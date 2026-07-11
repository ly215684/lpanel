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

export async function startDocker(pushLog?: (log: string) => void): Promise<void> {
  pushLog?.('[STEP] 尝试启动 Docker 服务...')
  
  pushLog?.('[STEP] 检查 containerd 服务状态...')
  try {
    const containerdStatus = await executeShellCommand('systemctl status containerd 2>&1 || true')
    if (containerdStatus.stdout.includes('active (running)')) {
      pushLog?.('[DONE] containerd 服务正在运行')
    } else {
      pushLog?.('[WARN] containerd 服务未运行，尝试启动...')
      await executeSudoCommand('systemctl', ['start', 'containerd'])
      pushLog?.('[DONE] containerd 服务已启动')
    }
  } catch {
    pushLog?.('[WARN] 无法检查或启动 containerd 服务')
  }
  
  pushLog?.('[STEP] 检查 containerd socket...')
  try {
    const socketCheck = await executeShellCommand('ls -la /run/containerd/containerd.sock 2>&1 || true')
    if (socketCheck.stdout.includes('containerd.sock')) {
      pushLog?.('[DONE] containerd socket 存在')
    } else {
      pushLog?.('[WARN] containerd socket 不存在')
      pushLog?.(socketCheck.stdout)
    }
  } catch {
    pushLog?.('[WARN] 无法检查 containerd socket')
  }
  
  pushLog?.('[STEP] 检查 docker.socket...')
  try {
    const socketStatus = await executeShellCommand('systemctl status docker.socket 2>&1 || true')
    if (socketStatus.stdout.includes('active (running)')) {
      pushLog?.('[DONE] docker.socket 正在运行')
    } else {
      pushLog?.('[WARN] docker.socket 未运行，尝试启动...')
      await executeSudoCommand('systemctl', ['start', 'docker.socket'])
      pushLog?.('[DONE] docker.socket 已启动')
    }
  } catch {
    pushLog?.('[WARN] 无法检查或启动 docker.socket')
  }
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      pushLog?.(`[STEP] 第 ${attempt} 次尝试启动 Docker...`)
      await executeSudoCommand('systemctl', ['start', 'docker'])
      pushLog?.('[DONE] Docker 服务启动成功')
      
      pushLog?.('[STEP] 验证 Docker 是否正常运行...')
      const verifyResult = await executeShellCommand('docker info 2>&1 | head -5 || true')
      pushLog?.(verifyResult.stdout)
      return
    } catch (error: any) {
      pushLog?.(`[WARN] 第 ${attempt} 次启动失败: ${error.message}`)
      
      pushLog?.('[STEP] 获取 Docker 服务日志以诊断问题...')
      const journalResult = await executeShellCommand('journalctl -u docker --no-pager -n 30 2>&1 || true')
      pushLog?.(`[INFO] Docker 日志:\n${journalResult.stdout}`)
      
      if (attempt < 3) {
        pushLog?.('[STEP] 重置 systemd 失败状态...')
        await executeSudoCommand('systemctl', ['reset-failed', 'docker'])
        pushLog?.('[DONE] systemd 状态已重置')
        
        pushLog?.('[STEP] 重新加载 systemd 配置...')
        await executeSudoCommand('systemctl', ['daemon-reload'])
        pushLog?.('[DONE] systemd 配置已重新加载')
        
        pushLog?.('[STEP] 检查并修复 daemon.json 配置...')
        await fixDockerConfig(pushLog, attempt)
        pushLog?.('[DONE] 配置修复完成')
        
        pushLog?.('[STEP] 等待 3 秒后重试...')
        await new Promise(resolve => setTimeout(resolve, 3000))
      } else {
        pushLog?.('[ERROR] Docker 服务启动失败')
        const statusResult = await executeShellCommand('systemctl status docker 2>&1 || true')
        pushLog?.(`[ERROR] 服务状态:\n${statusResult.stdout}`)
        pushLog?.(`[ERROR] 日志信息:\n${journalResult.stdout}`)
        
        pushLog?.('[STEP] 尝试直接运行 dockerd 以获取详细错误...')
        const dockerdLog = await executeShellCommand('timeout 10 dockerd 2>&1 || true')
        pushLog?.(`[ERROR] dockerd 直接运行输出:\n${dockerdLog.stdout}`)
        
        throw new Error(`Docker 服务启动失败\n${statusResult.stdout}\n${journalResult.stdout}\n${dockerdLog.stdout}`)
      }
    }
  }
}

async function fixDockerConfig(pushLog?: (log: string) => void, attempt: number = 1): Promise<void> {
  try {
    pushLog?.('[STEP] 验证 dockerd 配置...')
    const validateResult = await executeShellCommand('timeout 5 dockerd --validate 2>&1 || true')
    if (validateResult.stdout.includes('error') || validateResult.stdout.includes('Error')) {
      pushLog?.('[WARN] dockerd 配置验证失败:')
      pushLog?.(validateResult.stdout)
    } else if (validateResult.stdout.trim()) {
      pushLog?.('[DONE] dockerd 配置验证通过')
      return
    } else {
      pushLog?.('[INFO] dockerd --validate 返回空，尝试检查配置文件...')
    }
  } catch {
    pushLog?.('[WARN] 无法执行 dockerd --validate，尝试其他方式检查...')
  }
  
  try {
    const configResult = await executeShellCommand('cat /etc/docker/daemon.json 2>/dev/null || echo ""')
    const configContent = configResult.stdout.trim()
    
    if (!configContent || configContent === '{}') {
      pushLog?.('[INFO] daemon.json 为空或不存在，使用默认配置')
      const defaultConfig = JSON.stringify({
        'registry-mirrors': ['https://docker.1panel.live', 'https://mirror.baidubce.com'],
        dns: ['8.8.8.8', '114.114.114.114']
      })
      await executeShellCommand(`mkdir -p /etc/docker && cat > /etc/docker/daemon.json << 'EOF'\n${defaultConfig}\nEOF`)
      return
    }
    
    try {
      const config = JSON.parse(configContent)
      let changed = false
      
      if (config.proxies && config.proxies.default) {
        pushLog?.('[WARN] 发现不支持的 proxies.default 配置，正在移除...')
        delete config.proxies.default
        if (Object.keys(config.proxies).length === 0) {
          delete config.proxies
        }
        changed = true
      }
      
      const unsupportedKeys = ['default']
      for (const key of unsupportedKeys) {
        if (config[key] !== undefined) {
          pushLog?.(`[WARN] 发现不支持的配置项: ${key}，正在移除...`)
          delete config[key]
          changed = true
        }
      }
      
      if (changed) {
        const fixedConfig = JSON.stringify(config, null, 2)
        await executeShellCommand(`cat > /etc/docker/daemon.json << 'EOF'\n${fixedConfig}\nEOF`)
        pushLog?.('[DONE] 已移除不支持的配置项')
        return
      }
      
      if (attempt >= 2) {
        pushLog?.('[WARN] 配置格式正确但服务仍启动失败，尝试使用最小配置...')
        const minimalConfig = JSON.stringify({
          'registry-mirrors': ['https://docker.1panel.live', 'https://mirror.baidubce.com']
        })
        await executeShellCommand(`cat > /etc/docker/daemon.json << 'EOF'\n${minimalConfig}\nEOF`)
        pushLog?.('[DONE] 已切换为最小配置')
        return
      }
      
      pushLog?.('[INFO] daemon.json 配置文件格式正确')
    } catch {
      pushLog?.('[WARN] daemon.json JSON 格式错误，使用默认配置')
      const defaultConfig = JSON.stringify({
        'registry-mirrors': ['https://docker.1panel.live', 'https://mirror.baidubce.com'],
        dns: ['8.8.8.8', '114.114.114.114']
      })
      await executeShellCommand(`mkdir -p /etc/docker && cat > /etc/docker/daemon.json << 'EOF'\n${defaultConfig}\nEOF`)
    }
  } catch {
    pushLog?.('[WARN] 无法读取 daemon.json，使用默认配置')
    const defaultConfig = JSON.stringify({
      'registry-mirrors': ['https://docker.1panel.live', 'https://mirror.baidubce.com'],
      dns: ['8.8.8.8', '114.114.114.114']
    })
    await executeShellCommand(`mkdir -p /etc/docker && cat > /etc/docker/daemon.json << 'EOF'\n${defaultConfig}\nEOF`)
  }
  
  if (attempt >= 3) {
    pushLog?.('[WARN] 多次尝试后仍失败，尝试完全移除 daemon.json（核选项）...')
    await executeShellCommand('rm -f /etc/docker/daemon.json')
    pushLog?.('[DONE] 已移除 daemon.json，将使用 Docker 默认配置')
  }
}

export async function startNginx(): Promise<void> {
  await executeSudoCommand('systemctl', ['start', 'nginx'])
}

export async function startApache(): Promise<void> {
  await executeSudoCommand('systemctl', ['start', 'apache2'])
}

export async function startPHP(): Promise<void> {
  await executeSudoCommand('systemctl', ['start', 'php8.3-fpm'])
}

export async function startMySQL(): Promise<void> {
  await executeSudoCommand('systemctl', ['start', 'mysql'])
}

export async function stopService(service: string): Promise<void> {
  await executeSudoCommand('systemctl', ['stop', service])
}

export async function uninstallDocker(pushLog?: (log: string) => void): Promise<void> {
  pushLog?.('[STEP] 停止 Docker 服务...')
  await executeSudoCommand('systemctl', ['stop', 'docker'])
  pushLog?.('[DONE] Docker 服务已停止')

  pushLog?.('[STEP] 移除 Docker 包...')
  await executeShellCommand('apt-get remove -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-compose')
  pushLog?.('[DONE] Docker 包已移除')

  pushLog?.('[STEP] 清理配置文件...')
  await executeShellCommand('rm -rf /etc/docker /var/lib/docker /var/lib/containerd')
  pushLog?.('[DONE] 配置文件已清理')
}

export async function uninstallNginx(pushLog?: (log: string) => void): Promise<void> {
  pushLog?.('[STEP] 停止 Nginx 服务...')
  await executeSudoCommand('systemctl', ['stop', 'nginx'])
  pushLog?.('[DONE] Nginx 服务已停止')

  pushLog?.('[STEP] 移除 Nginx 包...')
  await executeShellCommand('apt-get remove -y nginx nginx-full nginx-core')
  pushLog?.('[DONE] Nginx 包已移除')

  pushLog?.('[STEP] 清理配置文件...')
  await executeShellCommand('rm -rf /etc/nginx /var/www/html')
  pushLog?.('[DONE] 配置文件已清理')
}

export async function uninstallApache(pushLog?: (log: string) => void): Promise<void> {
  pushLog?.('[STEP] 停止 Apache 服务...')
  await executeSudoCommand('systemctl', ['stop', 'apache2'])
  pushLog?.('[DONE] Apache 服务已停止')

  pushLog?.('[STEP] 移除 Apache 包...')
  await executeShellCommand('apt-get remove -y apache2 apache2-utils')
  pushLog?.('[DONE] Apache 包已移除')

  pushLog?.('[STEP] 清理配置文件...')
  await executeShellCommand('rm -rf /etc/apache2 /var/www/html')
  pushLog?.('[DONE] 配置文件已清理')
}

export async function uninstallPHP(pushLog?: (log: string) => void): Promise<void> {
  pushLog?.('[STEP] 停止 PHP-FPM 服务...')
  await executeSudoCommand('systemctl', ['stop', 'php8.3-fpm'])
  pushLog?.('[DONE] PHP-FPM 服务已停止')

  pushLog?.('[STEP] 移除 PHP 包...')
  await executeShellCommand('apt-get remove -y php8.3 php8.3-fpm php8.3-mysql php8.3-curl php8.3-gd php8.3-mbstring php8.3-xml php8.3-zip')
  pushLog?.('[DONE] PHP 包已移除')

  pushLog?.('[STEP] 清理配置文件...')
  await executeShellCommand('rm -rf /etc/php /var/lib/php')
  pushLog?.('[DONE] 配置文件已清理')
}

export async function uninstallMySQL(pushLog?: (log: string) => void): Promise<void> {
  pushLog?.('[STEP] 停止 MySQL 服务...')
  await executeSudoCommand('systemctl', ['stop', 'mysql'])
  pushLog?.('[DONE] MySQL 服务已停止')

  pushLog?.('[STEP] 移除 MySQL 包...')
  await executeShellCommand('apt-get remove -y mysql-server mysql-client mysql-common')
  pushLog?.('[DONE] MySQL 包已移除')

  pushLog?.('[STEP] 清理数据和配置...')
  await executeShellCommand('rm -rf /etc/mysql /var/lib/mysql /var/log/mysql')
  pushLog?.('[DONE] 数据和配置已清理')
}

export async function getDockerConfig(): Promise<{ content: string }> {
  try {
    const result = await executeShellCommand('cat /etc/docker/daemon.json 2>/dev/null || echo "{}"')
    return { content: result.stdout }
  } catch {
    return { content: '{}' }
  }
}

export async function saveDockerConfig(config: string): Promise<void> {
  let parsedConfig: any
  
  try {
    parsedConfig = JSON.parse(config)
  } catch {
    throw new Error('daemon.json 配置格式错误，不是有效的 JSON')
  }
  
  if (parsedConfig.proxies && parsedConfig.proxies.default) {
    throw new Error('daemon.json 不支持 proxies.default 配置，请移除该配置')
  }
  
  const oldConfigResult = await executeShellCommand('cat /etc/docker/daemon.json 2>/dev/null || echo ""')
  const oldConfig = oldConfigResult.stdout
  
  await executeShellCommand(`cat > /etc/docker/daemon.json << 'EOF'\n${config}\nEOF`)
  
  try {
    await executeSudoCommand('systemctl', ['restart', 'docker'])
  } catch (error: any) {
    if (oldConfig) {
      await executeShellCommand(`cat > /etc/docker/daemon.json << 'EOF'\n${oldConfig}\nEOF`)
      try {
        await executeSudoCommand('systemctl', ['restart', 'docker'])
      } catch (rollbackError) {
        logger.error('Docker 配置回滚失败', rollbackError)
      }
    }
    throw new Error(`Docker 配置保存失败，服务重启失败: ${error.message}\n已尝试恢复原配置`)
  }
}

export async function getNginxConfig(): Promise<{ content: string }> {
  try {
    const result = await executeShellCommand('cat /etc/nginx/nginx.conf 2>/dev/null || echo ""')
    return { content: result.stdout }
  } catch {
    return { content: '' }
  }
}

export async function saveNginxConfig(config: string): Promise<void> {
  await executeShellCommand(`cat > /etc/nginx/nginx.conf << 'EOF'\n${config}\nEOF`)
  await executeSudoCommand('systemctl', ['reload', 'nginx'])
}

export async function getApacheConfig(): Promise<{ content: string }> {
  try {
    const result = await executeShellCommand('cat /etc/apache2/apache2.conf 2>/dev/null || echo ""')
    return { content: result.stdout }
  } catch {
    return { content: '' }
  }
}

export async function saveApacheConfig(config: string): Promise<void> {
  await executeShellCommand(`cat > /etc/apache2/apache2.conf << 'EOF'\n${config}\nEOF`)
  await executeSudoCommand('systemctl', ['reload', 'apache2'])
}

export async function getPHPConfig(): Promise<{ content: string }> {
  try {
    const result = await executeShellCommand('cat /etc/php/8.3/fpm/php.ini 2>/dev/null || cat /etc/php/8.3/cli/php.ini 2>/dev/null || echo ""')
    return { content: result.stdout }
  } catch {
    return { content: '' }
  }
}

export async function savePHPConfig(config: string): Promise<void> {
  await executeShellCommand(`cat > /etc/php/8.3/fpm/php.ini << 'EOF'\n${config}\nEOF`)
  await executeShellCommand(`cat > /etc/php/8.3/cli/php.ini << 'EOF'\n${config}\nEOF`)
  await executeSudoCommand('systemctl', ['reload', 'php8.3-fpm'])
}

export async function getMySQLConfig(): Promise<{ content: string }> {
  try {
    const result = await executeShellCommand('cat /etc/mysql/mysql.conf.d/mysqld.cnf 2>/dev/null || cat /etc/mysql/my.cnf 2>/dev/null || echo ""')
    return { content: result.stdout }
  } catch {
    return { content: '' }
  }
}

export async function saveMySQLConfig(config: string): Promise<void> {
  await executeShellCommand(`cat > /etc/mysql/mysql.conf.d/mysqld.cnf << 'EOF'\n${config}\nEOF`)
  await executeSudoCommand('systemctl', ['restart', 'mysql'])
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

type DistroType = 'ubuntu' | 'debian' | 'centos' | 'rhel' | 'fedora' | 'unknown'

interface DistroInfo {
  type: DistroType
  name: string
  codename: string
  version: string
  packageManager: 'apt' | 'yum' | 'dnf'
}

async function detectDistro(): Promise<DistroInfo> {
  const result: DistroInfo = {
    type: 'unknown',
    name: 'Unknown',
    codename: '',
    version: '',
    packageManager: 'apt'
  }

  try {
    const osReleaseResult = await executeShellCommand('cat /etc/os-release')
    const osRelease = osReleaseResult.stdout

    const idMatch = osRelease.match(/^ID=(.+)$/m)
    const idLikeMatch = osRelease.match(/^ID_LIKE=(.+)$/m)
    const versionIdMatch = osRelease.match(/^VERSION_ID=(.+)$/m)
    const codenameMatch = osRelease.match(/^VERSION_CODENAME=(.+)$/m)
    const prettyNameMatch = osRelease.match(/^PRETTY_NAME="(.+)"$/m)

    const id = idMatch ? idMatch[1].replace(/"/g, '').toLowerCase() : ''
    const idLike = idLikeMatch ? idLikeMatch[1].replace(/"/g, '').toLowerCase() : ''

    if (id === 'ubuntu') {
      result.type = 'ubuntu'
      result.name = 'Ubuntu'
      result.packageManager = 'apt'
    } else if (id === 'debian') {
      result.type = 'debian'
      result.name = 'Debian'
      result.packageManager = 'apt'
    } else if (id === 'centos' || idLike.includes('centos')) {
      result.type = 'centos'
      result.name = 'CentOS'
      result.packageManager = 'yum'
    } else if (id === 'rhel' || idLike.includes('rhel')) {
      result.type = 'rhel'
      result.name = 'RHEL'
      result.packageManager = 'yum'
    } else if (id === 'fedora') {
      result.type = 'fedora'
      result.name = 'Fedora'
      result.packageManager = 'dnf'
    } else if (idLike.includes('debian')) {
      result.type = 'debian'
      result.name = 'Debian-based'
      result.packageManager = 'apt'
    } else if (idLike.includes('rhel') || idLike.includes('fedora')) {
      result.type = 'rhel'
      result.name = 'RHEL-based'
      result.packageManager = 'yum'
    }

    if (versionIdMatch) {
      result.version = versionIdMatch[1].replace(/"/g, '')
    }
    if (codenameMatch) {
      result.codename = codenameMatch[1].replace(/"/g, '')
    }
    if (prettyNameMatch) {
      result.name = prettyNameMatch[1]
    }
  } catch {
    try {
      const aptResult = await executeShellCommand('which apt-get')
      if (aptResult.stdout) {
        result.type = 'debian'
        result.name = 'Debian/Ubuntu'
        result.packageManager = 'apt'
      } else {
        const yumResult = await executeShellCommand('which yum')
        if (yumResult.stdout) {
          result.type = 'centos'
          result.name = 'CentOS/RHEL'
          result.packageManager = 'yum'
        } else {
          const dnfResult = await executeShellCommand('which dnf')
          if (dnfResult.stdout) {
            result.type = 'fedora'
            result.name = 'Fedora'
            result.packageManager = 'dnf'
          }
        }
      }
    } catch {}
  }

  return result
}

export async function installDocker(mirror: 'official' | 'aliyun' | 'daocloud' = 'official', logCallback?: LogCallback): Promise<InstallationResult> {
  const logs: string[] = []
  
  const pushLog = (log: string) => {
    logs.push(log)
    logCallback?.(log)
  }
  
  try {
    logger.info('Starting Docker installation')
    pushLog('[INFO] 开始安装 Docker')

    pushLog('[STEP] 检测系统类型...')
    const distro = await detectDistro()
    pushLog(`[INFO] 系统: ${distro.name} (${distro.type})`)
    pushLog(`[INFO] 版本: ${distro.version}`)
    pushLog(`[INFO] 包管理器: ${distro.packageManager}`)

    if (distro.type === 'unknown') {
      throw new Error('无法检测到系统类型，请手动安装 Docker')
    }

    const mirrors: Record<DistroType, Record<string, { name: string; gpgUrl: string; repoUrl: string }>> = {
      ubuntu: {
        official: { name: '官方镜像', gpgUrl: 'https://download.docker.com/linux/ubuntu/gpg', repoUrl: 'https://download.docker.com/linux/ubuntu' },
        aliyun: { name: '阿里云镜像', gpgUrl: 'https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg', repoUrl: 'https://mirrors.aliyun.com/docker-ce/linux/ubuntu' },
        daocloud: { name: 'DaoCloud镜像', gpgUrl: 'https://download.docker.com/linux/ubuntu/gpg', repoUrl: 'https://mirrors.daocloud.io/docker-ce/linux/ubuntu' }
      },
      debian: {
        official: { name: '官方镜像', gpgUrl: 'https://download.docker.com/linux/debian/gpg', repoUrl: 'https://download.docker.com/linux/debian' },
        aliyun: { name: '阿里云镜像', gpgUrl: 'https://mirrors.aliyun.com/docker-ce/linux/debian/gpg', repoUrl: 'https://mirrors.aliyun.com/docker-ce/linux/debian' },
        daocloud: { name: 'DaoCloud镜像', gpgUrl: 'https://download.docker.com/linux/debian/gpg', repoUrl: 'https://mirrors.daocloud.io/docker-ce/linux/debian' }
      },
      centos: {
        official: { name: '官方镜像', gpgUrl: 'https://download.docker.com/linux/centos/gpg', repoUrl: 'https://download.docker.com/linux/centos' },
        aliyun: { name: '阿里云镜像', gpgUrl: 'https://mirrors.aliyun.com/docker-ce/linux/centos/gpg', repoUrl: 'https://mirrors.aliyun.com/docker-ce/linux/centos' },
        daocloud: { name: 'DaoCloud镜像', gpgUrl: 'https://download.docker.com/linux/centos/gpg', repoUrl: 'https://mirrors.daocloud.io/docker-ce/linux/centos' }
      },
      rhel: {
        official: { name: '官方镜像', gpgUrl: 'https://download.docker.com/linux/rhel/gpg', repoUrl: 'https://download.docker.com/linux/rhel' },
        aliyun: { name: '阿里云镜像', gpgUrl: 'https://mirrors.aliyun.com/docker-ce/linux/rhel/gpg', repoUrl: 'https://mirrors.aliyun.com/docker-ce/linux/rhel' },
        daocloud: { name: 'DaoCloud镜像', gpgUrl: 'https://download.docker.com/linux/rhel/gpg', repoUrl: 'https://mirrors.daocloud.io/docker-ce/linux/rhel' }
      },
      fedora: {
        official: { name: '官方镜像', gpgUrl: 'https://download.docker.com/linux/fedora/gpg', repoUrl: 'https://download.docker.com/linux/fedora' },
        aliyun: { name: '阿里云镜像', gpgUrl: 'https://mirrors.aliyun.com/docker-ce/linux/fedora/gpg', repoUrl: 'https://mirrors.aliyun.com/docker-ce/linux/fedora' },
        daocloud: { name: 'DaoCloud镜像', gpgUrl: 'https://download.docker.com/linux/fedora/gpg', repoUrl: 'https://mirrors.daocloud.io/docker-ce/linux/fedora' }
      },
      unknown: {
        official: { name: '官方镜像', gpgUrl: 'https://download.docker.com/linux/ubuntu/gpg', repoUrl: 'https://download.docker.com/linux/ubuntu' },
        aliyun: { name: '阿里云镜像', gpgUrl: 'https://download.docker.com/linux/ubuntu/gpg', repoUrl: 'https://download.docker.com/linux/ubuntu' },
        daocloud: { name: 'DaoCloud镜像', gpgUrl: 'https://download.docker.com/linux/ubuntu/gpg', repoUrl: 'https://download.docker.com/linux/ubuntu' }
      }
    }

    const selectedMirror = mirrors[distro.type][mirror] || mirrors[distro.type].official
    pushLog(`[INFO] 使用镜像源: ${selectedMirror.name}`)

    if (distro.packageManager === 'apt') {
      await installDockerForDebian(selectedMirror, distro, pushLog)
    } else {
      await installDockerForRHEL(selectedMirror, distro, pushLog)
    }

    pushLog('[STEP] 启动 Docker 服务...')
    await startDocker(pushLog)
    pushLog('[DONE] Docker 服务已启动')

    pushLog('[STEP] 启用 Docker 服务自启...')
    await executeSudoCommand('systemctl', ['enable', 'docker'])
    pushLog('[DONE] Docker 服务已启用自启')

    pushLog('[STEP] 验证安装...')
    try {
      await executeShellCommand('docker run --rm hello-world', pushLog)
      pushLog('[DONE] Docker 验证通过')
    } catch {
      pushLog('[WARN] Docker 验证失败，但服务可能已安装')
    }

    pushLog('[STEP] 配置用户组...')
    const currentUserResult = await executeShellCommand('whoami')
    await executeSudoCommand('usermod', ['-aG', 'docker', currentUserResult.stdout.trim()])
    pushLog(`[INFO] 用户 ${currentUserResult.stdout.trim()} 已添加到 docker 组`)
    pushLog('[DONE] 用户组配置完成')

    pushLog('[STEP] 配置 Docker 镜像加速...')
    const dockerRegistryMirrors: Record<string, string[]> = {
      official: ['https://docker.1panel.live', 'https://mirror.baidubce.com'],
      aliyun: ['https://docker.1panel.live', 'https://mirror.baidubce.com'],
      daocloud: ['https://docker.m.daocloud.io']
    }
    const selectedRegistryMirrors = dockerRegistryMirrors[mirror] || dockerRegistryMirrors.official
    const daemonConfig = {
      'registry-mirrors': selectedRegistryMirrors,
      dns: ['8.8.8.8', '114.114.114.114']
    }
    await executeShellCommand(`mkdir -p /etc/docker`)
    const configJson = JSON.stringify(daemonConfig)
    await executeShellCommand(`cat > /etc/docker/daemon.json << 'EOF'\n${configJson}\nEOF`)
    pushLog(`[INFO] 配置镜像源: ${selectedRegistryMirrors.join(', ')}`)
    pushLog('[DONE] Docker 镜像加速配置完成')

    pushLog('[STEP] 重启 Docker 服务以应用配置...')
    try {
      await startDocker(pushLog)
      pushLog('[DONE] Docker 服务已重启并应用配置')
    } catch (restartError: any) {
      pushLog(`[WARN] Docker 服务重启失败: ${restartError.message}`)
      pushLog('[WARN] 尝试清理配置后重试...')
      try {
        await executeShellCommand('rm -f /etc/docker/daemon.json')
        await startDocker(pushLog)
        pushLog('[INFO] 已移除镜像加速配置，Docker 服务使用默认配置启动')
      } catch (cleanError: any) {
        const statusResult = await executeShellCommand('systemctl status docker 2>&1 || true')
        pushLog(`[ERROR] Docker 服务启动失败: ${statusResult.stdout || statusResult.stderr || 'Unknown error'}`)
        pushLog('[WARN] Docker 安装完成但服务未启动，请手动检查')
      }
    }

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

async function installDockerForDebian(mirror: { name: string; gpgUrl: string; repoUrl: string }, distro: DistroInfo, pushLog: (log: string) => void) {
  pushLog('[STEP] 卸载旧版本 Docker...')
  await executeShellCommand('apt-get remove -y docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc 2>/dev/null || true', pushLog)
  pushLog('[DONE] 旧版本卸载完成')

  pushLog('[STEP] 执行 apt-get update...')
  await executeShellCommand('apt-get update', pushLog)
  pushLog('[DONE] apt-get update 完成')

  pushLog('[STEP] 安装依赖包...')
  await executeShellCommand('apt-get install -y ca-certificates curl', pushLog)
  pushLog('[DONE] 依赖包安装完成')

  pushLog('[STEP] 创建密钥目录...')
  await executeShellCommand('install -m 0755 -d /etc/apt/keyrings')
  pushLog('[DONE] 密钥目录创建完成')

  pushLog('[STEP] 下载 Docker GPG 密钥...')
  await executeShellCommand(`curl -fsSL ${mirror.gpgUrl} -o /etc/apt/keyrings/docker.asc`, pushLog)
  pushLog('[DONE] GPG 密钥下载完成')

  pushLog('[STEP] 设置密钥文件权限...')
  await executeShellCommand('chmod a+r /etc/apt/keyrings/docker.asc')
  pushLog('[DONE] 密钥文件权限设置完成')

  pushLog('[STEP] 获取系统架构...')
  const archResult = await executeShellCommand('dpkg --print-architecture')
  const arch = archResult.stdout.trim()
  pushLog(`[INFO] 架构: ${arch}`)

  let codename = distro.codename
  if (!codename) {
    pushLog('[STEP] 获取系统代号...')
    const codenameResult = await executeShellCommand('. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}"')
    codename = codenameResult.stdout.trim() || (distro.type === 'ubuntu' ? 'jammy' : 'bookworm')
  }
  pushLog(`[INFO] 系统代号: ${codename}`)
  
  pushLog('[STEP] 添加 Docker 源...')
  const sourcesContent = `Types: deb
URIs: ${mirror.repoUrl}
Suites: ${codename}
Components: stable
Architectures: ${arch}
Signed-By: /etc/apt/keyrings/docker.asc
`
  await executeShellCommand(`echo "${sourcesContent.replace(/"/g, '\\"')}" | tee /etc/apt/sources.list.d/docker.sources > /dev/null`)
  pushLog(`[INFO] 使用镜像源: ${mirror.repoUrl}`)
  pushLog('[DONE] Docker 源添加完成')

  pushLog('[STEP] 更新软件包列表...')
  await executeShellCommand('apt-get update', pushLog)
  pushLog('[DONE] 软件包列表更新完成')

  pushLog('[STEP] 安装 Docker Engine...')
  try {
    await executeShellCommand('apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin', pushLog)
    pushLog('[DONE] Docker Engine 安装完成')
  } catch {
    pushLog('[WARN] 官方源安装失败，尝试使用系统自带包...')
    try {
      await executeShellCommand('apt-get install -y docker.io', pushLog)
      pushLog('[DONE] Docker (系统包) 安装完成')
      
      pushLog('[STEP] 安装 Docker Compose V2...')
      await executeShellCommand('apt-get install -y docker-compose-v2', pushLog)
      pushLog('[DONE] Docker Compose V2 安装完成')
    } catch (fallbackError: any) {
      const fallbackErrorMessage = fallbackError.message || (fallbackError.stderr || fallbackError.stdout || 'Unknown error').toString()
      pushLog(`[ERROR] 系统包安装也失败: ${fallbackErrorMessage}`)
      throw new Error(`Docker 安装失败，请检查网络连接或手动安装。错误: ${fallbackErrorMessage}`)
    }
  }
}

async function installDockerForRHEL(mirror: { name: string; gpgUrl: string; repoUrl: string }, distro: DistroInfo, pushLog: (log: string) => void) {
  const pkgMgr = distro.packageManager === 'dnf' ? 'dnf' : 'yum'

  pushLog('[STEP] 卸载旧版本 Docker...')
  await executeShellCommand(`${pkgMgr} remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine podman-docker containerd runc 2>/dev/null || true`, pushLog)
  pushLog('[DONE] 旧版本卸载完成')

  pushLog('[STEP] 安装依赖包...')
  await executeShellCommand(`${pkgMgr} install -y yum-utils device-mapper-persistent-data lvm2`, pushLog)
  pushLog('[DONE] 依赖包安装完成')

  pushLog('[STEP] 添加 Docker 源...')
  await executeShellCommand(`${pkgMgr} config-manager --add-repo ${mirror.repoUrl}/docker-ce.repo`, pushLog)
  pushLog(`[INFO] 使用镜像源: ${mirror.repoUrl}`)
  pushLog('[DONE] Docker 源添加完成')

  pushLog('[STEP] 安装 Docker Engine...')
  try {
    await executeShellCommand(`${pkgMgr} install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`, pushLog)
    pushLog('[DONE] Docker Engine 安装完成')
  } catch (error: any) {
    const errorMessage = error.message || (error.stderr || error.stdout || 'Unknown error').toString()
    pushLog(`[ERROR] 安装失败: ${errorMessage}`)
    throw new Error(`Docker 安装失败，请检查网络连接或手动安装。错误: ${errorMessage}`)
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