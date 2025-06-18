#include <iostream>
#include <vector>
#include <memory>
#include <algorithm>
#include <stdexcept>

/**
 * Binary Search Tree implementation with smart pointers
 * Template class supporting any comparable type
 */
template<typename T>
class BinarySearchTree {
private:
    struct Node {
        T data;
        std::unique_ptr<Node> left;
        std::unique_ptr<Node> right;
        
        Node(const T& value) : data(value), left(nullptr), right(nullptr) {}
    };
    
    std::unique_ptr<Node> root;
    size_t size_;

    void insertHelper(std::unique_ptr<Node>& node, const T& value) {
        if (!node) {
            node = std::make_unique<Node>(value);
            ++size_;
            return;
        }
        
        if (value < node->data) {
            insertHelper(node->left, value);
        } else if (value > node->data) {
            insertHelper(node->right, value);
        }
        // Ignore duplicates
    }
    
    bool searchHelper(const std::unique_ptr<Node>& node, const T& value) const {
        if (!node) return false;
        
        if (value == node->data) return true;
        else if (value < node->data) return searchHelper(node->left, value);
        else return searchHelper(node->right, value);
    }
    
    void inorderHelper(const std::unique_ptr<Node>& node, std::vector<T>& result) const {
        if (!node) return;
        
        inorderHelper(node->left, result);
        result.push_back(node->data);
        inorderHelper(node->right, result);
    }
    
    std::unique_ptr<Node> removeHelper(std::unique_ptr<Node> node, const T& value) {
        if (!node) return nullptr;
        
        if (value < node->data) {
            node->left = removeHelper(std::move(node->left), value);
        } else if (value > node->data) {
            node->right = removeHelper(std::move(node->right), value);
        } else {
            // Node to delete found
            --size_;
            
            if (!node->left) return std::move(node->right);
            if (!node->right) return std::move(node->left);
            
            // Node has two children
            Node* successor = findMin(node->right.get());
            node->data = successor->data;
            node->right = removeHelper(std::move(node->right), successor->data);
            ++size_; // Compensate for decrement in recursive call
        }
        
        return node;
    }
    
    Node* findMin(Node* node) const {
        while (node->left) {
            node = node->left.get();
        }
        return node;
    }

public:
    BinarySearchTree() : root(nullptr), size_(0) {}
    
    void insert(const T& value) {
        insertHelper(root, value);
    }
    
    bool search(const T& value) const {
        return searchHelper(root, value);
    }
    
    void remove(const T& value) {
        root = removeHelper(std::move(root), value);
    }
    
    std::vector<T> inorderTraversal() const {
        std::vector<T> result;
        inorderHelper(root, result);
        return result;
    }
    
    size_t size() const { return size_; }
    bool empty() const { return size_ == 0; }
    
    void clear() {
        root.reset();
        size_ = 0;
    }
};

/**
 * Dynamic Array implementation with automatic resizing
 */
template<typename T>
class DynamicArray {
private:
    std::unique_ptr<T[]> data;
    size_t capacity_;
    size_t size_;
    
    void resize() {
        size_t newCapacity = capacity_ == 0 ? 1 : capacity_ * 2;
        auto newData = std::make_unique<T[]>(newCapacity);
        
        for (size_t i = 0; i < size_; ++i) {
            newData[i] = std::move(data[i]);
        }
        
        data = std::move(newData);
        capacity_ = newCapacity;
    }

public:
    DynamicArray() : data(nullptr), capacity_(0), size_(0) {}
    
    explicit DynamicArray(size_t initialCapacity) 
        : data(std::make_unique<T[]>(initialCapacity)), 
          capacity_(initialCapacity), 
          size_(0) {}
    
    void pushBack(const T& value) {
        if (size_ >= capacity_) {
            resize();
        }
        data[size_++] = value;
    }
    
    void pushBack(T&& value) {
        if (size_ >= capacity_) {
            resize();
        }
        data[size_++] = std::move(value);
    }
    
    T& operator[](size_t index) {
        if (index >= size_) {
            throw std::out_of_range("Index out of bounds");
        }
        return data[index];
    }
    
    const T& operator[](size_t index) const {
        if (index >= size_) {
            throw std::out_of_range("Index out of bounds");
        }
        return data[index];
    }
    
    void popBack() {
        if (size_ > 0) {
            --size_;
        }
    }
    
    size_t size() const { return size_; }
    size_t capacity() const { return capacity_; }
    bool empty() const { return size_ == 0; }
    
    void clear() { size_ = 0; }
    
    // Iterator support
    T* begin() { return data.get(); }
    T* end() { return data.get() + size_; }
    const T* begin() const { return data.get(); }
    const T* end() const { return data.get() + size_; }
};

/**
 * Stack implementation using dynamic array
 */
template<typename T>
class Stack {
private:
    DynamicArray<T> container;

public:
    void push(const T& value) {
        container.pushBack(value);
    }
    
    void push(T&& value) {
        container.pushBack(std::move(value));
    }
    
    void pop() {
        if (empty()) {
            throw std::runtime_error("Stack underflow");
        }
        container.popBack();
    }
    
    T& top() {
        if (empty()) {
            throw std::runtime_error("Stack is empty");
        }
        return container[container.size() - 1];
    }
    
    const T& top() const {
        if (empty()) {
            throw std::runtime_error("Stack is empty");
        }
        return container[container.size() - 1];
    }
    
    bool empty() const { return container.empty(); }
    size_t size() const { return container.size(); }
};

// Demonstration and testing
int main() {
    std::cout << "=== Binary Search Tree Demo ===" << std::endl;
    
    BinarySearchTree<int> bst;
    std::vector<int> values = {50, 30, 70, 20, 40, 60, 80, 10, 25, 35};
    
    for (int val : values) {
        bst.insert(val);
    }
    
    std::cout << "Tree size: " << bst.size() << std::endl;
    std::cout << "Inorder traversal: ";
    auto inorder = bst.inorderTraversal();
    for (size_t i = 0; i < inorder.size(); ++i) {
        std::cout << inorder[i];
        if (i < inorder.size() - 1) std::cout << ", ";
    }
    std::cout << std::endl;
    
    std::cout << "\n=== Dynamic Array Demo ===" << std::endl;
    
    DynamicArray<std::string> arr;
    arr.pushBack("Hello");
    arr.pushBack("World");
    arr.pushBack("C++");
    arr.pushBack("Templates");
    
    std::cout << "Array contents: ";
    for (size_t i = 0; i < arr.size(); ++i) {
        std::cout << arr[i];
        if (i < arr.size() - 1) std::cout << ", ";
    }
    std::cout << std::endl;
    
    std::cout << "\n=== Stack Demo ===" << std::endl;
    
    Stack<int> stack;
    for (int i = 1; i <= 5; ++i) {
        stack.push(i * 10);
    }
    
    std::cout << "Stack contents (top to bottom): ";
    while (!stack.empty()) {
        std::cout << stack.top() << " ";
        stack.pop();
    }
    std::cout << std::endl;
    
    return 0;
}