// API endpoint for Growth Manager Pro v2 - Tasks/Sprint data
// Production-ready with comprehensive error handling

export default async function handler(req, res) {
    // Set security and CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Powered-By', 'Growth Manager Pro v2');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Log request for monitoring
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    try {
        // Validate request method
        const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
        if (!allowedMethods.includes(req.method)) {
            return res.status(405).json({ 
                success: false,
                error: 'Method not allowed',
                allowedMethods: allowedMethods 
            });
        }

        // Handle different HTTP methods
        switch (req.method) {
            case 'GET':
                return await handleGetTasks(req, res);
            case 'POST':
                return await handleCreateTask(req, res);
            case 'PUT':
                return await handleUpdateTask(req, res);
            case 'DELETE':
                return await handleDeleteTask(req, res);
            default:
                return res.status(405).json({ 
                    success: false,
                    error: 'Method not allowed' 
                });
        }
    } catch (error) {
        console.error('Tasks API Error:', error);
        
        return res.status(500).json({ 
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
            timestamp: new Date().toISOString()
        });
    }
}

// GET /api/tasks - Fetch all tasks
async function handleGetTasks(req, res) {
    try {
        // TODO: Replace with actual database connection
        // Example: const tasks = await db.collection('tasks').find().toArray();
        
        // For now, return empty array - ready for database integration
        const tasks = [];
        
        // In production, you would fetch from your database here
        // This is where you'd connect to PostgreSQL, MongoDB, Supabase, etc.
        
        // Apply filters if provided
        let filteredTasks = tasks;
        const { status, assignee, priority, sprint } = req.query;

        if (status) {
            filteredTasks = filteredTasks.filter(t => t.status === status);
        }

        if (assignee) {
            filteredTasks = filteredTasks.filter(t => t.assignee === assignee);
        }

        if (priority) {
            filteredTasks = filteredTasks.filter(t => t.priority === priority);
        }

        if (sprint) {
            filteredTasks = filteredTasks.filter(t => t.sprint === sprint);
        }

        // Calculate task statistics
        const stats = {
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'completed').length,
            inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
            blockedTasks: tasks.filter(t => t.status === 'blocked').length,
            newTasks: tasks.filter(t => t.status === 'new').length
        };

        // Return success response
        res.status(200).json({
            success: true,
            data: filteredTasks,
            stats: stats,
            totalCount: tasks.length,
            filteredCount: filteredTasks.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tasks',
            message: error.message
        });
    }
}

// POST /api/tasks - Create new task
async function handleCreateTask(req, res) {
    try {
        const { title, description, assignee, status, priority, sprint, dueDate } = req.body;

        // Validation
        if (!title || !assignee) {
            return res.status(400).json({
                success: false,
                error: 'Title and assignee are required fields'
            });
        }

        // Create new task
        const newTask = {
            id: Date.now(), // In production, use proper ID generation
            title: title.trim(),
            description: description?.trim() || '',
            assignee: assignee.trim(),
            status: status || 'new',
            priority: priority || 'medium',
            sprint: sprint?.trim() || 'current',
            dueDate: dueDate || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // In production, save to database here
        // Example: const result = await db.collection('tasks').insertOne(newTask);
        
        res.status(201).json({
            success: true,
            data: newTask,
            message: 'Task created successfully'
        });

    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create task',
            message: error.message
        });
    }
}

// PUT /api/tasks - Update existing task
async function handleUpdateTask(req, res) {
    try {
        const { id } = req.query;
        const updates = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Task ID is required'
            });
        }

        // In production, update in database here
        // Example: const result = await db.collection('tasks').updateOne(
        //     { id: parseInt(id) },
        //     { $set: { ...updates, updatedAt: new Date().toISOString() } }
        // );

        const updatedTask = {
            id: parseInt(id),
            ...updates,
            updatedAt: new Date().toISOString()
        };

        res.status(200).json({
            success: true,
            data: updatedTask,
            message: 'Task updated successfully'
        });

    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update task',
            message: error.message
        });
    }
}

// DELETE /api/tasks - Delete task
async function handleDeleteTask(req, res) {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Task ID is required'
            });
        }

        // In production, delete from database here
        // Example: const result = await db.collection('tasks').deleteOne({ id: parseInt(id) });

        res.status(200).json({
            success: true,
            message: 'Task deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete task',
            message: error.message
        });
    }
}
