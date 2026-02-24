module.exports = function(io, prisma) {
  io.on('connection', (socket) => {
    console.log('New client connected');

    // Join conversation room
    socket.on('join-conversation', async (conversationId) => {
      socket.join(`conversation-${conversationId}`);
      
      try {
        const messages = await prisma.message.findMany({
          where: { conversationId },
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'asc' },
          take: 50
        });

        socket.emit('conversation-history', messages);
      } catch (error) {
        console.error('Error fetching conversation history:', error);
      }
    });

    // Send message
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, content, senderId } = data;

        // Save message to database
        const message = await prisma.message.create({
          data: {
            content,
            conversationId,
            senderId
          },
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
                role: true
              }
            }
          }
        });

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        // Broadcast message to conversation room
        io.to(`conversation-${conversationId}`).emit('new-message', message);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Leave conversation room
    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation-${conversationId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
};