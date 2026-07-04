import { cookies } from 'next/headers';
import { getUsers, createUser } from '@/lib/db';

async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    if (!userCookie) return null;
    
    let user;
    try {
      user = JSON.parse(decodeURIComponent(userCookie.value));
    } catch (e) {
      user = JSON.parse(userCookie.value);
    }
    return user;
  } catch (e) {
    return null;
  }
}

export async function GET() {
  const currentUser = await getSessionUser();
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = getUsers();
    let filteredUsers = [];
    
    if (currentUser.role === 'superadmin') {
      // Super Admin sees and manages only regular Admins (exclude superadmin and regular users)
      filteredUsers = users.filter(u => u.role === 'admin');
    } else {
      // Regular Admin sees and manages regular Users (exclude other admins and superadmin)
      filteredUsers = users.filter(u => u.role === 'user');
    }
    
    return Response.json({ users: filteredUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  const currentUser = await getSessionUser();
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username, password, avatarUrl } = await request.json();

    if (!username || !password) {
      return Response.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const lowerUsername = username.toLowerCase();
    if (lowerUsername === 'admin' || lowerUsername === 'superadmin') {
      return Response.json(
        { error: 'Reserved username' },
        { status: 400 }
      );
    }

    // Determine role based on creator:
    // If superadmin creates, role is 'admin'.
    // If admin creates, role is 'user'.
    const targetRole = currentUser.role === 'superadmin' ? 'admin' : 'user';

    const newUser = createUser(username, password, targetRole, avatarUrl, currentUser.id);
    return Response.json({ success: true, user: newUser }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return Response.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
