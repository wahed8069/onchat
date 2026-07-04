import { cookies } from 'next/headers';
import { getActiveCall, startCall, updateCallStatus, endActiveCall, readDb } from '@/lib/db';

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

export async function GET() {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activeCall = getActiveCall(currentUser.id);
    if (!activeCall) {
      return Response.json({ activeCall: null });
    }

    // Attach peer information
    const db = readDb();
    const peerId = activeCall.callerId === currentUser.id ? activeCall.receiverId : activeCall.callerId;
    const peer = db.users.find(u => u.id === peerId);
    
    return Response.json({
      activeCall,
      peer: peer ? { id: peer.id, username: peer.username, avatarUrl: peer.avatarUrl } : null
    });
  } catch (error) {
    console.error('Error fetching active call:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, receiverId, type, callId } = await request.json();

    if (action === 'start') {
      if (!receiverId || !type) {
        return Response.json({ error: 'receiverId and type are required' }, { status: 400 });
      }
      const call = startCall({
        callerId: currentUser.id,
        receiverId,
        type
      });
      return Response.json({ success: true, call });
    }

    if (action === 'accept') {
      if (!callId) {
        return Response.json({ error: 'callId is required' }, { status: 400 });
      }
      const call = updateCallStatus(callId, 'connected');
      if (!call) {
        return Response.json({ error: 'Call not found' }, { status: 404 });
      }
      return Response.json({ success: true, call });
    }

    if (action === 'end') {
      endActiveCall(currentUser.id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating call:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
