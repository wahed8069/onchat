import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_DIR = path.join(process.cwd(), 'src', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure db directory and file exist
function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultDb = {
      users: [],
      messages: [],
      calls: [],
      adminRequests: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
  }

  // Seed default admin if no users exist or admin doesn't exist
  const db = readDb();
  if (!db.calls) {
    db.calls = [];
    writeDb(db);
  }
  if (!db.adminRequests) {
    db.adminRequests = [];
    writeDb(db);
  }
  
  // Seed default superadmin if doesn't exist
  const superAdminExists = db.users.some(u => u.role === 'superadmin');
  if (!superAdminExists) {
    const superPasswordHash = hashPassword('superpassword');
    db.users.push({
      id: 'superadmin-id',
      username: 'superadmin',
      password: 'superpassword',
      passwordHash: superPasswordHash,
      role: 'superadmin',
      avatarUrl: '/uploads/avatar-superadmin.png'
    });
    writeDb(db);
    console.log('Database seeded with default superadmin: username "superadmin", password "superpassword"');
  }

  // Seed default admin if doesn't exist
  const adminExists = db.users.some(u => u.role === 'admin');
  if (!adminExists) {
    const adminPasswordHash = hashPassword('adminpassword');
    db.users.push({
      id: 'admin-id',
      username: 'admin',
      password: 'adminpassword',
      passwordHash: adminPasswordHash,
      role: 'admin',
      avatarUrl: '/uploads/avatar-admin.png',
      creatorId: 'superadmin-id'
    });
    writeDb(db);
    console.log('Database seeded with default admin: username "admin", password "adminpassword"');
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      initDb();
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.calls) parsed.calls = [];
    if (!parsed.adminRequests) parsed.adminRequests = [];
    return parsed;
  } catch (error) {
    console.error('Error reading DB file:', error);
    return { users: [], messages: [], calls: [], adminRequests: [] };
  }
}

export function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing DB file:', error);
    return false;
  }
}

// User CRUD operations
export function verifyUser(username, password) {
  const db = readDb();
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === username.toLowerCase()));
  if (!user) return null;

  const passwordHash = hashPassword(password);
  if (user.passwordHash === passwordHash) {
    // Update last seen on login
    updateUserLastSeen(user.id);
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
}

export function updateUserLastSeen(userId) {
  const db = readDb();
  let updated = false;
  db.users = db.users.map(u => {
    if (u.id === userId) {
      updated = true;
      return { ...u, lastSeen: new Date().toISOString() };
    }
    return u;
  });
  if (updated) {
    writeDb(db);
  }
}

