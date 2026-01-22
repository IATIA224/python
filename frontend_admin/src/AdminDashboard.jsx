import { useState, useEffect } from 'react'
import './AdminDashboard.css'

const API_BASE_URL = 'http://localhost:8000'

export default function AdminDashboard() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [updating, setUpdating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyImageData, setReplyImageData] = useState(null)
  const [showHistory, setShowHistory] = useState(false) // Toggle history view

  // Fetch all tickets from backend
  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE_URL}/tickets`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: ${response.statusText}`)
      }
      
      const data = await response.json()
      setTickets(data)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  // Update ticket status
  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      setUpdating(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error(`Failed to update ticket: ${response.statusText}`)
      }

      const updatedTicket = await response.json()
      
      // Update local state
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId ? updatedTicket : ticket
        )
      )
      
      setSuccessMessage(`Ticket status updated to "${newStatus}"`)
      setTimeout(() => setSuccessMessage(''), 3000)
      
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(updatedTicket)
      }
    } catch (err) {
      setError(err.message)
      console.error('Error updating ticket:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Delete ticket
  const handleDeleteTicket = async (ticketId) => {
    try {
      setUpdating(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete ticket: ${response.statusText}`)
      }

      // Update local state
      setTickets(prev => prev.filter(ticket => ticket.id !== ticketId))
      
      setSuccessMessage('Ticket deleted successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      
      setDeleteConfirm(null)
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null)
      }
    } catch (err) {
      setError(err.message)
      console.error('Error deleting ticket:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Submit reply/note (simulated - extend backend for actual implementation)
  const handleSubmitReply = async (ticketId) => {
    if (!replyText.trim()) return

    try {
      setUpdating(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_name: 'Admin',
          response_text: replyText,
          response_image_data: replyImageData
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to submit reply: ${response.statusText}`)
      }

      const updatedTicket = await response.json()
      
      // Update local state
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId ? updatedTicket : ticket
        )
      )
      
      setSelectedTicket(updatedTicket)
      setSuccessMessage('Reply submitted successfully')
      setReplyText('')
      setReplyImageData(null)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err.message)
      console.error('Error submitting reply:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Handle reply image upload
  const handleReplyImageUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setReplyImageData(e.target.result)
      setError(null)
    }
    reader.onerror = () => {
      setError('Error reading file')
    }
    reader.readAsDataURL(file)
  }

  // Format date for display
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return '#ef4444'
      case 'in_progress':
        return '#f59e0b'
      case 'resolved':
        return '#10b981'
      case 'closed':
        return '#6b7280'
      default:
        return '#6b7280'
    }
  }

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return '#6b7280'
      case 'medium':
        return '#f59e0b'
      case 'high':
        return '#ef4444'
      case 'urgent':
        return '#dc2626'
      default:
        return '#6b7280'
    }
  }

  // Get category display name
  const getCategoryName = (category) => {
    const categories = {
      furniture: 'Furniture',
      it_equipment: 'IT Equipment',
      facility: 'Facility',
      utilities: 'Utilities',
      safety: 'Safety',
      other: 'Other'
    }
    return categories[category] || category
  }

  // Filter tickets based on status, priority, and search
  const filteredTickets = tickets.filter(ticket => {
    // Show resolved and closed tickets in history, exclude them from main view
    const isHistoryTicket = ticket.status === 'closed' || ticket.status === 'resolved'
    const isOpenTicket = ticket.status !== 'closed' && ticket.status !== 'resolved'
    
    // If showing history, show all resolved/closed regardless of filterStatus
    // If not showing history, apply status filter normally
    const matchesStatus = showHistory ? isHistoryTicket : (isOpenTicket && (filterStatus === 'all' || ticket.status === filterStatus))
    const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority
    const matchesSearch = searchQuery === '' || 
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.reporter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesPriority && matchesSearch
  })

  // Get status statistics
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div className="header-content">
          <div className="header-brand">
            <img src="/logo.png" alt="Pacific Support" className="header-logo" />
            <div className="header-text">
              <h1>Pacific Support - Admin</h1>
              <p>Manage all support tickets and reports</p>
            </div>
          </div>
        </div>
      </header>

      {/* Statistics Cards */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.total}</h3>
              <p>Total Tickets</p>
            </div>
          </div>
          <div className="stat-card open">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.open}</h3>
              <p>Open</p>
            </div>
          </div>
          <div className="stat-card in-progress">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.inProgress}</h3>
              <p>In Progress</p>
            </div>
          </div>
          <div className="stat-card resolved">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.resolved}</h3>
              <p>Resolved</p>
            </div>
          </div>
          <div className="stat-card closed">
            <div className="stat-icon">●</div>
            <div className="stat-content">
              <h3>{stats.closed}</h3>
              <p>Closed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">!</span>
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="alert alert-success">
          <span className="alert-icon">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filters and Search */}
      <section className="filters-section">
        <div className="filters-header">
          <button 
            className={`history-tab-btn ${!showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(false)}
          >
            Open Tickets ({tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length})
          </button>
          <button 
            className={`history-tab-btn ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(true)}
          >
            Closed/History ({tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length})
          </button>
        </div>
        
        <div className="filters-container">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search tickets by title, reporter, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Priority:</label>
            <select 
              value={filterPriority} 
              onChange={(e) => setFilterPriority(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <button onClick={fetchTickets} className="refresh-btn" disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </section>

      {/* Tickets Table */}
      <main className="tickets-section">
        <div className="section-header">
          <h2>Reports Management</h2>
          <span className="results-count">{filteredTickets.length} tickets</span>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No tickets found</h3>
            <p>Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="tickets-table-container">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Reporter</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="ticket-row">
                    <td className="ticket-id">#{ticket.id.slice(-6)}</td>
                    <td className="ticket-title">
                      <strong>{ticket.title}</strong>
                    </td>
                    <td className="ticket-reporter">
                      <div>{ticket.reporter_name}</div>
                      <small>{ticket.reporter_email}</small>
                    </td>
                    <td>
                      <span className="category-badge">
                        {getCategoryName(ticket.category)}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(ticket.status) }}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="ticket-date">
                      {formatDate(ticket.created_at)}
                    </td>
                    <td className="ticket-actions">
                      <button 
                        onClick={() => setSelectedTicket(ticket)}
                        className="action-btn view-btn"
                        title="View Details"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(ticket.id)}
                        className="action-btn delete-btn"
                        title="Delete Ticket"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ticket Details</h2>
              <button onClick={() => setSelectedTicket(null)} className="close-btn" title="Close">
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-row">
                  <label>Ticket ID:</label>
                  <span>#{selectedTicket.id}</span>
                </div>
                <div className="detail-row">
                  <label>Title:</label>
                  <span><strong>{selectedTicket.title}</strong></span>
                </div>
                <div className="detail-row">
                  <label>Reporter:</label>
                  <span>{selectedTicket.reporter_name} ({selectedTicket.reporter_email})</span>
                </div>
                <div className="detail-row">
                  <label>Department:</label>
                  <span>{selectedTicket.reporter_department}</span>
                </div>
                <div className="detail-row">
                  <label>Location:</label>
                  <span>{selectedTicket.location}</span>
                </div>
                <div className="detail-row">
                  <label>Category:</label>
                  <span className="category-badge">{getCategoryName(selectedTicket.category)}</span>
                </div>
                <div className="detail-row">
                  <label>Priority:</label>
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(selectedTicket.priority) }}
                  >
                    {selectedTicket.priority}
                  </span>
                </div>
                <div className="detail-row">
                  <label>Status:</label>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(selectedTicket.status) }}
                  >
                    {selectedTicket.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="detail-row">
                  <label>Created:</label>
                  <span>{formatDate(selectedTicket.created_at)}</span>
                </div>
                <div className="detail-row">
                  <label>Updated:</label>
                  <span>{formatDate(selectedTicket.updated_at)}</span>
                </div>
              </div>

              <div className="detail-section">
                <label>Description:</label>
                <p className="description-text">{selectedTicket.description}</p>
              </div>

              {selectedTicket.image_data && (
                <div className="detail-section">
                  <label>Attachment:</label>
                  <img 
                    src={selectedTicket.image_data} 
                    alt="Ticket attachment" 
                    className="ticket-image"
                  />
                </div>
              )}

              <div className="detail-section">
                <label>Update Status:</label>
                <div className="status-actions">
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'open')}
                    disabled={updating || selectedTicket.status === 'open'}
                    className="status-action-btn open-btn"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'in_progress')}
                    disabled={updating || selectedTicket.status === 'in_progress'}
                    className="status-action-btn progress-btn"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')}
                    disabled={updating || selectedTicket.status === 'resolved'}
                    className="status-action-btn resolved-btn"
                  >
                    Resolved
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}
                    disabled={updating || selectedTicket.status === 'closed'}
                    className="status-action-btn closed-btn"
                  >
                    Closed
                  </button>
                </div>
              </div>

              <div className="detail-section">
                <label>Add Reply/Note:</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Enter your reply or internal note..."
                  className="reply-textarea"
                  rows="4"
                />
                
                <div className="reply-image-section">
                  <label htmlFor="reply-image">Attach Image (optional):</label>
                  <input
                    type="file"
                    id="reply-image"
                    accept="image/*"
                    onChange={handleReplyImageUpload}
                    className="image-input"
                  />
                  {replyImageData && (
                    <div className="reply-image-preview">
                      <img src={replyImageData} alt="Reply attachment preview" className="reply-preview-img" />
                      <button
                        onClick={() => setReplyImageData(null)}
                        className="remove-image-btn"
                        type="button"
                      >
                        Remove Image
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => handleSubmitReply(selectedTicket.id)}
                  disabled={updating || !replyText.trim()}
                  className="submit-reply-btn"
                >
                  Submit Reply
                </button>
              </div>

              {selectedTicket.admin_responses && selectedTicket.admin_responses.length > 0 && (
                <div className="detail-section">
                  <label>Responses History:</label>
                  <div className="responses-list">
                    {selectedTicket.admin_responses.map((resp) => (
                      <div key={resp.response_id} className="response-item">
                        <div className="response-header">
                          <strong>{resp.admin_name}</strong>
                          <span className="response-date">{formatDate(resp.created_at)}</span>
                        </div>
                        <p className="response-text">{resp.response_text}</p>
                        {resp.response_image_data && (
                          <div className="response-image-container">
                            <img src={resp.response_image_data} alt="Response attachment" className="response-image" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button onClick={() => setDeleteConfirm(null)} className="close-btn" title="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this ticket? This action cannot be undone.</p>
              <div className="delete-actions">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTicket(deleteConfirm)}
                  disabled={updating}
                  className="confirm-delete-btn"
                >
                  {updating ? 'Deleting...' : 'Delete Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
