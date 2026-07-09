import { exec, execFile, ExecFileOptions } from 'child_process'
import { logger } from './logger'

const ALLOWED_COMMANDS: string[] = [
  '/bin/systemctl',
  '/usr/bin/systemctl',
  '/usr/bin/docker',
  '/usr/bin/mysql',
  '/usr/bin/psql',
  '/usr/bin/nginx',
  '/usr/sbin/nginx',
  '/usr/sbin/apache2',
  '/usr/bin/crontab',
  '/bin/df',
  '/bin/free',
  '/usr/bin/top',
  '/bin/cat',
  '/bin/ls',
  '/bin/mkdir',
  '/bin/rm',
  '/bin/cp',
  '/bin/mv',
  '/bin/chmod',
  '/bin/chown',
  '/usr/bin/du',
  '/sbin/ifconfig',
  '/usr/bin/ip',
  '/usr/bin/php',
  '/usr/bin/php7.4',
  '/usr/bin/php8.0',
  '/usr/bin/php8.1',
  '/usr/bin/php8.2',
  '/usr/bin/php8.3',
  '/usr/bin/docker-compose'
]

const SUDO_COMMANDS: string[] = [
  '/bin/systemctl',
  '/usr/bin/systemctl',
  '/usr/bin/docker',
  '/usr/local/bin/docker',
  '/snap/bin/docker',
  '/usr/bin/mysql',
  '/usr/bin/psql',
  '/usr/bin/nginx',
  '/usr/sbin/nginx',
  '/usr/sbin/apache2',
  '/bin/chmod',
  '/bin/chown',
  '/usr/sbin/usermod'
]

function sanitizeCommand(command: string): string {
  const bannedChars = [';', '`', '$', '(', ')', '{', '}', '[', ']', '*', '?', '~', '!']
  return bannedChars.reduce((acc, char) => acc.replace(new RegExp(`\\${char}`, 'g'), ''), command)
}

function sanitizeArgs(args: string[]): string[] {
  return args.map(arg => sanitizeCommand(arg))
}

export async function executeCommand(command: string, args: string[] = [], options: ExecFileOptions = {}): Promise<{ stdout: string; stderr: string }> {
  const sanitizedCommand = sanitizeCommand(command)
  const sanitizedArgs = sanitizeArgs(args)

  const commandAllowed = ALLOWED_COMMANDS.includes(sanitizedCommand) || 
    ALLOWED_COMMANDS.some(allowed => allowed.endsWith(`/${sanitizedCommand}`))
  
  if (!commandAllowed) {
    logger.warn(`Command not allowed: ${command}`)
    throw new Error('Command not allowed')
  }

  let fullCommand = sanitizedCommand
  if (!sanitizedCommand.startsWith('/')) {
    const found = ALLOWED_COMMANDS.find(allowed => allowed.endsWith(`/${sanitizedCommand}`))
    if (found) {
      fullCommand = found
    }
  }

  logger.info(`Executing command: ${fullCommand} ${sanitizedArgs.join(' ')}`)

  return new Promise((resolve, reject) => {
    execFile(fullCommand, sanitizedArgs, options, (error, stdout, stderr) => {
      const stdoutStr = typeof stdout === 'string' ? stdout : stdout.toString()
      const stderrStr = typeof stderr === 'string' ? stderr : stderr.toString()
      if (error) {
        logger.error(`Command execution failed: ${error.message}`)
        reject({ stdout: stdoutStr, stderr: stderrStr, error })
      } else {
        logger.debug(`Command executed successfully: ${stdoutStr}`)
        resolve({ stdout: stdoutStr, stderr: stderrStr })
      }
    })
  })
}

export async function executeSudoCommand(command: string, args: string[] = [], options: ExecFileOptions = {}): Promise<{ stdout: string; stderr: string }> {
  const sanitizedCommand = sanitizeCommand(command)
  const sanitizedArgs = sanitizeArgs(args)

  const commandAllowed = SUDO_COMMANDS.includes(sanitizedCommand) || 
    SUDO_COMMANDS.some(allowed => allowed.endsWith(`/${sanitizedCommand}`))
  
  if (!commandAllowed) {
    logger.warn(`Sudo command not allowed: ${command}`)
    throw new Error('Sudo command not allowed')
  }

  let fullCommand = sanitizedCommand
  if (!sanitizedCommand.startsWith('/')) {
    const found = SUDO_COMMANDS.find(allowed => allowed.endsWith(`/${sanitizedCommand}`))
    if (found) {
      fullCommand = found
    }
  }

  const sudoArgs = ['-n', fullCommand, ...sanitizedArgs]

  logger.info(`Executing sudo command: sudo -n ${fullCommand} ${sanitizedArgs.join(' ')}`)

  return new Promise((resolve, reject) => {
    execFile('/usr/bin/sudo', sudoArgs, options, (error, stdout, stderr) => {
      const stdoutStr = typeof stdout === 'string' ? stdout : stdout.toString()
      const stderrStr = typeof stderr === 'string' ? stderr : stderr.toString()
      if (error) {
        logger.error(`Sudo command execution failed: ${error.message}`)
        reject({ stdout: stdoutStr, stderr: stderrStr, error })
      } else {
        logger.debug(`Sudo command executed successfully: ${stdoutStr}`)
        resolve({ stdout: stdoutStr, stderr: stderrStr })
      }
    })
  })
}

export async function executeShellCommand(command: string, onOutput?: (output: string) => void): Promise<{ stdout: string; stderr: string }> {
  const sanitized = sanitizeCommand(command)
  
  logger.info(`Executing shell command: ${sanitized}`)

  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    
    const child = exec(sanitized)
    
    child.stdout?.on('data', (data) => {
      const str = typeof data === 'string' ? data : data.toString()
      stdout += str
      onOutput?.(str)
    })
    
    child.stderr?.on('data', (data) => {
      const str = typeof data === 'string' ? data : data.toString()
      stderr += str
      onOutput?.(str)
    })
    
    child.on('error', (error) => {
      logger.error(`Shell command execution failed: ${error.message}`)
      reject({ stdout, stderr, error })
    })
    
    child.on('close', (code) => {
      if (code === 0) {
        logger.debug(`Shell command executed successfully: ${stdout}`)
        resolve({ stdout, stderr })
      } else {
        logger.error(`Shell command exited with code ${code}`)
        reject({ stdout, stderr, error: new Error(`Command exited with code ${code}`) })
      }
    })
  })
}
