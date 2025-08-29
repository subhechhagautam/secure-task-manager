 const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Body parsing middleware with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// Initialize SQLite database
const db = new sqlite3.Database('database.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Create tasks table if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Error creating table:', err.message);
    } else {
        console.log('Tasks table ready');
    }
});

// Input validation function
function validateTaskTitle(title) {
    if (!title || typeof title !== 'string') {
        return false;
    }
    if (title.length < 1 || title.length > 200) {
        return false;
    }
    // Basic XSS prevention
    if (title.includes('<script') || title.includes('javascript:')) {
        return false;
    }
    return true;
}

// API Routes
app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/tasks', (req, res) => {
    const { title } = req.body;
    
    if (!validateTaskTitle(title)) {
        return res.status(400).json({ 
            error: 'Invalid title. Must be 1-200 characters and contain no scripts.' 
        });
    }
    
    const sanitizedTitle = title.trim();
    
    db.run('INSERT INTO tasks (title) VALUES (?)', [sanitizedTitle], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ 
            id: this.lastID, 
            title: sanitizedTitle, 
            completed: false,
            created_at: new Date().toISOString()
        });
    });
});

app.put('/api/tasks/:id/toggle', (req, res) => {
    const { id } = req.params;
    
    // Validate ID is a number
    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    db.run('UPDATE tasks SET completed = NOT completed WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ success: true });
    });
});

app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    
    // Validate ID is a number
    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ success: true });
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});
