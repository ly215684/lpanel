import fs from 'fs'
import path from 'path'
import { FileItem } from '../types'
import { logger } from '../core/logger'
import { executeShellCommand } from '../core/command'

function resolvePath(filePath: string): string {
  const resolved = path.resolve(filePath)
  
  if (!resolved.startsWith('/')) {
    throw new Error('Access denied: Path outside allowed directory')
  }
  
  return resolved
}

export async function listFiles(directory: string): Promise<FileItem[]> {
  const resolvedPath = resolvePath(directory)
  
  const files = await fs.promises.readdir(resolvedPath, { withFileTypes: true })
  
  const result: FileItem[] = []
  
  for (const file of files) {
    const filePath = path.join(resolvedPath, file.name)
    const stats = await fs.promises.stat(filePath)
    
    const permissions = stats.mode.toString(8).slice(-3)
    
    let owner = ''
    let group = ''
    try {
      const lsResult = await executeShellCommand(`ls -ld "${filePath}"`)
      const parts = lsResult.stdout.trim().split(/\s+/)
      if (parts.length >= 4) {
        owner = parts[2] || ''
        group = parts[3] || ''
      }
    } catch {
      owner = ''
      group = ''
    }
    
    result.push({
      name: file.name,
      path: filePath,
      type: file.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      permissions,
      owner,
      group,
      modifiedAt: stats.mtime
    })
  }
  
  return result
}

export async function searchFiles(directory: string, keyword: string, includeSubdirs: boolean = false): Promise<FileItem[]> {
  const resolvedPath = resolvePath(directory)
  
  const findCommand = includeSubdirs 
    ? `find "${resolvedPath}" -type f -name "*${keyword}*" 2>/dev/null | head -50`
    : `find "${resolvedPath}" -maxdepth 1 -type f -name "*${keyword}*" 2>/dev/null`
  
  const result = await executeShellCommand(findCommand)
  const lines = result.stdout.split('\n').filter(line => line.trim())
  
  const files: FileItem[] = []
  
  for (const filePath of lines) {
    try {
      const stats = await fs.promises.stat(filePath)
      const permissions = stats.mode.toString(8).slice(-3)
      
      let owner = ''
      let group = ''
      try {
        const lsResult = await executeShellCommand(`ls -ld "${filePath}"`)
        const parts = lsResult.stdout.trim().split(/\s+/)
        if (parts.length >= 4) {
          owner = parts[2] || ''
          group = parts[3] || ''
        }
      } catch {
        owner = ''
        group = ''
      }
      
      files.push({
        name: path.basename(filePath),
        path: filePath,
        type: 'file',
        size: stats.size,
        permissions,
        owner,
        group,
        modifiedAt: stats.mtime
      })
    } catch {
      continue
    }
  }
  
  return files
}

export async function renameFile(oldPath: string, newName: string): Promise<void> {
  const resolvedOldPath = resolvePath(oldPath)
  const dir = path.dirname(resolvedOldPath)
  const resolvedNewPath = path.join(dir, newName)
  
  await fs.promises.rename(resolvedOldPath, resolvedNewPath)
}

export async function readFile(filePath: string): Promise<string> {
  const resolvedPath = resolvePath(filePath)
  
  const content = await fs.promises.readFile(resolvedPath, 'utf-8')
  return content
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  const resolvedPath = resolvePath(filePath)
  
  await fs.promises.writeFile(resolvedPath, content, 'utf-8')
}

export async function uploadFile(filePath: string, content: Buffer): Promise<void> {
  const resolvedPath = resolvePath(filePath)
  const dir = path.dirname(resolvedPath)
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(resolvedPath, content)
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  const resolvedPath = resolvePath(filePath)
  
  return fs.promises.readFile(resolvedPath)
}

export async function deleteFile(filePath: string): Promise<void> {
  const resolvedPath = resolvePath(filePath)
  
  const stats = await fs.promises.stat(resolvedPath)
  
  if (stats.isDirectory()) {
    await fs.promises.rm(resolvedPath, { recursive: true })
  } else {
    await fs.promises.unlink(resolvedPath)
  }
}

export async function createDirectory(dirPath: string): Promise<void> {
  const resolvedPath = resolvePath(dirPath)
  
  await fs.promises.mkdir(resolvedPath, { recursive: true })
}

export async function changePermissions(filePath: string, permissions: string): Promise<void> {
  const resolvedPath = resolvePath(filePath)
  
  const mode = parseInt(permissions, 8)
  await fs.promises.chmod(resolvedPath, mode)
}

export async function compressFile(filePath: string): Promise<void> {
  await compressFiles([filePath])
}

export async function compressFiles(filePaths: string[]): Promise<void> {
  if (filePaths.length === 0) {
    throw new Error('请选择要压缩的文件')
  }
  
  const resolvedPaths = filePaths.map(p => resolvePath(p))
  
  if (resolvedPaths.length === 1) {
    const resolvedPath = resolvedPaths[0]
    const dir = path.dirname(resolvedPath)
    const fileName = path.basename(resolvedPath)
    await executeShellCommand(`cd "${dir}" && tar -czf "${fileName}.tar.gz" "${fileName}"`)
    return
  }
  
  const firstPath = resolvedPaths[0]
  const dir = path.dirname(firstPath)
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14)
  const archiveName = `archive-${timestamp}.tar.gz`
  
  const escapedPaths = resolvedPaths.map(p => `"${path.basename(p)}"`).join(' ')
  
  await executeShellCommand(`cd "${dir}" && tar -czf "${archiveName}" ${escapedPaths}`)
}

