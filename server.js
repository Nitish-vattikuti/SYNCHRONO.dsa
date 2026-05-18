const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5050;
const DB_PATH = path.join(__dirname, 'scheduler.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database at', DB_PATH);
        initializeDatabase();
    }
});

// Setup Database Schema
function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                active_schedule_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Schedules table
        db.run(`
            CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                creator_id INTEGER NOT NULL,
                is_shared INTEGER DEFAULT 0,
                share_code TEXT UNIQUE,
                duration_days INTEGER DEFAULT 30,
                FOREIGN KEY(creator_id) REFERENCES users(id)
            )
        `);

        // Schedule Items table
        db.run(`
            CREATE TABLE IF NOT EXISTS schedule_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schedule_id INTEGER NOT NULL,
                day_number INTEGER NOT NULL,
                time_start TEXT NOT NULL,
                time_end TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT CHECK(category IN ('practice', 'dsa', 'internship', 'aptitude', 'gap')),
                FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
            )
        `);

        // Completions table
        db.run(`
            CREATE TABLE IF NOT EXISTS completions (
                user_id INTEGER NOT NULL,
                schedule_item_id INTEGER NOT NULL,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(user_id, schedule_item_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(schedule_item_id) REFERENCES schedule_items(id) ON DELETE CASCADE
            )
        `);

        // Daily Logs table (notes, mood, focus)
        db.run(`
            CREATE TABLE IF NOT EXISTS daily_logs (
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                mood TEXT,
                notes TEXT,
                PRIMARY KEY(user_id, date),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('SQLite database schema initialized.');
    });
}

// 30-Day Python DSA Chapter Curriculum Mapping
const dsaChapters = [
    { course: 1, ch: 1, title: 'Algorithms Intro', desc: 'What algorithms are and why efficiency matters in software engineering.' },
    { course: 1, ch: 2, title: 'Math', desc: 'Core mathematical logic: exponents, logarithms, and factorials.' },
    { course: 1, ch: 3, title: 'Big-O Analysis', desc: 'Time and space complexities like O(1), O(n), and O(n log n).' },
    { course: 0, ch: 0, title: 'Big-O & Math Practice', desc: 'Apply mathematical logic & Big-O notation on test questions.' },
    { course: 1, ch: 4, title: 'Sorting (Part 1)', desc: 'Basic sorting mechanisms: Bubble Sort, Selection Sort, Insertion Sort.' },
    { course: 1, ch: 4, title: 'Sorting (Part 2)', desc: 'Advanced sorting mechanisms: Merge Sort and Quick Sort.' },
    { course: 1, ch: 5, title: 'Exponential Time', desc: 'Identifying and avoiding dangerous time complexities like O(2^n) and O(n!).' },
    { course: 1, ch: 6, title: 'Data Structures Intro', desc: 'Overview of memory management and why custom data layouts are necessary.' },
    { course: 1, ch: 7, title: 'Stacks', desc: 'Building and using Last-In, First-Out (LIFO) memory structures.' },
    { course: 1, ch: 8, title: 'Queues', desc: 'Building and using First-In, First-Out (FIFO) structures.' },
    { course: 1, ch: 9, title: 'Linked Lists (Part 1)', desc: 'Memory pointers, nodes, singly linked chains, and structural optimizations.' },
    { course: 1, ch: 9, title: 'Linked Lists (Part 2)', desc: 'Doubly linked chains, traversal, insertion, deletion speedups.' },
    { course: 1, ch: 10, title: 'Binary Trees', desc: 'Hierarchical data, root/child relationships, and Binary Search Trees (BST).' },
    { course: 1, ch: 11, title: 'Red-Black Trees', desc: 'Advanced self-balancing logic to counter worst-case tree lookup times.' },
    { course: 1, ch: 12, title: 'Hashmaps', desc: 'Key-value mappings, handling collisions, and how Python dictionaries operate.' },
    { course: 0, ch: 0, title: 'Mid-Term Progress Check', desc: 'Comprehensive review and mock coding challenges on Stacks, Queues, Lists, and Hashmaps.' },
    { course: 1, ch: 13, title: 'Tries', desc: 'Prefix trees optimized for autocomplete, spellchecks, and fast text parsing.' },
    { course: 1, ch: 14, title: 'Graphs', desc: 'Multi-node networks consisting of vertices and edges (directed, undirected).' },
    { course: 1, ch: 15, title: 'BFS and DFS', desc: 'Breadth-First Search and Depth-First Search graph traversal logic.' },
    { course: 1, ch: 16, title: 'P vs NP', desc: 'Limits of computation, complexity classes, and hard-to-solve algorithmic problems.' },
    { course: 2, ch: 1, title: "Dijkstra's Algorithm", desc: 'Implementing the single-source shortest path algorithm on positive-weighted graphs.' },
    { course: 2, ch: 2, title: 'Bellman-Ford', desc: 'Tracking shortest paths on weighted graphs supporting negative edges.' },
    { course: 2, ch: 3, title: 'Heaps', desc: 'Implementing min-heaps and max-heaps to run optimal O(1) priority queues.' },
    { course: 2, ch: 4, title: 'A* Search', desc: 'Combining path costs with smart heuristics to efficiently guide search pathways.' },
    { course: 2, ch: 5, title: 'Dynamic Programming (1)', desc: 'Memoization concepts, dynamic tabulation strategies, and Fibonacci optimizations.' },
    { course: 2, ch: 5, title: 'Dynamic Programming (2)', desc: 'Advanced DP: Knapsack problems, Longest Common Subsequence (LCS) mapping.' },
    { course: 2, ch: 6, title: 'Edit Distance', desc: 'Solving string mutation distance matrix calculations using dynamic programming.' },
    { course: 2, ch: 7, title: 'Linear Programming', desc: 'Modeling multi-variable constraint problems and using optimization solvers.' },
    { course: 0, ch: 0, title: 'Capstone Coding Lab', desc: 'Construct a full practical script integrating graph routing, hashing, and heap sorting.' },
    { course: 0, ch: 0, title: 'Final Review & Graduation', desc: 'Review entire course load. Test final aptitude benchmarks and award completions.' }
];

// Helper to prepopulate standard 30-Day timetable
function populate30DayDSA(scheduleId, callback) {
    const items = [];
    
    for (let day = 1; day <= 30; day++) {
        const dsaCh = dsaChapters[day - 1];

        // 1. Certification & Practice (05:30 - 06:30)
        items.push([
            scheduleId, day, '05:30', '06:30',
            `Certification Prep & Code Practice`,
            `Work on self-paced software certifications (e.g. AWS, Python Certs, freeCodeCamp).`,
            'practice'
        ]);

        // 2. Gap (06:30 - 09:00)
        items.push([
            scheduleId, day, '06:30', '09:00',
            `Interactive Gap: Morning Refresh & Walk`,
            `Have breakfast, chat with friends, take a refreshing walk to boost cognitive capacity.`,
            'gap'
        ]);

        // 3. DSA Block (09:00 - 12:00)
        items.push([
            scheduleId, day, '09:00', '12:00',
            `Learn DSA with Python: ${dsaCh.title}`,
            `[YouTube Classes & Boot.dev] Course ${dsaCh.course === 2 ? '2 (Advanced)' : '1 (Foundations)'} - Ch ${dsaCh.ch}: ${dsaCh.desc}`,
            'dsa'
        ]);

        // 4. Gap (12:00 - 15:00)
        items.push([
            scheduleId, day, '12:00', '15:00',
            `Interactive Gap: Co-Op Social & Lunch`,
            `Take standard lunch break. Catch up with friends, compare learning logs, rest and recharge.`,
            'gap'
        ]);

        // 5. Internship Block (15:00 - 18:00)
        items.push([
            scheduleId, day, '15:00', '18:00',
            `Internship Hours`,
            `Work on assigned internship projects, tasks, code revisions, and collaborative sprint features.`,
            'internship'
        ]);

        // 6. Gap (18:00 - 20:00)
        items.push([
            scheduleId, day, '18:00', '20:00',
            `Interactive Gap: Rest, Play, Socialize`,
            `Wind down from work. Spend quality interactive time with friends, stretch, exercise, or play.`,
            'gap'
        ]);

        // 7. Aptitude Block (20:00 - 21:00)
        items.push([
            scheduleId, day, '20:00', '21:00',
            `Aptitude Practice (IndiaBIX)`,
            `Go to IndiaBIX. Focus on Quantitative Aptitude, Logical Reasoning, and Verbal Ability tests.`,
            'aptitude'
        ]);
    }

    // Batch insert items
    let placeholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sql = `INSERT INTO schedule_items (schedule_id, day_number, time_start, time_end, title, description, category) VALUES ${placeholders}`;
    const flatItems = items.flat();

    db.run(sql, flatItems, function(err) {
        if (err) {
            console.error('Error inserting schedule items:', err);
            if (callback) callback(err);
        } else {
            console.log(`Prepopulated ${this.changes} default items for schedule ID ${scheduleId}`);
            if (callback) callback(null);
        }
    });
}

// Password hashing utility
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Generates an alphanumeric code
function generateCode(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing 1, l, 0, O
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Dynamic timezone-aware day streak calculator (no hallucinations!)
function getUserStreak(userId, callback) {
    db.all(
        `SELECT DISTINCT active_date FROM (
            SELECT strftime('%Y-%m-%d', completed_at, 'localtime') AS active_date FROM completions WHERE user_id = ?
            UNION
            SELECT date AS active_date FROM daily_logs WHERE user_id = ?
         ) ORDER BY active_date DESC`,
        [userId, userId],
        (err, rows) => {
            if (err || !rows) return callback(0);
            
            const activeDates = rows.map(r => r.active_date);
            
            // Helper to get local date string YYYY-MM-DD
            const getLocalDateString = (d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const date = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${date}`;
            };
            
            const todayStr = getLocalDateString(new Date());
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalDateString(yesterday);
            
            const dateSet = new Set(activeDates);
            
            // If neither today nor yesterday has activity, streak is 0
            if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) {
                return callback(0);
            }
            
            let currentStreak = 0;
            // If active today, count backwards starting today, else starting yesterday
            let checkDate = dateSet.has(todayStr) ? new Date() : yesterday;
            
            while (true) {
                const checkStr = getLocalDateString(checkDate);
                if (dateSet.has(checkStr)) {
                    currentStreak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }
            
            callback(currentStreak);
        }
    );
}


