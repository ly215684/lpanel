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

export async function installDocker(): Promise<void> {
  logger.info('Starting Docker installation')

  await executeShellCommand('apt-get update')
  await executeShellCommand('apt-get install -y ca-certificates curl gnupg lsb-release')

  await executeShellCommand('mkdir -p /etc/apt/keyrings')

  const keyResult = await executeShellCommand('curl -fsSL https://download.docker.com/linux/ubuntu/gpg')
  await executeShellCommand(`echo "${keyResult.stdout}" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg`)

  const archResult = await executeShellCommand('dpkg --print-architecture')
  const osResult = await executeShellCommand('. /etc/os-release && echo $ID')
  
  await executeShellCommand(`echo "deb [arch=${archResult.stdout.trim()} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${osResult.stdout.trim()} $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null`)

  await executeShellCommand('apt-get update')
  await executeShellCommand('apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin')

  await executeSudoCommand('systemctl', ['enable', 'docker'])
  await executeSudoCommand('systemctl', ['start', 'docker'])

  const currentUserResult = await executeShellCommand('whoami')
  await executeShellCommand(`usermod -aG docker ${currentUserResult.stdout.trim()}`)

  logger.info('Docker installation completed')
}

export async function installDockerCompose(): Promise<void> {
  logger.info('Starting Docker Compose installation')

  const latestVersionResult = await executeShellCommand('curl -s https://api.github.com/repos/docker/compose/releases/latest')
  const version = latestVersionResult.stdout.match(/"tag_name":\s*"([^"]+)"/)?.[1] || 'v2.24.0'

  await executeShellCommand(`curl -SL https://github.com/docker/compose/releases/download/${version}/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose`)
  
  await executeShellCommand('chmod +x /usr/local/bin/docker-compose')

  logger.info('Docker Compose installation completed')
}

export async function installNginx(): Promise<void> {
  logger.info('Starting Nginx installation')

  await executeShellCommand('apt-get update')
  await executeShellCommand('apt-get install -y nginx')

  await executeSudoCommand('systemctl', ['enable', 'nginx'])
  await executeSudoCommand('systemctl', ['start', 'nginx'])

  await executeShellCommand('ufw allow "Nginx Full"')

  logger.info('Nginx installation completed')
}

export async function installApache(): Promise<void> {
  logger.info('Starting Apache installation')

  await executeShellCommand('apt-get update')
  await executeShellCommand('apt-get install -y apache2')

  await executeSudoCommand('systemctl', ['enable', 'apache2'])
  await executeSudoCommand('systemctl', ['start', 'apache2'])

  await executeShellCommand('ufw allow "Apache Full"')

  logger.info('Apache installation completed')
}

export async function installPHP(version: string = '8.3'): Promise<void> {
  logger.info(`Starting PHP ${version} installation`)

  await executeShellCommand('apt-get update')
  await executeShellCommand('apt-get install -y software-properties-common')
  
  await executeShellCommand('add-apt-repository -y ppa:ondrej/php')
  await executeShellCommand('apt-get update')

  await executeShellCommand(`apt-get install -y php${version} php${version}-fpm php${version}-mysql php${version}-curl php${version}-gd php${version}-mbstring php${version}-xml php${version}-zip`)

  await executeSudoCommand('systemctl', ['enable', `php${version}-fpm`])
  await executeSudoCommand('systemctl', ['start', `php${version}-fpm`])

  logger.info(`PHP ${version} installation completed`)
}

export async function installMySQL(): Promise<void> {
  logger.info('Starting MySQL installation')

  await executeShellCommand('apt-get update')
  
  await executeShellCommand('echo "mysql-server mysql-server/root_password password lpanel@123" | debconf-set-selections')
  await executeShellCommand('echo "mysql-server mysql-server/root_password_again password lpanel@123" | debconf-set-selections')

  await executeShellCommand('apt-get install -y mysql-server')

  await executeSudoCommand('systemctl', ['enable', 'mysql'])
  await executeSudoCommand('systemctl', ['start', 'mysql'])

  await executeShellCommand('ufw allow mysql')

  await executeShellCommand('mysql -u root -plpanel@123 -e "ALTER USER \'root\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'lpanel@123\'; FLUSH PRIVILEGES;"')

  logger.info('MySQL installation completed')
}