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
      calls: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
  }

  // Seed default admin if no users exist or admin doesn't exist
  const db = readDb();
  if (!db.calls) {
    db.calls = [];
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
    return parsed;
  } catch (error) {
    console.error('Error reading DB file:', error);
    return { users: [], messages: [], calls: [] };
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
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return null;

  const passwordHash = hashPassword(password);
  if (user.passwordHash === passwordHash) {
    // Return user without password hash (but keep username, role, avatarUrl, and ID)
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
}

export function createUser(username, password, role = 'user', avatarUrl = '', creatorId = '') {
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
    creatorId: creatorId
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

// Message Operations
export function getMessagesBetween(user1Id, user2Id) {
  const db = readDb();
  return db.messages.filter(
    m => (m.senderId === user1Id && m.receiverId === user2Id) ||
         (m.senderId === user2Id && m.receiverId === user1Id)
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function saveMessage({ senderId, receiverId, text, imageUrl }) {
  const db = readDb();
  
  const newMessage = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    senderId,
    receiverId,
    text: text || '',
    imageUrl: imageUrl || null,
    timestamp: new Date().toISOString()
  };

  db.messages.push(newMessage);
  writeDb(db);
  return newMessage;
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
