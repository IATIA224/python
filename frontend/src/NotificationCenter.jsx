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
  }, [pollInterval])

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
      
      for (const ticket of tickets) {
        try {
          const response = await fetch(`${API_BASE_URL}/tickets/${ticket.id}`)
          if (response.ok) {
            const updatedTicket = await response.json()
            
            // Check if there are new admin responses
            if (updatedTicket.admin_responses && updatedTicket.admin_responses.length > 0) {
              const lastResponse = updatedTicket.admin_responses[updatedTicket.admin_responses.length - 1]
              
              // Check if this response is new (not already in our notifications)
              const isNewNotification = !notifications.find(
                n => n.response_id === lastResponse.response_id
              )
              
              if (isNewNotification) {
                addNotification({
                  response_id: lastResponse.response_id,
                  ticket_id: ticket.id,
                  ticket_title: ticket.title,
                  admin_name: lastResponse.admin_name,
                  response_text: lastResponse.response_text,
                  created_at: lastResponse.created_at,
                  read: false
                })
                
                // Call the callback to notify parent
                if (onNewResponse) {
                  onNewResponse(lastResponse.response_id)
                }
              }
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

  // Delete notification
  const deleteNotification = (notificationId) => {
    const updated = notifications.filter(n => n.response_id !== notificationId)
    setNotifications(updated)
    const notification = notifications.find(n => n.response_id === notificationId)
    if (notification && !notification.read) {
      setUnreadCount(Math.max(0, unreadCount - 1))
    }
    localStorage.setItem('ticketNotifications', JSON.stringify(updated))
  }

  // Clear all notifications
  const clearAll = () => {
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
