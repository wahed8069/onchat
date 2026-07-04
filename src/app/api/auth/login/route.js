import { verifyUser } from '@/lib/db';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = verifyUser(username, password);

    if (!user) {
      return Response.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Return the authenticated user
    return Response.json(
      { success: true, user },
      {
        status: 200,
        headers: {
          'Set-Cookie': `user=${encodeURIComponent(JSON.stringify(user))}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax`
        }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
