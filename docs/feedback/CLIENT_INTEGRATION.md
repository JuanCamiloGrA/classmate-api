# Feedback Integration Guide for Clients

## Overview

This guide shows how to integrate the feedback endpoint into your client application.

---

## Quick Start

### 1. Create a feedback form

```html
<form id="feedbackForm">
  <textarea 
    id="message" 
    name="message" 
    placeholder="Tell us what you think..."
    maxlength="5000"
    required
  ></textarea>
  
  <input 
    type="email" 
    id="userEmail" 
    name="userEmail" 
    placeholder="Your email (optional)"
  />
  
  <input 
    type="hidden" 
    id="pageContext" 
    name="pageContext"
  />
  
  <button type="submit">Send Feedback</button>
</form>
```

### 2. Submit feedback via JavaScript

```javascript
document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Capture current page context
  const pageContext = window.location.pathname;
  
  const feedbackData = {
    message: document.getElementById('message').value,
    userEmail: document.getElementById('userEmail').value || undefined,
    userId: getCurrentUserId(), // Optional: your user ID
    pageContext: pageContext
  };
  
  try {
    const response = await fetch('/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(feedbackData)
    });
    
    if (response.ok) {
      const data = await response.json();
      alert('Thank you for your feedback!');
      document.getElementById('feedbackForm').reset();
    } else if (response.status === 429) {
      alert('Too many requests. Please try again later.');
    } else {
      alert('Error submitting feedback. Please try again.');
    }
  } catch (error) {
    console.error('Feedback submission error:', error);
    alert('Error submitting feedback.');
  }
});
```

---

## React Component Example

```jsx
import { useState } from 'react';

export function FeedbackForm() {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          userEmail: email || undefined,
          pageContext: window.location.pathname
        })
      });

      if (response.ok) {
        setSuccess(true);
        setMessage('');
        setEmail('');
      } else if (response.status === 429) {
        setError('Rate limited. Try again later.');
      } else {
        setError('Failed to submit feedback.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {success && <p className="success">Thank you for your feedback!</p>}
      {error && <p className="error">{error}</p>}
      
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Share your feedback..."
        maxLength="5000"
        required
      />
      
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email (optional)"
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Feedback'}
      </button>
    </form>
  );
}
```

---

## Vue Component Example

```vue
<template>
  <form @submit.prevent="submitFeedback">
    <div v-if="success" class="success">
      Thank you for your feedback!
    </div>
    
    <div v-if="error" class="error">
      {{ error }}
    </div>
    
    <textarea
      v-model="message"
      placeholder="Share your feedback..."
      maxlength="5000"
      required
    />
    
    <input
      v-model="email"
      type="email"
      placeholder="Your email (optional)"
    />
    
    <button type="submit" :disabled="loading">
      {{ loading ? 'Sending...' : 'Send Feedback' }}
    </button>
  </form>
</template>

<script>
export default {
  data() {
    return {
      message: '',
      email: '',
      loading: false,
      error: null,
      success: false
    };
  },
  methods: {
    async submitFeedback() {
      this.loading = true;
      this.error = null;
      this.success = false;

      try {
        const response = await fetch('/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: this.message,
            userEmail: this.email || undefined,
            pageContext: window.location.pathname
          })
        });

        if (response.ok) {
          this.success = true;
          this.message = '';
          this.email = '';
        } else if (response.status === 429) {
          this.error = 'Rate limited. Try again later.';
        } else {
          this.error = 'Failed to submit feedback.';
        }
      } catch (err) {
        this.error = 'Network error. Please try again.';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
```

---

## Advanced Integration

### Auto-capture page context

```javascript
function getFeedbackContext() {
  return {
    page: window.location.pathname,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };
}

// Use in feedback submission
const context = getFeedbackContext();
await submitFeedback({
  ...feedbackData,
  pageContext: context.page
});
```

### Handle rate limiting

```javascript
const RATE_LIMIT_STORAGE_KEY = 'feedback_rate_limit';

function isRateLimited() {
  const lastAttempt = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
  if (!lastAttempt) return false;
  
  const elapsed = Date.now() - parseInt(lastAttempt, 10);
  return elapsed < 30000; // 30 second cooldown
}

function recordFeedbackAttempt() {
  localStorage.setItem(RATE_LIMIT_STORAGE_KEY, Date.now().toString());
}

// In submit handler
if (isRateLimited()) {
  alert('Please wait before submitting more feedback.');
  return;
}

recordFeedbackAttempt();
```

### Show feedback button in navigation

```javascript
function addFeedbackButton() {
  const nav = document.querySelector('nav');
  const button = document.createElement('button');
  button.textContent = 'Send Feedback';
  button.className = 'feedback-button';
  button.addEventListener('click', openFeedbackModal);
  nav.appendChild(button);
}

function openFeedbackModal() {
  // Show your feedback form/modal
}
```

---

## Error Handling

```javascript
async function submitFeedback(data) {
  try {
    const response = await fetch('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.status === 201) {
      return { success: true, data: await response.json() };
    }
    
    if (response.status === 400) {
      const error = await response.json();
      return { success: false, error: 'Invalid input: ' + error.error };
    }
    
    if (response.status === 429) {
      return { success: false, error: 'Too many requests. Please wait.' };
    }
    
    if (response.status === 500) {
      return { success: false, error: 'Server error. Try again later.' };
    }
    
    return { success: false, error: 'Unknown error' };
  } catch (error) {
    return { success: false, error: 'Network error: ' + error.message };
  }
}
```

---

## Best Practices

1. **Optional Email**: Don't require email unless you need to follow up
2. **Page Context**: Always capture the current page URL for context
3. **User ID**: Include if the user is logged in
4. **Error Messages**: Show user-friendly error messages
5. **Validation**: Validate on client side before submitting
6. **Feedback Button**: Make it easily accessible but not intrusive
7. **Success Message**: Confirm feedback was received
8. **Rate Limiting**: Inform users about rate limits if hit
9. **Analytics**: Track feedback submission success rates

---

## Testing

### Test with cURL

```bash
# Valid feedback
curl -X POST http://localhost:8787/feedback \
  -H "Content-Type: application/json" \
  -d '{"message": "Test feedback"}'

# With email
curl -X POST http://localhost:8787/feedback \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "userEmail": "test@example.com"}'

# Invalid email
curl -X POST http://localhost:8787/feedback \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "userEmail": "invalid-email"}'
```

### Test rate limiting

```bash
# Send 11 requests rapidly to trigger rate limit
for i in {1..11}; do
  curl -X POST http://localhost:8787/feedback \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Request $i\"}"
  echo ""
done
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 400 Bad Request | Check that `message` is provided and valid email format |
| 429 Too Many Requests | Wait for rate limit window to reset (5 minutes) |
| 500 Server Error | Server issue - try again later |
| CORS Error | Check that API endpoint is properly configured |
| Network Error | Check internet connection and endpoint URL |