/* ==========================================================================
   AUTHENTICATION ROUTES
   ========================================================================== */

// Register Endpoint
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    const hashedPassword = hashPassword(password);
    db.run(
        `INSERT INTO users (username, password) VALUES (?, ?)`,
        [username.trim(), hashedPassword],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username already exists.' });
                }
                return res.status(500).json({ error: 'Database registration error.' });
            }
            
            const userId = this.lastID;
            
            // Create their default 30-Day schedule
            db.run(
                `INSERT INTO schedules (name, creator_id) VALUES (?, ?)`,
                [`My 30-Day Python DSA Schedule`, userId],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to create default timetable.' });
                    }
                    const scheduleId = this.lastID;
                    
                    // Populate schedule
                    populate30DayDSA(scheduleId, (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Error populating timetable elements.' });
                        }
                        
                        // Set active schedule
                        db.run(
                            `UPDATE users SET active_schedule_id = ? WHERE id = ?`,
                            [scheduleId, userId],
                            () => {
                                res.status(201).json({
                                    message: 'Registration successful!',
                                    user: { id: userId, username: username.trim(), active_schedule_id: scheduleId }
                                });
                            }
                        );
                    });
                }
            );
        }
    );
});

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    const hashedPassword = hashPassword(password);
    db.get(
        `SELECT id, username, active_schedule_id FROM users WHERE username = ? AND password = ?`,
        [username.trim(), hashedPassword],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database authentication error.' });
            }
            if (!row) {
                return res.status(401).json({ error: 'Invalid username or password.' });
            }
            res.json({ message: 'Login successful!', user: row });
        }
    );
});


