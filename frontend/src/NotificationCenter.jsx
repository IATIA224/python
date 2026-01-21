import { useEffect, useState } from 'react'
import './NotificationCenter.css'

const API_BASE_URL = 'http://localhost:8000'

export default function NotificationCenter({ onNewResponse }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [pollInterval, setPollInterval] = useState(5000) // Poll every 5 seconds

  // Initialize notification polling
  useEffect(() => {
    loadNotifications()
    
    // Set up polling for new responses
    const interval = setInterval(checkForNewResponses, pollInterval)
    
    return () => clearInterval(interval)
  }, [])

  // Load notifications from localStorage
  const loadNotifications = () => {
    try {
      const stored = localStorage.getItem('ticketNotifications')
      if (stored) {
        const notifs = JSON.parse(stored)
        setNotifications(notifs)
        const unread = notifs.filter(n => !n.read).length
        setUnreadCount(unread)
      }
    } catch (err) {
      console.error('Error loading notifications:', err)
    }
  }

  // Check for new admin responses on submitted tickets
  const checkForNewResponses = async () => {
    try {
      const myTickets = localStorage.getItem('mySubmittedTickets')
      if (!myTickets) return

      const tickets = JSON.parse(myTickets)
      const storedNotifications = localStorage.getItem('ticketNotifications')
      const existingNotifications = storedNotifications ? JSON.parse(storedNotifications) : []
      
      for (const ticket of tickets) {
        try {
          const response = await fetch(`${API_BASE_URL}/tickets/${ticket.id}`)
          if (response.ok) {
            const updatedTicket = await response.json()
            
            // Check if there are new admin responses that are unread
            if (updatedTicket.admin_responses && updatedTicket.admin_responses.length > 0) {
              const unreadResponses = updatedTicket.admin_responses.filter(r => !r.is_read)
              
              unreadResponses.forEach(response => {
                // Check if this response is already in our notifications
                const alreadyExists = existingNotifications.find(
                  n => n.response_id === response.response_id
                )
                
                if (!alreadyExists) {
                  addNotification({
                    response_id: response.response_id,
                    ticket_id: ticket.id,
                    ticket_title: ticket.title,
                    admin_name: response.admin_name,
                    response_text: response.response_text,
                    created_at: response.created_at,
                    read: false
                  })
                  
                  // Call the callback to notify parent
                  if (onNewResponse) {
                    onNewResponse(response.response_id)
                  }
                }
              })
            }
          }
        } catch (err) {
          console.error(`Error checking ticket ${ticket.id}:`, err)
        }
      }
    } catch (err) {
      console.error('Error checking for new responses:', err)
    }
  }

  // Add a new notification
  const addNotification = (notification) => {
    try {
      const updated = [notification, ...notifications]
      setNotifications(updated)
      setUnreadCount(prev => prev + 1)
      
      // Save to localStorage
      localStorage.setItem('ticketNotifications', JSON.stringify(updated))
      
      // Show browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Response!', {
          body: `${notification.admin_name} replied to: ${notification.ticket_title}`,
          icon: '📧'
        })
      }
    } catch (err) {
      console.error('Error adding notification:', err)
    }
  }

  // Mark notification as read
  const markAsRead = (notificationId) => {
    const updated = notifications.map(n => 
      n.response_id === notificationId ? { ...n, read: true } : n
    )
    setNotifications(updated)
    setUnreadCount(Math.max(0, unreadCount - 1))
    localStorage.setItem('ticketNotifications', JSON.stringify(updated))
  }

  // Delete notification and mark as read on backend
  const deleteNotification = (notificationId) => {
    const notification = notifications.find(n => n.response_id === notificationId)
    
    // Mark as read on backend
    if (notification && !notification.read) {
      try {
        fetch(`${API_BASE_URL}/tickets/${notification.ticket_id}/responses/mark-read/${notificationId}`, {
          method: 'POST'
        }).catch(err => console.error('Error marking response as read:', err))
      } catch (err) {
        console.error('Error:', err)
      }
    }
    
    const updated = notifications.filter(n => n.response_id !== notificationId)
    setNotifications(updated)
    if (notification && !notification.read) {
      setUnreadCount(Math.max(0, unreadCount - 1))
    }
    localStorage.setItem('ticketNotifications', JSON.stringify(updated))
  }

  // Clear all notifications and mark them as read on backend
  const clearAll = async () => {
    // Mark all unread notifications as read on backend
    const unreadNotifications = notifications.filter(n => !n.read)
    
    for (const notification of unreadNotifications) {
      try {
        await fetch(`${API_BASE_URL}/tickets/${notification.ticket_id}/responses/mark-read/${notification.response_id}`, {
          method: 'POST'
        })
      } catch (err) {
        console.error('Error marking response as read:', err)
      }
    }
    
    setNotifications([])
    setUnreadCount(0)
    localStorage.removeItem('ticketNotifications')
  }

  // Request notification permission
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  return (
    <div className="notification-center">
      {/* Notification Bell Icon */}
      <button 
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        title={unreadCount > 0 ? `${unreadCount} new notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
      >
        <span className="bell-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3>Notifications</h3>
            <button 
              className="panel-close"
              onClick={() => setIsOpen(false)}
              title="Close"
            >
              ✕
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="notification-empty">
              <p>No notifications yet</p>
              <button 
                className="enable-btn"
                onClick={requestNotificationPermission}
              >
                Enable Browser Notifications
              </button>
            </div>
          ) : (
            <>
              <div className="notifications-list">
                {notifications.map(notification => (
                  <div 
                    key={notification.response_id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => !notification.read && markAsRead(notification.response_id)}
                  >
                    <div className="notification-content">
                      <div className="notification-title">
                        <span className="notification-admin">{notification.admin_name}</span>
                        {!notification.read && <span className="notification-badge">New</span>}
                      </div>
                      <p className="notification-ticket">
                        <strong>Ticket:</strong> {notification.ticket_title}
                      </p>
                      <p className="notification-preview">{notification.response_text.substring(0, 80)}...</p>
                      <small className="notification-time">
                        {new Date(notification.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </small>
                    </div>
                    <button 
                      className="notification-delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.response_id)
                      }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {notifications.length > 0 && (
                <button 
                  className="clear-all-btn"
                  onClick={clearAll}
                >
                  Clear All
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
