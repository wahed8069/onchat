import { cookies } from 'next/headers';
import { getMessagesBetween, saveMessage, markMessagesAsRead } from '@/lib/db';

async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    if (!userCookie) return null;
    try {
      return JSON.parse(decodeURIComponent(userCookie.value));
    } catch (e) {
      return JSON.parse(userCookie.value);
    }
  } catch (e) {
    return null;
  }
}

export async function GET(request) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  
  try {
    let chatUserId;
    
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      chatUserId = searchParams.get('userId');
      if (!chatUserId) {
        return Response.json({ error: 'userId parameter is required for admin/superadmin' }, { status: 400 });
      }
    } else {
      // User can only get messages with their creator admin (or default admin)
      chatUserId = currentUser.creatorId || 'admin-id';
    }

    // Mark messages from other user as read
    markMessagesAsRead(chatUserId, currentUser.id);

    const messages = getMessagesBetween(currentUser.id, chatUserId);
    return Response.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { text, imageUrl, audioUrl, receiverId } = await request.json();

    let targetReceiverId;
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      if (!receiverId) {
        return Response.json({ error: 'receiverId is required for admin/superadmin' }, { status: 400 });
      }
      targetReceiverId = receiverId;
    } else {
      // Regular users can only send to their creator admin (or default admin)
      targetReceiverId = currentUser.creatorId || 'admin-id';
    }

    if (!text && !imageUrl && !audioUrl) {
      return Response.json({ error: 'Message content, image, or audio is required' }, { status: 400 });
    }

    const newMessage = saveMessage({
      senderId: currentUser.id,
      receiverId: targetReceiverId,
      text,
      imageUrl,
      audioUrl
    });

    return Response.json({ success: true, message: newMessage }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
