import { executeSudoCommand } from '../core/command'

export async function getImages() {
  const result = await executeSudoCommand('/usr/bin/docker', ['images'])
  const lines = result.stdout.split('\n').slice(1)

  const images = lines.map(line => {
    const parts = line.trim().split(/\s+/)
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
  await executeSudoCommand('/usr/bin/docker', ['pull', imageName])
}

export async function removeImage(imageId: string) {
  await executeSudoCommand('/usr/bin/docker', ['rmi', imageId])
}

export async function getContainers(all: boolean = false) {
  const args = all ? ['ps', '-a'] : ['ps']
  const result = await executeSudoCommand('/usr/bin/docker', args)
  const lines = result.stdout.split('\n').slice(1)

  const containers = lines.map(line => {
    const parts = line.trim().split(/\s+/)
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

  const result = await executeSudoCommand('/usr/bin/docker', args)
  return result.stdout.trim()
}

export async function startContainer(containerId: string) {
  await executeSudoCommand('/usr/bin/docker', ['start', containerId])
}

export async function stopContainer(containerId: string) {
  await executeSudoCommand('/usr/bin/docker', ['stop', containerId])
}

export async function removeContainer(containerId: string) {
  await executeSudoCommand('/usr/bin/docker', ['rm', containerId])
}

export async function getContainerLogs(containerId: string, tail: number = 100) {
  const result = await executeSudoCommand('/usr/bin/docker', ['logs', '--tail', tail.toString(), containerId])
  return result.stdout
}
