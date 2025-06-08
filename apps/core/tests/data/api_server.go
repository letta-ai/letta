package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// User represents a user in the system
type User struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserService handles user-related operations
type UserService struct {
	users  map[int]*User
	nextID int
	mutex  sync.RWMutex
}

// NewUserService creates a new instance of UserService
func NewUserService() *UserService {
	return &UserService{
		users:  make(map[int]*User),
		nextID: 1,
	}
}

// CreateUser adds a new user to the service
func (us *UserService) CreateUser(name, email string) (*User, error) {
	us.mutex.Lock()
	defer us.mutex.Unlock()

	if name == "" || email == "" {
		return nil, fmt.Errorf("name and email are required")
	}

	// Check for duplicate email
	for _, user := range us.users {
		if user.Email == email {
			return nil, fmt.Errorf("user with email %s already exists", email)
		}
	}

	user := &User{
		ID:        us.nextID,
		Name:      name,
		Email:     email,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	us.users[us.nextID] = user
	us.nextID++

	return user, nil
}

// GetUser retrieves a user by ID
func (us *UserService) GetUser(id int) (*User, error) {
	us.mutex.RLock()
	defer us.mutex.RUnlock()

	user, exists := us.users[id]
	if !exists {
		return nil, fmt.Errorf("user with ID %d not found", id)
	}

	return user, nil
}

// GetAllUsers returns all users
func (us *UserService) GetAllUsers() []*User {
	us.mutex.RLock()
	defer us.mutex.RUnlock()

	users := make([]*User, 0, len(us.users))
	for _, user := range us.users {
		users = append(users, user)
	}

	return users
}

// UpdateUser modifies an existing user
func (us *UserService) UpdateUser(id int, name, email string) (*User, error) {
	us.mutex.Lock()
	defer us.mutex.Unlock()

	user, exists := us.users[id]
	if !exists {
		return nil, fmt.Errorf("user with ID %d not found", id)
	}

	// Check for duplicate email (excluding current user)
	if email != user.Email {
		for _, u := range us.users {
			if u.Email == email && u.ID != id {
				return nil, fmt.Errorf("user with email %s already exists", email)
			}
		}
	}

	if name != "" {
		user.Name = name
	}
	if email != "" {
		user.Email = email
	}
	user.UpdatedAt = time.Now()

	return user, nil
}

// DeleteUser removes a user from the service
func (us *UserService) DeleteUser(id int) error {
	us.mutex.Lock()
	defer us.mutex.Unlock()

	if _, exists := us.users[id]; !exists {
		return fmt.Errorf("user with ID %d not found", id)
	}

	delete(us.users, id)
	return nil
}

// APIServer represents the HTTP server
type APIServer struct {
	userService *UserService
	router      *mux.Router
}

// NewAPIServer creates a new API server instance
func NewAPIServer(userService *UserService) *APIServer {
	server := &APIServer{
		userService: userService,
		router:      mux.NewRouter(),
	}
	server.setupRoutes()
	return server
}

// setupRoutes configures the API routes
func (s *APIServer) setupRoutes() {
	api := s.router.PathPrefix("/api/v1").Subrouter()
	
	// User routes
	api.HandleFunc("/users", s.handleGetUsers).Methods("GET")
	api.HandleFunc("/users", s.handleCreateUser).Methods("POST")
	api.HandleFunc("/users/{id:[0-9]+}", s.handleGetUser).Methods("GET")
	api.HandleFunc("/users/{id:[0-9]+}", s.handleUpdateUser).Methods("PUT")
	api.HandleFunc("/users/{id:[0-9]+}", s.handleDeleteUser).Methods("DELETE")
	
	// Health check
	api.HandleFunc("/health", s.handleHealthCheck).Methods("GET")
	
	// Add CORS middleware
	s.router.Use(s.corsMiddleware)
	s.router.Use(s.loggingMiddleware)
}

// HTTP Handlers

func (s *APIServer) handleGetUsers(w http.ResponseWriter, r *http.Request) {
	users := s.userService.GetAllUsers()
	s.writeJSON(w, http.StatusOK, map[string]interface{}{
		"users": users,
		"count": len(users),
	})
}

func (s *APIServer) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	user, err := s.userService.CreateUser(req.Name, req.Email)
	if err != nil {
		s.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	s.writeJSON(w, http.StatusCreated, map[string]*User{"user": user})
}

func (s *APIServer) handleGetUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		s.writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	user, err := s.userService.GetUser(id)
	if err != nil {
		s.writeError(w, http.StatusNotFound, err.Error())
		return
	}

	s.writeJSON(w, http.StatusOK, map[string]*User{"user": user})
}

func (s *APIServer) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		s.writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	user, err := s.userService.UpdateUser(id, req.Name, req.Email)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		s.writeError(w, status, err.Error())
		return
	}

	s.writeJSON(w, http.StatusOK, map[string]*User{"user": user})
}

func (s *APIServer) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		s.writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	if err := s.userService.DeleteUser(id); err != nil {
		s.writeError(w, http.StatusNotFound, err.Error())
		return
	}

	s.writeJSON(w, http.StatusOK, map[string]string{"message": "User deleted successfully"})
}

func (s *APIServer) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now(),
		"service":   "user-api",
	})
}

// Middleware

func (s *APIServer) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *APIServer) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		// Wrap ResponseWriter to capture status code
		ww := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		
		next.ServeHTTP(ww, r)
		
		log.Printf("%s %s %d %v", r.Method, r.URL.Path, ww.statusCode, time.Since(start))
	})
}

// Helper methods

func (s *APIServer) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (s *APIServer) writeError(w http.ResponseWriter, status int, message string) {
	s.writeJSON(w, status, map[string]string{"error": message})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Start starts the HTTP server
func (s *APIServer) Start(ctx context.Context, addr string) error {
	server := &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		<-ctx.Done()
		log.Println("Shutting down server...")
		
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("Server shutdown error: %v", err)
		}
	}()

	log.Printf("Server starting on %s", addr)
	return server.ListenAndServe()
}

func main() {
	userService := NewUserService()
	
	// Add some sample data
	userService.CreateUser("John Doe", "john@example.com")
	userService.CreateUser("Jane Smith", "jane@example.com")
	
	server := NewAPIServer(userService)
	
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	
	if err := server.Start(ctx, ":8080"); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed to start: %v", err)
	}
}