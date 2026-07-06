import { PrismaClient } from '@prisma/client'
import { executeSudoCommand } from '../core/command'
import { hashPassword } from '../core/security'

const prisma = new PrismaClient()

export async function getDatabases() {
  return prisma.database.findMany()
}

export async function getDatabase(id: string) {
  return prisma.database.findUnique({ where: { id } })
}

export async function createDatabase(data: { name: string; type: string; username: string; password: string }) {
  const passwordHash = await hashPassword(data.password)
  const port = data.type === 'mysql' ? 3306 : 5432

  if (data.type === 'mysql') {
    await executeSudoCommand('/usr/bin/mysql', [
      '-e',
      `CREATE DATABASE IF NOT EXISTS ${data.name}; CREATE USER IF NOT EXISTS '${data.username}'@'localhost' IDENTIFIED BY '${data.password}'; GRANT ALL PRIVILEGES ON ${data.name}.* TO '${data.username}'@'localhost'; FLUSH PRIVILEGES;`
    ])
  } else if (data.type === 'postgresql') {
    await executeSudoCommand('/usr/bin/psql', [
      '-U', 'postgres',
      '-c',
      `CREATE DATABASE ${data.name}; CREATE USER ${data.username} WITH PASSWORD '${data.password}'; GRANT ALL PRIVILEGES ON DATABASE ${data.name} TO ${data.username};`
    ])
  }

  return prisma.database.create({
    data: {
      name: data.name,
      type: data.type,
      host: 'localhost',
      port,
      username: data.username,
      password_hash: passwordHash,
      status: 'active'
    }
  })
}

export async function deleteDatabase(id: string) {
  const database = await prisma.database.findUnique({ where: { id } })
  if (!database) return

  if (database.type === 'mysql') {
    await executeSudoCommand('/usr/bin/mysql', [
      '-e',
      `DROP DATABASE IF EXISTS ${database.name}; DROP USER IF EXISTS '${database.username}'@'localhost'; FLUSH PRIVILEGES;`
    ])
  } else if (database.type === 'postgresql') {
    await executeSudoCommand('/usr/bin/dropdb', ['-U', 'postgres', database.name])
    await executeSudoCommand('/usr/bin/dropuser', ['-U', 'postgres', database.username])
  }

  return prisma.database.delete({ where: { id } })
}

export async function backupDatabase(id: string) {
  const database = await prisma.database.findUnique({ where: { id } })
  if (!database) throw new Error('Database not found')

  const backupPath = `/var/backups/${database.name}_${Date.now()}.sql`

  if (database.type === 'mysql') {
    await executeSudoCommand('/usr/bin/mysqldump', [
      `-u${database.username}`,
      `-p${database.password_hash}`,
      database.name,
      '>',
      backupPath
    ])
  } else if (database.type === 'postgresql') {
    await executeSudoCommand('/usr/bin/pg_dump', [
      '-U', database.username,
      database.name,
      '>',
      backupPath
    ])
  }

  const backup = await prisma.backup.create({
    data: {
      database_id: database.id,
      type: 'full',
      path: backupPath,
      size: 0,
      status: 'success'
    }
  })

  return backup
}

export async function getBackups(databaseId: string) {
  return prisma.backup.findMany({ where: { database_id: databaseId } })
}

export async function restoreDatabase(id: string, backupPath: string) {
  const database = await prisma.database.findUnique({ where: { id } })
  if (!database) throw new Error('Database not found')

  if (database.type === 'mysql') {
    await executeSudoCommand('/usr/bin/mysql', [
      `-u${database.username}`,
      `-p${database.password_hash}`,
      database.name,
      '<',
      backupPath
    ])
  } else if (database.type === 'postgresql') {
    await executeSudoCommand('/usr/bin/psql', [
      '-U', database.username,
      database.name,
      '<',
      backupPath
    ])
  }
}