export function createUser(username, password, role = 'user', avatarUrl = '', creatorId = '', extraFields = {}) {
  const db = readDb();
  
  // Check if username already exists
  const exists = db.users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    throw new Error('Username already exists');
  }

  const defaultAvatar = avatarUrl || `/uploads/avatar-${Math.floor(Math.random() * 5) + 1}.png`;

  const newUser = {
    id: role === 'admin'
      ? 'admin-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
      : 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    username: username,
    password: password, // Store raw password so Admin can see it
    passwordHash: hashPassword(password),
    role: role,
    avatarUrl: defaultAvatar,
    creatorId: creatorId,
    lastSeen: new Date().toISOString(),
    ...extraFields
  };

  db.users.push(newUser);
  writeDb(db);

  const { passwordHash, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

export function getUsers() {
  const db = readDb();
  return db.users; // Return everything including password so Admin can see it
}

// Admin Requests Operations
export function createAdminRequest({ email, phone, password, place, photo, paymentPlan }) {
  const db = readDb();

  // Check if email or username already exists in users or pending requests
  const usernameFromEmail = email.split('@')[0];
  const userExists = db.users.some(u => u.username.toLowerCase() === usernameFromEmail.toLowerCase() || (u.email && u.email.toLowerCase() === email.toLowerCase()));
  if (userExists) {
    throw new Error('An account with this email/username already exists');
  }

  const newRequest = {
    id: 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    email,
    phone,
    password,
    place,
    photo: photo || '/uploads/avatar-admin.png',
    paymentPlan: paymentPlan || 'Pro Plan',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.adminRequests.push(newRequest);
  writeDb(db);
  return newRequest;
}

export function getAdminRequests() {
  const db = readDb();
  return db.adminRequests || [];
}

export function updateAdminRequestStatus(requestId, action) {
  const db = readDb();
  const reqIndex = db.adminRequests.findIndex(r => r.id === requestId);
  if (reqIndex === -1) {
    throw new Error('Request not found');
  }

  const req = db.adminRequests[reqIndex];
  if (action === 'approve') {
    // Generate unique username from email
    let baseUsername = req.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    if (!baseUsername) baseUsername = 'admin' + Date.now().toString().slice(-4);
    let username = baseUsername;
    let counter = 1;
    while (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    const createdAdmin = createUser(
      username,
      req.password,
      'admin',
      req.photo,
      'superadmin-id',
      {
        email: req.email,
        phone: req.phone,
        place: req.place,
        paymentPlan: req.paymentPlan
      }
    );

    req.status = 'approved';
    req.approvedAt = new Date().toISOString();
    writeDb(db);
    return { success: true, request: req, user: createdAdmin };
  } else if (action === 'reject') {
    req.status = 'rejected';
    req.rejectedAt = new Date().toISOString();
    writeDb(db);
    return { success: true, request: req };
  } else {
    throw new Error('Invalid action');
  }
}

// Message Operations
export function getMessagesBetween(user1Id, user2Id) {
  const db = readDb();
  return db.messages.filter(
    m => (m.senderId === user1Id && m.receiverId === user2Id) ||
         (m.senderId === user2Id && m.receiverId === user1Id)
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function saveMessage({ senderId, receiverId, text, imageUrl, audioUrl }) {
  const db = readDb();
  
  const newMessage = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    senderId,
    receiverId,
    text: text || '',
    imageUrl: imageUrl || null,
    audioUrl: audioUrl || null,
    timestamp: new Date().toISOString(),
    read: false,
    readAt: null
  };

  db.messages.push(newMessage);
  writeDb(db);
  return newMessage;
}

export function markMessagesAsRead(senderId, receiverId) {
  const db = readDb();
  let updated = false;
  const now = new Date().toISOString();
  db.messages = db.messages.map(m => {
    if (m.senderId === senderId && m.receiverId === receiverId && !m.read) {
      updated = true;
      return { ...m, read: true, readAt: now };
    }
    return m;
  });
  if (updated) {
    writeDb(db);
  }
  return updated;
}

export function deleteMessage(messageId, userId) {
  const db = readDb();
  const index = db.messages.findIndex(m => m.id === messageId);
  if (index === -1) {
    return false;
  }
  const msg = db.messages[index];
  if (msg.senderId === userId || msg.receiverId === userId) {
    db.messages.splice(index, 1);
    writeDb(db);
    return true;
  }
  return false;
}

export function clearChatBetween(user1Id, user2Id) {
  const db = readDb();
  const initialLength = db.messages.length;
  db.messages = db.messages.filter(
    m => !((m.senderId === user1Id && m.receiverId === user2Id) ||
           (m.senderId === user2Id && m.receiverId === user1Id))
  );
  if (db.messages.length !== initialLength) {
    writeDb(db);
    return true;
  }
  return false;
}


// Call Signaling Operations
export function getActiveCall(userId) {
  const db = readDb();
  // Find any call that involves this user and is not ended
  return db.calls.find(
    c => (c.callerId === userId || c.receiverId === userId) && c.status !== 'ended'
  ) || null;
}

export function startCall({ callerId, receiverId, type }) {
  const db = readDb();
  
  // End any existing active calls for caller/receiver first to avoid deadlocks
  db.calls = db.calls.map(c => {
    if ((c.callerId === callerId || c.receiverId === callerId || 
         c.callerId === receiverId || c.receiverId === receiverId) && 
        c.status !== 'ended') {
      return { ...c, status: 'ended' };
    }
    return c;
  });

  const newCall = {
    id: 'call-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    callerId,
    receiverId,
    type, // 'audio' | 'video'
    status: 'ringing', // 'ringing' | 'connected' | 'ended'
    timestamp: new Date().toISOString()
  };

  db.calls.push(newCall);
  writeDb(db);
  return newCall;
}

export function updateCallStatus(callId, status) {
  const db = readDb();
  let updatedCall = null;

  db.calls = db.calls.map(c => {
    if (c.id === callId) {
      updatedCall = { ...c, status };
      return updatedCall;
    }
    return c;
  });

  if (updatedCall) {
    writeDb(db);
  }
  return updatedCall;
}

export function endActiveCall(userId) {
  const db = readDb();
  let updated = false;

  db.calls = db.calls.map(c => {
    if ((c.callerId === userId || c.receiverId === userId) && c.status !== 'ended') {
      updated = true;
      return { ...c, status: 'ended' };
    }
    return c;
  });

  if (updated) {
    writeDb(db);
  }
  return updated;
}

// Auto-init on load
initDb();

