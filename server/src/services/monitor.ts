import os from 'os'
import { executeShellCommand } from '../core/command'
import { SystemInfo, CPUInfo, MemoryInfo, DiskInfo, NetworkInfo } from '../types'

export async function getSystemInfo(): Promise<SystemInfo> {
  const hostname = os.hostname()
  const platform = os.platform()
  const release = os.release()
  const uptime = os.uptime()

  return {
    hostname,
    os: platform,
    kernel: release,
    uptime
  }
}

export async function getCPUInfo(): Promise<CPUInfo> {
  const cpus = os.cpus()
  const model = cpus[0]?.model || 'Unknown'
  const cores = cpus.length

  const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0)
  const totalTick = cpus.reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0)
  const usage = Math.round(((totalTick - totalIdle) / totalTick) * 100)

  return {
    model,
    cores,
    usage
  }
}

export async function getMemoryInfo(): Promise<MemoryInfo> {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free

  let cached = 0
  try {
    const result = await executeShellCommand('cat /proc/meminfo | grep -E "Cached|Buffers"')
    const lines = result.stdout.split('\n')
    lines.forEach(line => {
      const match = line.match(/(\d+)/)
      if (match) {
        cached += parseInt(match[1]) * 1024
      }
    })
  } catch {
    cached = 0
  }

  const usage = Math.round((used / total) * 100)

  return {
    total,
    used,
    free,
    cached,
    usage
  }
}

export async function getDiskInfo(): Promise<DiskInfo[]> {
  const result = await executeShellCommand('df -h')
  const lines = result.stdout.split('\n').slice(1)
  
  const disks: DiskInfo[] = []
  
  lines.forEach(line => {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 6) {
      const filesystem = parts[0]
      const sizeStr = parts[1]
      const usedStr = parts[2]
      const availStr = parts[3]
      const usePercent = parts[4]
      const mount = parts[5]

      const toBytes = (str: string): number => {
        const num = parseFloat(str)
        if (str.endsWith('G')) return num * 1024 * 1024 * 1024
        if (str.endsWith('M')) return num * 1024 * 1024
        if (str.endsWith('K')) return num * 1024
        return num
      }

      disks.push({
        filesystem,
        mount,
        total: toBytes(sizeStr),
        used: toBytes(usedStr),
        free: toBytes(availStr),
        usage: parseInt(usePercent.replace('%', ''))
      })
    }
  })

  return disks
}

export async function getNetworkInfo(): Promise<NetworkInfo[]> {
  const result = await executeShellCommand('ip addr show')
  const lines = result.stdout.split('\n')
  
  const networks: NetworkInfo[] = []
  let currentInterface = ''
  let currentIp = ''
  let currentMac = ''

  lines.forEach(line => {
    const interfaceMatch = line.match(/^\d+:\s+(\w+):/)
    if (interfaceMatch) {
      if (currentInterface && currentIp) {
        networks.push({
          interface: currentInterface,
          ip: currentIp,
          mac: currentMac,
          rx: 0,
          tx: 0
        })
      }
      currentInterface = interfaceMatch[1]
      currentIp = ''
      currentMac = ''
    }

    const ipMatch = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/)
    if (ipMatch) {
      currentIp = ipMatch[1]
    }

    const macMatch = line.match(/link\/ether\s+([0-9a-f:]+)/)
    if (macMatch) {
      currentMac = macMatch[1]
    }
  })

  if (currentInterface && currentIp) {
    networks.push({
      interface: currentInterface,
      ip: currentIp,
      mac: currentMac,
      rx: 0,
      tx: 0
    })
  }

  return networks
}

export async function getAllMonitorData() {
  const [system, cpu, memory, disk, network] = await Promise.all([
    getSystemInfo(),
    getCPUInfo(),
    getMemoryInfo(),
    getDiskInfo(),
    getNetworkInfo()
  ])

  return {
    system,
    cpu,
    memory,
    disk,
    network
  }
}
