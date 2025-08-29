// Global state
let tasks = [];

// DOM elements
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const errorMessage = document.getElementById('errorMessage');
const taskCount = document.getElementById('taskCount');
const completedCount = document.getElementById('completedCount');

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', function () {
    console.log('Secure Task Manager loaded');
    loadTasks();

    // Add enter key support for task input
    taskInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    // Clear error message when user starts typing
    taskInput.addEventListener('input', function () {
        hideError();
    });
});

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    setTimeout(hideError, 5000); // Auto-hide after 5 seconds
}

// Hide error message
function hideError() {
    errorMessage.classList.remove('show');
}

// Update task statistics
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;

    taskCount.textContent = `${total} task${total !== 1 ? 's' : ''}`;
    completedCount.textContent = `${completed} completed`;
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Load all tasks from server
async function loadTasks() {
    try {
        taskList.innerHTML = '<div class="loading">Loading tasks...</div>';

        const response = await fetch('/api/tasks');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        tasks = await response.json();
        renderTasks();
        updateStats();

    } catch (error) {
        console.error('Error loading tasks:', error);
        showError('Failed to load tasks. Please refresh the page.');
        taskList.innerHTML = '<div class="error">Failed to load tasks</div>';
    }
}

// Render all tasks
function renderTasks() {
    if (tasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state">
                <h3>No tasks yet!</h3>
                <p>Add your first task above to get started.</p>
            </div>
        `;
        return;
    }

    taskList.innerHTML = tasks.map(task => `
        <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                 onclick="toggleTask(${task.id})"></div>
            <div class="task-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</div>
            <div class="task-date">${formatDate(task.created_at)}</div>
            <div class="task-actions">
                <button class="btn-small btn-delete" onclick="deleteTask(${task.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Add new task
async function addTask() {
    const title = taskInput.value.trim();

    // Client-side validation
    if (!title) {
        showError('Please enter a task title');
        taskInput.focus();
        return;
    }

    if (title.length > 200) {
        showError('Task title must be 200 characters or less');
        taskInput.focus();
        return;
    }

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add task');
        }

        const newTask = await response.json();

        // Add to local array and re-render
        tasks.unshift(newTask); // Add to beginning of array
        renderTasks();
        updateStats();

        // Clear input and hide any errors
        taskInput.value = '';
        hideError();

        console.log('✅ Task added successfully:', newTask.title);

    } catch (error) {
        console.error('Error adding task:', error);
        showError(error.message || 'Failed to add task. Please try again.');
    }
}

// Toggle task completion
async function toggleTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/toggle`, {
            method: 'PUT',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update task');
        }

        // Update local task
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            renderTasks();
            updateStats();
        }

        console.log('✅ Task toggled successfully:', taskId);

    } catch (error) {
        console.error('Error toggling task:', error);
        showError(error.message || 'Failed to update task. Please try again.');
    }
}

// Delete task
async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete task');
        }

        // Remove from local array and re-render
        tasks = tasks.filter(task => task.id !== taskId);
        renderTasks();
        updateStats();

        console.log('✅ Task deleted successfully:', taskId);

    } catch (error) {
        console.error('Error deleting task:', error);
        showError(error.message || 'Failed to delete task. Please try again.');
    }
}

// Health check function (for monitoring)
async function healthCheck() {
    try {
        const response = await fetch('/health');
        const health = await response.json();
        console.log('Health check:', health.status);
        return health.status === 'healthy';
    } catch (error) {
        console.error('Health check failed:', error);
        return false;
    }
}

// Run health check every 30 seconds
setInterval(healthCheck, 30000);
