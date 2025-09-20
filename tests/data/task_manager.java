package com.example.taskmanager;

import java.util.*;
import java.time.LocalDateTime;

/**
 * TaskManager class for managing tasks and their lifecycle
 * 
 * @author Development Team
 * @version 1.0
 */
public class TaskManager {
    private Map<String, Task> tasks;
    private List<TaskObserver> observers;
    private static final int MAX_TASKS = 1000;

    public TaskManager() {
        this.tasks = new HashMap<>();
        this.observers = new ArrayList<>();
    }

    /**
     * Adds a new task to the manager
     * 
     * @param id Unique task identifier
     * @param title Task title
     * @param description Task description
     * @param priority Task priority level
     * @return true if task was added successfully
     * @throws IllegalArgumentException if task ID already exists
     * @throws IllegalStateException if maximum tasks exceeded
     */
    public boolean addTask(String id, String title, String description, Priority priority) {
        if (tasks.containsKey(id)) {
            throw new IllegalArgumentException("Task with ID " + id + " already exists");
        }
        
        if (tasks.size() >= MAX_TASKS) {
            throw new IllegalStateException("Maximum number of tasks reached");
        }

        Task newTask = new Task(id, title, description, priority);
        tasks.put(id, newTask);
        notifyObservers(TaskEvent.TASK_ADDED, newTask);
        return true;
    }

    /**
     * Updates an existing task status
     */
    public void updateTaskStatus(String id, TaskStatus newStatus) {
        Task task = tasks.get(id);
        if (task == null) {
            throw new NoSuchElementException("Task not found: " + id);
        }

        TaskStatus oldStatus = task.getStatus();
        task.setStatus(newStatus);
        task.setLastModified(LocalDateTime.now());
        
        notifyObservers(TaskEvent.TASK_UPDATED, task);
        
        if (newStatus == TaskStatus.COMPLETED) {
            handleTaskCompletion(task);
        }
    }

    /**
     * Retrieves tasks by status
     */
    public List<Task> getTasksByStatus(TaskStatus status) {
        return tasks.values()
                   .stream()
                   .filter(task -> task.getStatus() == status)
                   .sorted(Comparator.comparing(Task::getPriority))
                   .toList();
    }

    /**
     * Handles task completion logic
     */
    private void handleTaskCompletion(Task task) {
        task.setCompletedAt(LocalDateTime.now());
        System.out.println("Task completed: " + task.getTitle());
        
        // Check for dependent tasks
        tasks.values().stream()
             .filter(t -> t.getDependencies().contains(task.getId()))
             .forEach(this::checkDependenciesResolved);
    }

    private void checkDependenciesResolved(Task task) {
        boolean allResolved = task.getDependencies()
                                 .stream()
                                 .allMatch(depId -> {
                                     Task dep = tasks.get(depId);
                                     return dep != null && dep.getStatus() == TaskStatus.COMPLETED;
                                 });
        
        if (allResolved && task.getStatus() == TaskStatus.BLOCKED) {
            updateTaskStatus(task.getId(), TaskStatus.TODO);
        }
    }

    public void addObserver(TaskObserver observer) {
        observers.add(observer);
    }

    private void notifyObservers(TaskEvent event, Task task) {
        observers.forEach(observer -> observer.onTaskEvent(event, task));
    }

    // Inner classes and enums
    public enum Priority {
        LOW(1), MEDIUM(2), HIGH(3), CRITICAL(4);
        
        private final int value;
        Priority(int value) { this.value = value; }
        public int getValue() { return value; }
    }

    public enum TaskStatus {
        TODO, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED
    }

    public enum TaskEvent {
        TASK_ADDED, TASK_UPDATED, TASK_DELETED
    }

    public static class Task {
        private String id;
        private String title;
        private String description;
        private Priority priority;
        private TaskStatus status;
        private LocalDateTime createdAt;
        private LocalDateTime lastModified;
        private LocalDateTime completedAt;
        private Set<String> dependencies;

        public Task(String id, String title, String description, Priority priority) {
            this.id = id;
            this.title = title;
            this.description = description;
            this.priority = priority;
            this.status = TaskStatus.TODO;
            this.createdAt = LocalDateTime.now();
            this.lastModified = LocalDateTime.now();
            this.dependencies = new HashSet<>();
        }

        // Getters and setters
        public String getId() { return id; }
        public String getTitle() { return title; }
        public String getDescription() { return description; }
        public Priority getPriority() { return priority; }
        public TaskStatus getStatus() { return status; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public LocalDateTime getLastModified() { return lastModified; }
        public LocalDateTime getCompletedAt() { return completedAt; }
        public Set<String> getDependencies() { return dependencies; }

        public void setStatus(TaskStatus status) { this.status = status; }
        public void setLastModified(LocalDateTime lastModified) { this.lastModified = lastModified; }
        public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

        @Override
        public String toString() {
            return String.format("Task{id='%s', title='%s', status=%s, priority=%s}", 
                               id, title, status, priority);
        }
    }

    public interface TaskObserver {
        void onTaskEvent(TaskEvent event, Task task);
    }
}