/* ==========================================================================
   SCHEDULE ROUTES
   ========================================================================== */

// Get Active Schedule & Co-Op Sync Progress
app.get('/api/schedule/active', (req, res) => {
    const usernameHeader = req.headers['x-username'];
    if (!usernameHeader) {
        return res.status(401).json({ error: 'Unauthorized. x-username header missing.' });
    }

    // 1. Get user details
    db.get(`SELECT id, active_schedule_id FROM users WHERE username = ?`, [usernameHeader], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (!user.active_schedule_id) {
            return res.json({ message: 'No active schedule', activeSchedule: null });
        }

        // 2. Get schedule details
        db.get(`SELECT * FROM schedules WHERE id = ?`, [user.active_schedule_id], (err, schedule) => {
            if (err || !schedule) {
                return res.status(404).json({ error: 'Active schedule not found.' });
            }

            // 3. Get all items in this schedule
            db.all(
                `SELECT * FROM schedule_items WHERE schedule_id = ? ORDER BY day_number, time_start`,
                [schedule.id],
                (err, items) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error fetching schedule details.' });
                    }

                    // 4. Find all users connected to this active schedule
                    db.all(
                        `SELECT id, username FROM users WHERE active_schedule_id = ?`,
                        [schedule.id],
                        (err, members) => {
                            if (err) return res.status(500).json({ error: 'Error querying network.' });

                            const userIds = members.map(m => m.id);
                            
                            // Check who is the linked friend (if any)
                            const friend = members.find(m => m.id !== user.id);

                            // 5. Query completions for ALL members in this schedule
                            db.all(
                                `SELECT * FROM completions WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
                                userIds,
                                (err, completions) => {
                                    if (err) return res.status(500).json({ error: 'Error fetching completions.' });

                                    // Format completions maps
                                    const myCompletions = completions
                                        .filter(c => c.user_id === user.id)
                                        .map(c => c.schedule_item_id);

                                    const friendCompletions = completions
                                        .filter(c => c.user_id === (friend ? friend.id : null))
                                        .map(c => c.schedule_item_id);

                                    // Fetch user streaks dynamically (no hallucinations!)
                                    getUserStreak(user.id, (myStreak) => {
                                        if (friend) {
                                            getUserStreak(friend.id, (friendStreak) => {
                                                res.json({
                                                    activeSchedule: {
                                                        id: schedule.id,
                                                        name: schedule.name,
                                                        is_shared: schedule.is_shared,
                                                        share_code: schedule.share_code,
                                                        duration_days: schedule.duration_days,
                                                        creator_id: schedule.creator_id,
                                                        items: items
                                                    },
                                                    coop: {
                                                        is_linked: true,
                                                        friend_username: friend.username,
                                                        my_completed_ids: myCompletions,
                                                        friend_completed_ids: friendCompletions,
                                                        my_streak: myStreak,
                                                        friend_streak: friendStreak
                                                    }
                                                });
                                            });
                                        } else {
                                            res.json({
                                                activeSchedule: {
                                                    id: schedule.id,
                                                    name: schedule.name,
                                                    is_shared: schedule.is_shared,
                                                    share_code: schedule.share_code,
                                                    duration_days: schedule.duration_days,
                                                    creator_id: schedule.creator_id,
                                                    items: items
                                                },
                                                coop: {
                                                    is_linked: false,
                                                    friend_username: null,
                                                    my_completed_ids: myCompletions,
                                                    friend_completed_ids: friendCompletions,
                                                    my_streak: myStreak,
                                                    friend_streak: 0
                                                }
                                            });
                                        }
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

// Toggle Completions
app.post('/api/schedule/item/toggle', (req, res) => {
    const usernameHeader = req.headers['x-username'];
    const { itemId, completed } = req.body;

    if (!usernameHeader || itemId === undefined || completed === undefined) {
        return res.status(400).json({ error: 'Missing parameters.' });
    }

    db.get(`SELECT id FROM users WHERE username = ?`, [usernameHeader], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (completed) {
            // Insert completion
            db.run(
                `INSERT OR IGNORE INTO completions (user_id, schedule_item_id) VALUES (?, ?)`,
                [user.id, itemId],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Failed to save completion check.' });
                    res.json({ success: true, completed: true });
                }
            );
        } else {
            // Delete completion
            db.run(
                `DELETE FROM completions WHERE user_id = ? AND schedule_item_id = ?`,
                [user.id, itemId],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Failed to remove completion check.' });
                    res.json({ success: true, completed: false });
                }
            );
        }
    });
});

// Create Custom Schedule
app.post('/api/schedule/create-custom', (req, res) => {
    const usernameHeader = req.headers['x-username'];
    const { name, duration_days, items } = req.body; // items: array of {day_number, time_start, time_end, title, description, category}

    if (!usernameHeader || !name || !items || !items.length) {
        return res.status(400).json({ error: 'Schedule name, days count, and schedule items are required.' });
    }

    db.get(`SELECT id FROM users WHERE username = ?`, [usernameHeader], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // 1. Insert schedule row
        db.run(
            `INSERT INTO schedules (name, creator_id, duration_days) VALUES (?, ?, ?)`,
            [name.trim(), user.id, duration_days || 7],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed to create schedule metadata.' });
                const scheduleId = this.lastID;

                // 2. Format schedule items
                const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
                const sql = `INSERT INTO schedule_items (schedule_id, day_number, time_start, time_end, title, description, category) VALUES ${placeholders}`;
                
                const flatItems = [];
                items.forEach(item => {
                    flatItems.push(
                        scheduleId,
                        parseInt(item.day_number) || 1,
                        item.time_start || '00:00',
                        item.time_end || '01:00',
                        item.title.trim(),
                        item.description ? item.description.trim() : '',
                        item.category || 'dsa'
                    );
                });

                // 3. Batch insert items
                db.run(sql, flatItems, (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to insert custom timetable cards.' });
                    }

                    // 4. Update user active schedule
                    db.run(`UPDATE users SET active_schedule_id = ? WHERE id = ?`, [scheduleId, user.id], () => {
                        res.status(201).json({
                            message: 'Custom schedule created successfully and set as active!',
                            scheduleId: scheduleId
                        });
                    });
                });
            }
        );
    });
});


/* ==========================================================================
   CO-OP SYNC & COLLABORATION ROUTES
   ========================================================================== */

// Generate Share Code
app.get('/api/coop/generate-code', (req, res) => {
    const usernameHeader = req.headers['x-username'];
    if (!usernameHeader) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }

    db.get(`SELECT id, active_schedule_id FROM users WHERE username = ?`, [usernameHeader], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found.' });
        if (!user.active_schedule_id) return res.status(400).json({ error: 'No active schedule to share.' });

        // Generate sync code
        const code = `SYNC-${generateCode(4)}`;
        
        db.run(
            `UPDATE schedules SET is_shared = 1, share_code = ? WHERE id = ?`,
            [code, user.active_schedule_id],
            (err) => {
                if (err) return res.status(500).json({ error: 'Failed to generate invite link.' });
                res.json({ success: true, share_code: code });
            }
        );
    });
});

// Join Shared Schedule
app.post('/api/coop/join', (req, res) => {
    const usernameHeader = req.headers['x-username'];
    const { shareCode } = req.body;

    if (!usernameHeader || !shareCode) {
        return res.status(400).json({ error: 'Share code is required.' });
    }

    db.get(`SELECT id FROM users WHERE username = ?`, [usernameHeader], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found.' });

        // Look up schedule by share code
        db.get(`SELECT id, name FROM schedules WHERE share_code = ?`, [shareCode.trim().toUpperCase()], (err, schedule) => {
            if (err) return res.status(500).json({ error: 'Lookup failed.' });
            if (!schedule) return res.status(404).json({ error: 'Invalid share code. Schedule not found.' });

            // Link user to this schedule
            db.run(
                `UPDATE users SET active_schedule_id = ? WHERE id = ?`,
                [schedule.id, user.id],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Linking failed.' });
                    res.json({ success: true, message: `Successfully joined ${schedule.name}!`, scheduleId: schedule.id });
                }
            );
        });
    });
});

// Unlink Shared Schedule
app.post('/api/coop/unlink', (req, res) => {
    const usernameHeader = req.headers['x-username'];
    const { action } = req.body; // 'branch' (save copy) or 'clean' (reset completely)

    if (!usernameHeader || !action) {
        return res.status(400).json({ error: 'Action parameter (branch/clean) is required.' });
    }

    db.get(`SELECT id, active_schedule_id FROM users WHERE username = ?`, [usernameHeader], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found.' });
        if (!user.active_schedule_id) return res.status(400).json({ error: 'No active schedule linked.' });

        const sharedScheduleId = user.active_schedule_id;

        if (action === 'clean') {
            // Just unlink from the schedule, create a new fresh default schedule for them
            db.run(
                `INSERT INTO schedules (name, creator_id) VALUES (?, ?)`,
                [`My 30-Day Python DSA Schedule`, user.id],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Failed to reset schedule.' });
                    const newScheduleId = this.lastID;

                    populate30DayDSA(newScheduleId, (err) => {
                        if (err) return res.status(500).json({ error: 'Error resetting schedule.' });
                        
                        db.run(
                            `UPDATE users SET active_schedule_id = ? WHERE id = ?`,
                            [newScheduleId, user.id],
                            () => {
                                res.json({ success: true, message: 'Unlinked. New blank schedule created.' });
                            }
                        );
                    });
                }
            );
        } else if (action === 'branch') {
            // Unlink but duplicate the schedule definition and copy user completions over!
            db.get(`SELECT * FROM schedules WHERE id = ?`, [sharedScheduleId], (err, oldSchedule) => {
                if (err || !oldSchedule) return res.status(404).json({ error: 'Linked schedule not found.' });

                // 1. Create a copy of schedule
                db.run(
                    `INSERT INTO schedules (name, creator_id, duration_days, is_shared, share_code) VALUES (?, ?, ?, 0, NULL)`,
                    [`${oldSchedule.name} (Copy)`, oldSchedule.creator_id, oldSchedule.duration_days],
                    function(err) {
                        if (err) return res.status(500).json({ error: 'Failed to create copy container.' });
                        const newScheduleId = this.lastID;

                        // 2. Fetch old schedule items
                        db.all(`SELECT * FROM schedule_items WHERE schedule_id = ?`, [sharedScheduleId], (err, items) => {
                            if (err || !items.length) return res.status(500).json({ error: 'Failed to retrieve blueprint items.' });

                            // 3. Populate new schedule items and save a mapping to copy completions
                            const itemsInserted = [];
                            let completedInserts = 0;

                            items.forEach(item => {
                                db.run(
                                    `INSERT INTO schedule_items (schedule_id, day_number, time_start, time_end, title, description, category) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    [newScheduleId, item.day_number, item.time_start, item.time_end, item.title, item.description, item.category],
                                    function(err) {
                                        if (err) return res.status(500).json({ error: 'Failed to branch timeline.' });
                                        
                                        const newItemId = this.lastID;
                                        itemsInserted.push({ oldId: item.id, newId: newItemId });
                                        completedInserts++;

                                        if (completedInserts === items.length) {
                                            // All items copied. Now duplicate completions!
                                            db.all(
                                                `SELECT * FROM completions WHERE user_id = ? AND schedule_item_id IN (${items.map(i=>i.id).join(',')})`,
                                                [user.id],
                                                (err, oldCompletions) => {
                                                    if (err || !oldCompletions.length) {
                                                        // No completions or error, just update active_schedule_id
                                                        db.run(
                                                            `UPDATE users SET active_schedule_id = ? WHERE id = ?`,
                                                            [newScheduleId, user.id],
                                                            () => res.json({ success: true, message: 'Unlinked. Schedule branched with empty logs.' })
                                                        );
                                                    } else {
                                                        // Insert new completions mapped to the new items
                                                        let savedCompletions = 0;
                                                        oldCompletions.forEach(oldComp => {
                                                            const mapping = itemsInserted.find(m => m.oldId === oldComp.schedule_item_id);
                                                            if (mapping) {
                                                                db.run(
                                                                    `INSERT OR IGNORE INTO completions (user_id, schedule_item_id, completed_at) VALUES (?, ?, ?)`,
                                                                    [user.id, mapping.newId, oldComp.completed_at],
                                                                    () => {
                                                                        savedCompletions++;
                                                                        if (savedCompletions === oldCompletions.length) {
                                                                            // Completed copying completions. Update active schedule
                                                                            db.run(
                                                                                `UPDATE users SET active_schedule_id = ? WHERE id = ?`,
                                                                                [newScheduleId, user.id],
                                                                                () => res.json({ success: true, message: 'Unlinked! Your progress has been completely copied to your private copy.' })
                                                                            );
                                                                        }
                                                                    }
                                                                );
                                                            } else {
                                                                savedCompletions++;
                                                            }
                                                        });
                                                    }
                                                }
                                            );
                                        }
                                    }
                                );
                            });
                        });
                    }
                );
            });
        }
    });
});


