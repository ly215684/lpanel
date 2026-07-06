import fs from 'fs'
import path from 'path'
import { FileItem } from '../types'
import { logger } from '../core/logger'

const ALLOWED_BASE_PATH = '/var/www'

function resolvePath(filePath: string): string {
  const resolved = path.resolve(filePath)
  
  if (!resolved.startsWith(ALLOWED_BASE_PATH)) {
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
    
    result.push({
      name: file.name,
      path: filePath,
      type: file.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      permissions,
      owner: '',
      group: '',
      modifiedAt: stats.mtime
    })
  }
  
  return result
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