async function getAllFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    files.push(fullPath)
    if (entry.isDirectory()) {
      const subFiles = await getAllFilesRecursive(fullPath)
      files.push(...subFiles)
    }
  }
  
  return files
}

export async function extractFile(filePath: string): Promise<void> {
  const resolvedPath = resolvePath(filePath)
  const dir = path.dirname(resolvedPath)
  const fileName = path.basename(resolvedPath)
  
  logger.info(`=== EXTRACT DEBUG INFO ===`)
  logger.info(`Input filePath: ${filePath}`)
  logger.info(`Resolved path: ${resolvedPath}`)
  logger.info(`Extract directory: ${dir}`)
  logger.info(`File name: ${fileName}`)
  
  try {
    const stats = await fs.promises.stat(resolvedPath)
    logger.info(`File size: ${stats.size} bytes`)
    logger.info(`File exists: true`)
  } catch {
    logger.error(`File does not exist at: ${resolvedPath}`)
    throw new Error('文件不存在')
  }
  
  let listCommand = ''
  if (fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz')) {
    listCommand = `tar -tzf "${resolvedPath}"`
  } else if (fileName.endsWith('.tar')) {
    listCommand = `tar -tf "${resolvedPath}"`
  } else if (fileName.endsWith('.zip')) {
    listCommand = `unzip -l "${resolvedPath}"`
  }
  
  if (listCommand) {
    try {
      const listResult = await executeShellCommand(listCommand)
      logger.info(`Compressed file contents:\n${listResult.stdout}`)
      if (!listResult.stdout || listResult.stdout.trim().length === 0) {
        logger.warn(`Compressed file appears to be empty or list failed`)
      }
    } catch (e: any) {
      logger.warn(`Failed to list compressed file contents: ${e.message}`)
    }
  }
  
  try {
    const dirStats = await fs.promises.stat(dir)
    logger.info(`Directory permissions: ${dirStats.mode.toString(8).slice(-3)}`)
    logger.info(`Directory owner: ${dirStats.uid}:${dirStats.gid}`)
  } catch {
    logger.warn(`Failed to get directory stats`)
  }
  
  const beforeFiles = await getAllFilesRecursive(dir)
  logger.info(`Files before extraction (recursive): ${beforeFiles.length} files`)
  
  let command = ''
  
  if (fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz')) {
    command = `cd "${dir}" && tar -xzvf "${fileName}"`
  } else if (fileName.endsWith('.tar.bz2') || fileName.endsWith('.tbz2')) {
    command = `cd "${dir}" && tar -xjvf "${fileName}"`
  } else if (fileName.endsWith('.tar')) {
    command = `cd "${dir}" && tar -xvf "${fileName}"`
  } else if (fileName.endsWith('.gz')) {
    command = `cd "${dir}" && gzip -d "${fileName}"`
  } else if (fileName.endsWith('.zip')) {
    command = `cd ${dir} && unzip -o ${fileName}`
  } else if (fileName.endsWith('.rar')) {
    command = `cd "${dir}" && unrar x "${fileName}"`
  } else {
    throw new Error(`Unsupported file format: ${fileName}`)
  }
  
  logger.info(`Executing extract command: ${command}`)
  
  try {
    const result = await executeShellCommand(command)
    logger.info(`Extract stdout:\n${result.stdout}`)
    if (result.stderr) {
      logger.warn(`Extract stderr:\n${result.stderr}`)
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const afterFiles = await getAllFilesRecursive(dir)
    logger.info(`Files after extraction (recursive): ${afterFiles.length} files`)
    
    const newFiles = afterFiles.filter(f => !beforeFiles.includes(f))
    if (newFiles.length === 0) {
      logger.warn(`No new files found after extraction`)
      
      if (fileName.endsWith('.gz')) {
        const decompressedName = fileName.replace('.gz', '')
        const decompressedPath = path.join(dir, decompressedName)
        try {
          await fs.promises.stat(decompressedPath)
          logger.info(`Gzip file was decompressed in place: ${decompressedName}`)
        } catch {
          logger.error(`Gzip decompression failed - no file created`)
        }
      }
      
      const diffResult = await executeShellCommand(`diff <(ls -laR "${dir}" | sort) <(find "${dir}" -type f | sort) 2>/dev/null || true`)
      logger.info(`Directory diff result:\n${diffResult.stdout}`)
      
      throw new Error('解压命令执行成功，但未发现任何新文件')
    } else {
      logger.info(`New files extracted: ${newFiles.length} files`)
      newFiles.slice(0, 20).forEach(f => logger.info(`  - ${f.replace(dir + '/', '')}`))
      if (newFiles.length > 20) {
        logger.info(`  ... and ${newFiles.length - 20} more files`)
      }
    }
    
    logger.info(`=== EXTRACT SUCCESS ===`)
  } catch (error: any) {
    logger.error(`=== EXTRACT FAILED ===`)
    logger.error(`Error: ${error.message}`)
    throw new Error(`解压失败: ${error.message}`)
  }
}