/* ==========================================================================
   DAILY LOGS ROUTES (Notes & Focus/Mood)
   ========================================================================== */

// Get Daily Log
app.get('/api/logs/:date', (req, res) => {
    const usernameHeader = req.headers['x-username'];
    const { date } = req.params; // "YYYY-MM-DD"

    if (!usernameHeader || !date) {
        return res.status(400).json({ error: 'Missing parameters.' });
    }

    db.get(`SELECT id FROM users WHERE username = ?`, [usernameHeader], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found.' });

        db.get(
            `SELECT mood, notes FROM daily_logs WHERE user_id = ? AND date = ?`,
            [user.id, date],
            (err, row) => {
                if (err) return res.status(500).json({ error: 'Error fetching daily reflection logs.' });
                res.json({ mood: row ? row.mood : '', notes: row ? row.notes : '' });
            }
        );
    });
});

// Save Daily Log
app.post('/api/logs', (req, res) => {
    const usernameHeader = req.headers['x-username'];
    const { date, mood, notes } = req.body;

    if (!usernameHeader || !date) {
        return res.status(400).json({ error: 'Missing date parameter.' });
    }

    db.get(`SELECT id FROM users WHERE username = ?`, [usernameHeader], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found.' });

        db.run(
            `INSERT INTO daily_logs (user_id, date, mood, notes) 
             VALUES (?, ?, ?, ?) 
             ON CONFLICT(user_id, date) DO UPDATE SET mood=excluded.mood, notes=excluded.notes`,
            [user.id, date, mood, notes],
            (err) => {
                if (err) return res.status(500).json({ error: 'Failed to update focus log.' });
                res.json({ success: true, message: 'Reflection notes saved successfully!' });
            }
        );
    });
});

// Serve frontend routing fallback
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`   Co-Op Scheduler Backend listening on Port ${PORT}`);
    console.log(`   Local Server URL: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
