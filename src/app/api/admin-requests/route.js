import { cookies } from 'next/headers';
import { createAdminRequest, getAdminRequests, updateAdminRequestStatus } from '@/lib/db';

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

// GET: Super admin fetches all admin requests
export async function GET() {
  const currentUser = await getSessionUser();
  if (!currentUser || currentUser.role !== 'superadmin') {
    return Response.json({ error: 'Unauthorized. Super Admin access required.' }, { status: 401 });
  }

  try {
    const requests = getAdminRequests();
    return Response.json({ requests });
  } catch (error) {
    console.error('Error fetching admin requests:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Public submission of a new Admin Request from Login page
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, phone, password, place, photo, paymentPlan } = body;

    if (!email || !phone || !password || !place) {
      return Response.json(
        { error: 'Email, phone, password, and place (location) are required.' },
        { status: 400 }
      );
    }

    // Basic email validation
    if (!email.includes('@')) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const newRequest = createAdminRequest({
      email,
      phone,
      password,
      place,
      photo: photo || '/uploads/avatar-admin.png',
      paymentPlan: paymentPlan || 'Pro Plan'
    });

    return Response.json({ success: true, request: newRequest }, { status: 201 });
  } catch (error) {
    console.error('Error creating admin request:', error);
    return Response.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PATCH: Super admin approves or rejects an admin request
export async function PATCH(request) {
  const currentUser = await getSessionUser();
  if (!currentUser || currentUser.role !== 'superadmin') {
    return Response.json({ error: 'Unauthorized. Super Admin access required.' }, { status: 401 });
  }

  try {
    const { requestId, action } = await request.json();

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'requestId and valid action (approve or reject) are required.' }, { status: 400 });
    }

    const result = updateAdminRequestStatus(requestId, action);
    return Response.json(result);
  } catch (error) {
    console.error('Error updating admin request:', error);
    return Response.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
