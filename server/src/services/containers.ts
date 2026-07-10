import { executeSudoCommand, executeShellCommand } from '../core/command'
import { existsSync } from 'fs'

function getDockerPath(): string {
  const paths = ['/usr/bin/docker', '/usr/local/bin/docker', '/snap/bin/docker']
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  return '/usr/bin/docker'
}

export async function getImages() {
  const dockerPath = getDockerPath()
  const result = await executeSudoCommand(dockerPath, ['images', '--format', '{{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}'])
  const lines = result.stdout.split('\n').filter(line => line.trim())

  const images = lines.map(line => {
    const parts = line.split('\t')
    return {
      repository: parts[0] || '',
      tag: parts[1] || '',
      id: parts[2] || '',
      created: parts[3] || '',
      size: parts[4] || ''
    }
  }).filter(img => img.id)

  return images
}

export async function pullImage(imageName: string) {
  const dockerPath = getDockerPath()
  await executeSudoCommand(dockerPath, ['pull', imageName])
}

export async function removeImage(imageId: string) {
  const dockerPath = getDockerPath()
  await executeSudoCommand(dockerPath, ['rmi', imageId])
}

export async function getContainers(all: boolean = false) {
  const dockerPath = getDockerPath()
  const args = all ? ['ps', '-a', '--format', '{{.ID}}\t{{.Image}}\t{{.Command}}\t{{.CreatedAt}}\t{{.Status}}\t{{.Ports}}\t{{.Names}}'] : ['ps', '--format', '{{.ID}}\t{{.Image}}\t{{.Command}}\t{{.CreatedAt}}\t{{.Status}}\t{{.Ports}}\t{{.Names}}']
  const result = await executeSudoCommand(dockerPath, args)
  const lines = result.stdout.split('\n').filter(line => line.trim())

  const containers = lines.map(line => {
    const parts = line.split('\t')
    return {
      id: parts[0] || '',
      image: parts[1] || '',
      command: parts[2] || '',
      created: parts[3] || '',
      status: parts[4] || '',
      ports: parts[5] || '',
      names: parts[6] || ''
    }
  }).filter(container => container.id)

  return containers
}

export async function createContainer(data: { image: string; name: string; ports?: string[]; env?: string[]; command?: string }) {
  const dockerPath = getDockerPath()
  const args = ['run', '-d', '--name', data.name]

  if (data.ports) {
    data.ports.forEach(port => args.push('-p', port))
  }

  if (data.env) {
    data.env.forEach(e => args.push('-e', e))
  }

  args.push(data.image)

  if (data.command) {
    args.push(data.command)
  }

  const result = await executeSudoCommand(dockerPath, args)
  return result.stdout.trim()
}

export async function startContainer(containerId: string) {
  const dockerPath = getDockerPath()
  await executeSudoCommand(dockerPath, ['start', containerId])
}

export async function stopContainer(containerId: string) {
  const dockerPath = getDockerPath()
  await executeSudoCommand(dockerPath, ['stop', containerId])
}

export async function removeContainer(containerId: string) {
  const dockerPath = getDockerPath()
  await executeSudoCommand(dockerPath, ['rm', containerId])
}

export async function getContainerLogs(containerId: string, tail: number = 100) {
  const dockerPath = getDockerPath()
  const result = await executeSudoCommand(dockerPath, ['logs', '--tail', tail.toString(), containerId])
  return result.stdout
}

export async function listDirectory(path: string): Promise<Array<{ name: string; type: 'file' | 'directory'; path: string }>> {
  const result = await executeShellCommand(`ls -la "${path}"`)
  const lines = result.stdout.split('\n').slice(1)

  return lines.map(line => {
    const parts = line.trim().split(/\s+/)
    const type: 'file' | 'directory' = parts[0]?.startsWith('d') ? 'directory' : 'file'
    const name = parts.slice(8).join(' ')
    return {
      name,
      type,
      path: `${path}/${name}`
    }
  }).filter(item => item.name && item.name !== '.' && item.name !== '..')
}

export async function readComposeFile(path: string): Promise<string> {
  const result = await executeShellCommand(`cat "${path}"`)
  return result.stdout
}

export async function composeUp(path: string, onOutput?: (output: string) => void) {
  const dockerPath = getDockerPath()
  const dir = path.substring(0, path.lastIndexOf('/'))
  await executeSudoCommand(dockerPath, ['compose', '-f', path, '-p', 'lpanel-compose', 'up', '-d'], { cwd: dir }, onOutput)
}

export async function composeDown(path: string) {
  const dockerPath = getDockerPath()
  const dir = path.substring(0, path.lastIndexOf('/'))
  await executeSudoCommand(dockerPath, ['compose', '-f', path, '-p', 'lpanel-compose', 'down'], { cwd: dir })
}

export async function composeLogs(path: string) {
  const dockerPath = getDockerPath()
  const dir = path.substring(0, path.lastIndexOf('/'))
  const result = await executeSudoCommand(dockerPath, ['compose', '-f', path, '-p', 'lpanel-compose', 'logs', '--tail', '100'], { cwd: dir })
  return result.stdout
}

export async function getComposeServices(path: string): Promise<Array<{ name: string; state: string; ports: string; image: string }>> {
  const dockerPath = getDockerPath()
  const dir = path.substring(0, path.lastIndexOf('/'))
  const result = await executeSudoCommand(dockerPath, ['compose', '-f', path, '-p', 'lpanel-compose', 'ps'], { cwd: dir })
  const lines = result.stdout.split('\n').slice(1)

  return lines.map(line => {
    const parts = line.trim().split(/\s+/)
    return {
      name: parts[0] || '',
      state: parts[3] || '',
      ports: parts[4] || '',
      image: parts[2] || ''
    }
  }).filter(service => service.name)
}

export async function composeBuild(path: string) {
  const dockerPath = getDockerPath()
  const dir = path.substring(0, path.lastIndexOf('/'))
  await executeSudoCommand(dockerPath, ['compose', '-f', path, '-p', 'lpanel-compose', 'build'], { cwd: dir })
}

export async function composePull(path: string) {
  const dockerPath = getDockerPath()
  const dir = path.substring(0, path.lastIndexOf('/'))
  await executeSudoCommand(dockerPath, ['compose', '-f', path, '-p', 'lpanel-compose', 'pull'], { cwd: dir })
}

export async function composeRestart(path: string) {
  const dockerPath = getDockerPath()
  const dir = path.substring(0, path.lastIndexOf('/'))
  await executeSudoCommand(dockerPath, ['compose', '-f', path, '-p', 'lpanel-compose', 'restart'], { cwd: dir })
}

export async function composeDownWithVolumes(path: string) {
  const dockerPath = getDockerPath()
  const dir = path.substring(0, path.lastIndexOf('/'))
  await executeSudoCommand(dockerPath, ['compose', '-f', path, '-p', 'lpanel-compose', 'down', '-v'], { cwd: dir })
}
