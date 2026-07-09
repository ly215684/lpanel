import { PrismaClient } from '@prisma/client'
import { CronJob } from 'cron'
import { executeShellCommand } from '../core/command'
import { logger } from '../core/logger'
import { existsSync, statSync } from 'fs'
import { resolve } from 'path'

const prisma = new PrismaClient()

const cronJobs: Map<string, CronJob> = new Map()

export async function getTasks() {
  return prisma.task.findMany()
}

export async function getTask(id: string) {
  return prisma.task.findUnique({ where: { id }, include: { executions: true } })
}

export async function createTask(data: { name: string; type: string; cron_expression: string; command?: string }) {
  const task = await prisma.task.create({
    data: {
      name: data.name,
      type: data.type,
      cron_expression: data.cron_expression,
      command: data.command,
      status: 'enabled'
    }
  })

  if (task.status === 'enabled') {
    scheduleTask(task)
  }

  return task
}

export async function updateTask(id: string, data: Partial<{ name: string; cron_expression: string; command?: string; status: string }>) {
  const task = await prisma.task.update({
    where: { id },
    data
  })

  if (cronJobs.has(id)) {
    cronJobs.get(id)!.stop()
    cronJobs.delete(id)
  }

  if (task.status === 'enabled') {
    scheduleTask(task)
  }

  return task
}

export async function deleteTask(id: string) {
  if (cronJobs.has(id)) {
    cronJobs.get(id)!.stop()
    cronJobs.delete(id)
  }

  return prisma.task.delete({ where: { id } })
}

export async function runTask(id: string) {
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw new Error('Task not found')

  await executeTask(task)
}

export async function getTaskExecutions(taskId: string) {
  return prisma.taskExecution.findMany({ where: { task_id: taskId }, orderBy: { started_at: 'desc' } })
}

function scheduleTask(task: { id: string; type: string; cron_expression: string; command: string | null }) {
  const job = new CronJob(task.cron_expression, () => {
    executeTask(task)
  })

  cronJobs.set(task.id, job)
  job.start()
}

async function executeTask(task: { id: string; type: string; command: string | null }) {
  const execution = await prisma.taskExecution.create({
    data: {
      task_id: task.id,
      status: 'running',
      started_at: new Date()
    }
  })

  try {
    let output = ''

    if (task.type === 'script') {
      if (!task.command) {
        throw new Error('Shell 脚本路径不能为空')
      }
      const scriptPath = resolve(task.command.trim())
      if (!existsSync(scriptPath)) {
        throw new Error(`脚本文件不存在: ${scriptPath}`)
      }
      const stat = statSync(scriptPath)
      if (!stat.isFile()) {
        throw new Error(`路径不是文件: ${scriptPath}`)
      }
      await executeShellCommand(`chmod +x "${scriptPath}"`)
      const result = await executeShellCommand(`bash "${scriptPath}"`)
      output = result.stdout
    } else if (task.command) {
      const result = await executeShellCommand(task.command)
      output = result.stdout
    } else {
      throw new Error('执行命令不能为空')
    }

    await prisma.taskExecution.update({
      where: { id: execution.id },
      data: {
        status: 'success',
        output,
        finished_at: new Date()
      }
    })

    await prisma.task.update({
      where: { id: task.id },
      data: { last_run_at: new Date() }
    })
  } catch (error: any) {
    await prisma.taskExecution.update({
      where: { id: execution.id },
      data: {
        status: 'failed',
        error: error.message || 'Unknown error',
        finished_at: new Date()
      }
    })
    logger.error(`Task execution failed: ${error.message}`)
  }
}

export async function initTasks() {
  const tasks = await prisma.task.findMany({ where: { status: 'enabled' } })
  tasks.forEach(task => scheduleTask(task))
  logger.info(`Scheduled ${tasks.length} tasks`)
}
