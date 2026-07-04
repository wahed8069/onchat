import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

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

export async function POST(request) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Create a clean filename
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${Date.now()}-${safeName}`;
    const filepath = path.join(uploadDir, filename);

    // Save file
    fs.writeFileSync(filepath, buffer);

    const imageUrl = `/uploads/${filename}`;
    return Response.json({ success: true, url: imageUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
