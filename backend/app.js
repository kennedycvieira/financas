// File: server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Use env variable in production
require('dotenv').config();
// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
  user: process.env.DB_USER ,//|| 'postgres',
  host: process.env.DB_HOST ,//|| 'localhost',
  database: process.env.DB_NAME,// || 'expense_tracker',
  password: process.env.DB_PASSWORD,// || 'postgres',
  port: process.env.DB_PORT ,//|| 5432,
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Database initialization
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS expense_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER REFERENCES expense_groups(id),
        user_id INTEGER REFERENCES users(id),
        PRIMARY KEY (group_id, user_id)
      );
      
      CREATE TABLE IF NOT EXISTS expense_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS group_invites(
      id SERIAL PRIMARY KEY,
      sender_id INTEGER REFERENCES users,
      receiver_id INTEGER REFERENCES users,
      group_id INTEGER REFERENCES expenses_groups,
      description VARCHAR(140),
      status VARCHAR(20) CHECK (status IN ('accepted', 'rejected', 'pending','revoked'))
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_invite UNIQUE(sender_id,receiver_id,group_id)
      );
      
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES expense_groups(id),
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        category_id INTEGER REFERENCES expense_categories(id),
        paid_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Insert default expense categories
      INSERT INTO expense_categories (name)
      VALUES ('Groceries'), ('Rent'), ('Utilities'), ('Entertainment'), ('Transportation'), ('Other')
      ON CONFLICT DO NOTHING;
    `);
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Initialize database on startup
//initDb();

// Authentication Routes
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    // Check if user already exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Group Routes
app.post('/api/groups', authenticateToken, async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;
  
  try {
    // Create group
    const groupResult = await pool.query(
      'INSERT INTO expense_groups (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, userId]
    );
    
    const group = groupResult.rows[0];
    
    // Add creator as member
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, userId]
    );
    
    res.status(201).json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.* FROM expense_groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const { username } = req.body;
  
  try {
    // Check if group exists and user is a member
    const groupCheck = await pool.query(
      `SELECT * FROM group_members 
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.user.id]
    );
    
    if (groupCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Find user by username
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Add user to group
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [groupId, userId]
    );
    
    res.status(201).json({ message: 'User added to group' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Expense Categories
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expense_categories');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Expense Routes
app.post('/api/expenses', authenticateToken, async (req, res) => {
  const { groupId, amount, description, categoryId } = req.body;
  const userId = req.user.id;
  
  try {
    // Check if user is member of the group
    const memberCheck = await pool.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Create expense
    const result = await pool.query(
      `INSERT INTO expenses (group_id, amount, description, category_id, paid_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [groupId, amount, description, categoryId, userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/groups/:groupId/expenses', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  
  try {
    // Check if user is member of the group
    const memberCheck = await pool.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get expenses with user and category info
    const result = await pool.query(
      `SELECT e.*, u.username as paid_by_username, c.name as category_name
       FROM expenses e
       JOIN users u ON e.paid_by = u.id
       JOIN expense_categories c ON e.category_id = c.id
       WHERE e.group_id = $1
       ORDER BY e.created_at DESC`,
      [groupId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/groups/:groupId/summary', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  
  try {
    // Check if user is member of the group
    const memberCheck = await pool.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get summary of expenses by user
    const result = await pool.query(
      `SELECT u.id, u.username, SUM(e.amount) as total_paid
       FROM users u
       LEFT JOIN expenses e ON u.id = e.paid_by AND e.group_id = $1
       JOIN group_members gm ON u.id = gm.user_id AND gm.group_id = $1
       GROUP BY u.id, u.username
       ORDER BY total_paid DESC NULLS LAST`,
      [groupId]
    );
    
    // Get total expenses for the group
    const totalResult = await pool.query(
      'SELECT SUM(amount) as total FROM expenses WHERE group_id = $1',
      [groupId]
    );
    
    const total = totalResult.rows[0].total || 0;
    const memberCount = result.rows.length;
    const equalShare = memberCount > 0 ? total / memberCount : 0;
    
    // Calculate balances
    const summary = result.rows.map(user => {
      const paid = parseFloat(user.total_paid || 0);
      const balance = paid - equalShare;
      
      return {
        id: user.id,
        username: user.username,
        totalPaid: paid.toFixed(2),
        equalShare: equalShare.toFixed(2),
        balance: balance.toFixed(2)
      };
    });
    
    res.json({
      total: parseFloat(total).toFixed(2),
      equalShare: equalShare.toFixed(2),
      members: summary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Category summary for a group
app.get('/api/groups/:groupId/categories', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  
  try {
    // Check if user is member of the group
    const memberCheck = await pool.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get expenses by category
    const result = await pool.query(
      `SELECT c.name, SUM(e.amount) as total
       FROM expense_categories c
       LEFT JOIN expenses e ON c.id = e.category_id AND e.group_id = $1
       GROUP BY c.id, c.name
       ORDER BY total DESC NULLS LAST`,
      [groupId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
//----------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------//

//group invite routes
app.get('/api/users/:userId/sentGroupInvites', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  try{
  const result = await pool.query(
    `SELECT * FROM group_invites WHERE sender_id = $1`,
    [userId]
  );
  res.json(result.rows);
  } catch (err) {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
}
});

app.get('/api/users/:userId/receivedGroupInvites', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  try{
  const result = await pool.query(
    `SELECT users.username AS sender_username, group_invites.id, group_invites.sender_id, group_invites.receiver_id, 
              group_invites.group_id, group_invites.description, group_invites.status, group_invites.created_at, 
              expense_groups.name AS group_name
       FROM group_invites 
       INNER JOIN users ON group_invites.sender_id = users.id 
       INNER JOIN expense_groups ON group_invites.group_id = expense_groups.id
       WHERE group_invites.receiver_id = $1;`,
    [userId]
  );
  res.json(result.rows);
  } catch (err) {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
}
});

app.post('/api/users/:userId/groupInvite', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { receiverUsername, groupId, description } = req.body;
  try {
    // Check if user is member of the group
    const memberCheck = await pool.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    //check if recieverUsername exists and get its id
    const receiverResult = await pool.query(
      'SELECT id FROM users WHERE username = $1', [receiverUsername]);
    if (receiverResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const receiverId = receiverResult.rows[0].id;
    // Check if receiver is already a member of the group or has a pending invite
    const inviteCheck = await pool.query(
      `SELECT * FROM group_invites 
       WHERE group_id = $1 AND (receiver_id = $2 OR sender_id = $2)`,
      [groupId, receiverId]
    );
    if(inviteCheck.rows.length > 0){
      return res.status(403).json({ error: 'User already is a member or has a pending invite' });
    }
    // Create group invite
    const result = await pool.query(
      `INSERT INTO group_invites (sender_id, receiver_id, group_id, description, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [userId, receiverId, groupId, description]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
  
app.post('/api/users/:userId/acceptGroupInvite', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { inviteId } = req.body;
  try {
    // Check if user is receiver of the invite
    const inviteCheck = await pool.query(
      'SELECT * FROM group_invites WHERE id = $1 AND receiver_id = $2 AND status = \'pending\'',
      [inviteId, userId]
    );
    
    if (inviteCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid invite' });
    }
    
    // Accept group invite
    await pool.query(
      'UPDATE group_invites SET status = \'accepted\' WHERE id = $1',
      [inviteId]
    );
    
    const invite = inviteCheck.rows[0];
    
    // Add user to group
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [invite.group_id, userId]
    );
    
    res.json({ message: 'Group invite accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
//revoke user invitation
app.post('/api/users/:userId/revokeGroupInvite', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { inviteId } = req.body;
  try {
    // Check if user is sender of the invite
    const inviteCheck = await pool.query(
      'SELECT * FROM group_invites WHERE id = $1 AND sender_id = $2',
      [inviteId, userId]
    );
    
    if (inviteCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid invite' });
    }
    
    // Revoke group invite
    await pool.query(
      'UPDATE group_invites SET status = \'revoked\' WHERE id = $1',
      [inviteId]
    );
    
    res.json({ message: 'Group invite revoked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
//reject user invitation 
app.post('/api/users/:userId/rejectGroupInvite', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { inviteId } = req.body;
  try {
    // Check if user is receiver of the invite
    const inviteCheck = await pool.query(
      'SELECT * FROM group_invites WHERE id = $1 AND receiver_id = $2 AND status = \'pending\'',
      [inviteId, userId]
    );
    
    if (inviteCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid invite' });
    }
    
    // Reject group invite
    await pool.query(
      'UPDATE group_invites SET status = \'rejected\' WHERE id = $1',
      [inviteId]
    );
    
    res.json({ message: 'Group invite rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
);

/*
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/

module.exports = app;