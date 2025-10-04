class PromptGeneratorChat {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.messageHistory = [];
        this.isLoading = false;
        
        this.initializeElements();
        this.bindEvents();
        this.loadConfiguration();
        this.displaySessionId();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.sessionIdSpan = document.getElementById('sessionId');
        this.newSessionBtn = document.getElementById('newSessionBtn');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.quickBtns = document.querySelectorAll('.quick-btn');
        
        // Fixed webhook URL for public use
        this.webhookUrl = 'https://primary-production-6fee2c.up.railway.app/webhook/0b11303c-bec4-4d78-9165-a4b9fb4a95ad/chat';
    }

    bindEvents() {
        // Send button click
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Enter key to send (Shift+Enter for new line)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // New session button
        this.newSessionBtn.addEventListener('click', () => this.startNewSession());

        // Quick action buttons
        this.quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                this.messageInput.value = query;
                this.autoResizeTextarea();
                this.messageInput.focus();
            });
        });

        // No configuration needed for public use
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    displaySessionId() {
        this.sessionIdSpan.textContent = this.sessionId;
    }

    startNewSession() {
        this.sessionId = this.generateSessionId();
        this.messageHistory = [];
        this.displaySessionId();
        
        // Clear chat messages except welcome message
        const messages = this.messagesContainer.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        
        this.showNotification('New session started!', 'success');
    }

    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isLoading) return;

        // Add user message to chat
        this.addMessage('user', message);
        
        // Clear input and reset height
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        
        // Show typing indicator
        this.setLoading(true);
        
        try {
            const response = await this.callWebhook(message);
            this.addMessage('ai', response);
        } catch (error) {
            console.error('Error calling webhook:', error);
            this.addMessage('ai', `Sorry, I encountered an error: ${error.message}. Please try again in a moment.`);
        } finally {
            this.setLoading(false);
        }
    }

    async callWebhook(message) {
        const headers = {
            'Content-Type': 'application/json',
        };

        const payload = {
            chatInput: message,
            sessionId: this.sessionId
        };

        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
                mode: 'cors' // Explicitly set CORS mode
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // The n8n workflow returns the AI response in different possible formats
            if (data.output) {
                return data.output;
            } else if (data.text) {
                return data.text;
            } else if (data.response) {
                return data.response;
            } else if (typeof data === 'string') {
                return data;
            } else {
                return JSON.stringify(data, null, 2);
            }
        } catch (error) {
            // If CORS fails, try with a proxy or provide helpful error message
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Please make sure you\'re accessing this page from a web server (not file://) or try again. The service might be temporarily unavailable.');
            }
            throw error;
        }
    }

    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = type === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (type === 'ai') {
            // Format AI response with enhanced prompt formatting
            messageContent.innerHTML = this.formatPromptResponse(content);
        } else {
            messageContent.textContent = content;
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        // Store in history
        this.messageHistory.push({ type, content, timestamp: new Date().toISOString() });
    }

    formatPromptResponse(content) {
        // Enhanced formatting for prompt responses
        let formatted = content
            // Bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic text
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Numbered prompts (1., 2., etc.)
            .replace(/^(\d+)\.\s+(.+)$/gm, '<div class="prompt-item"><span class="prompt-number">$1.</span><span class="prompt-text">$2</span></div>')
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Line breaks
            .replace(/\n/g, '<br>');

        // If it looks like a list of prompts, wrap in a special container
        if (formatted.includes('prompt-item')) {
            formatted = `<div class="prompts-container">${formatted}</div>`;
        }

        return formatted;
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.sendBtn.disabled = loading;
        this.messageInput.disabled = loading;
        
        if (loading) {
            this.typingIndicator.classList.add('show');
        } else {
            this.typingIndicator.classList.remove('show');
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '1000',
            animation: 'slideInRight 0.3s ease',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Remove notification after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // No configuration needed for public use
    loadConfiguration() {
        // Configuration is hardcoded for public use
    }

    // Utility method to export chat history
    exportChatHistory() {
        const exportData = {
            sessionId: this.sessionId,
            messages: this.messageHistory,
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompt-generator-history-${this.sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Chat history exported successfully!', 'success');
    }
}

// Add CSS animations for notifications and prompts
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .prompts-container {
        background: rgba(255, 107, 107, 0.05);
        border: 1px solid rgba(255, 107, 107, 0.2);
        border-radius: 12px;
        padding: 1rem;
        margin: 0.5rem 0;
    }
    
    .prompt-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 8px;
        border-left: 3px solid #ff6b6b;
    }
    
    .prompt-item:last-child {
        margin-bottom: 0;
    }
    
    .prompt-number {
        background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 600;
        flex-shrink: 0;
    }
    
    .prompt-text {
        flex: 1;
        font-size: 0.9rem;
        line-height: 1.4;
        color: #333;
    }
`;
document.head.appendChild(style);

// Initialize the chat application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.promptGeneratorChat = new PromptGeneratorChat();
    
    // Add export functionality to the window for debugging
    window.exportChat = () => window.promptGeneratorChat.exportChatHistory();
    
    console.log('Prompt Generator Chat initialized successfully!');
    console.log('Use window.exportChat() to export chat history');
});

// Add keyboard shortcut for quick actions
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to send message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (window.promptGeneratorChat && !window.promptGeneratorChat.isLoading) {
            window.promptGeneratorChat.sendMessage();
        }
    }
    
    // Ctrl/Cmd + N for new session
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (window.promptGeneratorChat) {
            window.promptGeneratorChat.startNewSession();
        }
    }
});
