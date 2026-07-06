import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { getSettings, updateSettings, type PanelSettings } from '../services/settings'

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async (request, reply) => {
    try {
      const settings = await getSettings()
      reply.send(settings)
    } catch (error: any) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message })
    }
  })

  fastify.put('/', { preHandler: authenticate }, async (request, reply) => {
    try {
      const settings = request.body as Partial<PanelSettings>
      const updatedSettings = await updateSettings(settings)
      reply.send(updatedSettings)
    } catch (error: any) {
      reply.status(400).send({ error: 'Bad Request', message: error.message })
    }
  })
}