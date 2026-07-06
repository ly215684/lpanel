import { Server } from 'socket.io'
import { getAllMonitorData } from '../services/monitor'

export function setupMonitorSocket(io: Server) {
  io.on('connection', (socket) => {
    console.log('Client connected')

    const sendMonitorData = async () => {
      try {
        const data = await getAllMonitorData()
        socket.emit('monitor:update', data)
      } catch (error) {
        console.error('Error sending monitor data:', error)
      }
    }

    sendMonitorData()

    const interval = setInterval(sendMonitorData, 5000)

    socket.on('disconnect', () => {
      console.log('Client disconnected')
      clearInterval(interval)
    })
  })
}
