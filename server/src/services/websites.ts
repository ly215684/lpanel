import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { executeSudoCommand } from '../core/command'
import { hashPassword } from '../core/security'

const prisma = new PrismaClient()

const NGINX_CONFIG_DIR = '/etc/nginx/sites-available'
const NGINX_ENABLED_DIR = '/etc/nginx/sites-enabled'
const APACHE_CONFIG_DIR = '/etc/apache2/sites-available'
const APACHE_ENABLED_DIR = '/etc/apache2/sites-enabled'

function generateNginxConfig(domain: string, rootPath: string): string {
  return `server {
    listen 80;
    server_name ${domain};
    root ${rootPath};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }
}`
}

function generateNginxSSLConfig(domain: string, rootPath: string, certPath: string, keyPath: string): string {
  return `server {
    listen 80;
    server_name ${domain};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name ${domain};
    root ${rootPath};
    index index.html index.htm;

    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};

    location / {
        try_files $uri $uri/ =404;
    }
}`
}

export async function createWebsite(data: { name: string; domain: string; web_server: string; root_path: string }) {
  const configDir = data.web_server === 'nginx' ? NGINX_CONFIG_DIR : APACHE_CONFIG_DIR
  const enabledDir = data.web_server === 'nginx' ? NGINX_ENABLED_DIR : APACHE_ENABLED_DIR
  const configPath = path.join(configDir, `${data.domain}.conf`)

  if (data.web_server === 'nginx') {
    await fs.promises.writeFile(configPath, generateNginxConfig(data.domain, data.root_path))
    await executeSudoCommand('/usr/bin/ln', ['-sf', configPath, path.join(enabledDir, `${data.domain}.conf`)])
  }

  const website = await prisma.website.create({
    data: {
      name: data.name,
      domain: data.domain,
      web_server: data.web_server,
      config_path: configPath,
      ssl_enabled: false,
      status: 'running'
    }
  })

  return website
}

export async function getWebsites() {
  return prisma.website.findMany()
}

export async function getWebsite(id: string) {
  return prisma.website.findUnique({ where: { id } })
}

export async function updateWebsite(id: string, data: Partial<{ name: string; domain: string; ssl_enabled: boolean }>) {
  return prisma.website.update({
    where: { id },
    data
  })
}

export async function deleteWebsite(id: string) {
  const website = await prisma.website.findUnique({ where: { id } })
  if (!website) return

  await fs.promises.unlink(website.config_path).catch(() => {})

  const enabledDir = website.web_server === 'nginx' ? NGINX_ENABLED_DIR : APACHE_ENABLED_DIR
  const enabledPath = path.join(enabledDir, `${website.domain}.conf`)
  await fs.promises.unlink(enabledPath).catch(() => {})

  return prisma.website.delete({ where: { id } })
}

export async function enableSSL(id: string) {
  const website = await prisma.website.findUnique({ where: { id } })
  if (!website) throw new Error('Website not found')

  if (website.web_server !== 'nginx') {
    throw new Error('SSL only supported for Nginx')
  }

  const certPath = `/etc/letsencrypt/live/${website.domain}/fullchain.pem`
  const keyPath = `/etc/letsencrypt/live/${website.domain}/privkey.pem`

  await fs.promises.writeFile(website.config_path, generateNginxSSLConfig(website.domain, '/var/www/html', certPath, keyPath))

  return prisma.website.update({
    where: { id },
    data: { ssl_enabled: true, ssl_cert_path: certPath, ssl_key_path: keyPath }
  })
}

export async function restartWebServer(webServer: string) {
  const command = webServer === 'nginx' ? '/usr/sbin/nginx' : '/usr/sbin/apache2'
  await executeSudoCommand(command, ['-s', 'reload'])
}
