import { useState, useEffect } from 'react'
import './Dashboard.css'

const API_BASE_URL = 'http://localhost:8000'

export default function Dashboard() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [submittedTicket, setSubmittedTicket] = useState(null)
  const [viewMode, setViewMode] = useState('submit') // 'submit', 'view', 'search'
  const [searchToken, setSearchToken] = useState('')
  const [searchedTicket, setSearchedTicket] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [formData, setFormData] = useState({
    reporter_name: '',
    reporter_email: '',
    reporter_department: '',
    title: '',
    description: '',
    category: 'furniture',
    priority: 'medium',
    location: '',
    status: 'open'
  })
  const [submitting, setSubmitting] = useState(false)

  // Fetch tickets on component mount
  useEffect(() => {
    fetchTickets()
  }, [])

  // Fetch all tickets from backend
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

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Search ticket by token
  const handleSearchTicket = async (e) => {
    e.preventDefault()
    
    if (!searchToken.trim()) {
      setError('Please enter a ticket token')
      return
    }

    try {
      setSearchLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE_URL}/tickets/token/${searchToken}`)
      
      if (!response.ok) {
        throw new Error('Ticket not found with this token')
      }
      
      const data = await response.json()
      setSearchedTicket(data)
    } catch (err) {
      setError(err.message)
      setSearchedTicket(null)
    } finally {
      setSearchLoading(false)
    }
  }

  // Handle form submission to create a new ticket
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.reporter_name.trim() || !formData.reporter_email.trim() || 
        !formData.title.trim() || !formData.description.trim() || !formData.location.trim()) {
      setError('All fields are required')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccessMessage('')
      
      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error(`Failed to create ticket: ${response.statusText}`)
      }

      // Reset form and fetch updated tickets
      setFormData({
        reporter_name: '',
        reporter_email: '',
        reporter_department: '',
        title: '',
        description: '',
        category: 'furniture',
        priority: 'medium',
        location: '',
        status: 'open'
      })
      setSubmittedTicket(response)
      setSuccessMessage('Issue submitted successfully!')
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (err) {
      setError(err.message)
      console.error('Error creating ticket:', err)
    } finally {
      setSubmitting(false)
    }
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
        return '#dc3545'
      case 'in_progress':
        return '#ffc107'
      case 'resolved':
        return '#17a2b8'
      case 'closed':
        return '#28a745'
      default:
        return '#6c757d'
    }
  }

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return '#6c757d'
      case 'medium':
        return '#ffc107'
      case 'high':
        return '#fd7e14'
      case 'urgent':
        return '#dc3545'
      default:
        return '#6c757d'
    }
  }

  // Get category label
  const getCategoryLabel = (category) => {
    const labels = {
      furniture: '🪑 Furniture',
      it_equipment: '💻 IT Equipment',
      facility: '🏢 Facility',
      utilities: '⚡ Utilities',
      safety: '🚨 Safety',
      other: '📋 Other'
    }
    return labels[category] || category
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>� Employee Issue Submission Portal</h1>
        <p>Report workplace issues and track their resolution</p>
      </header>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <strong>Success:</strong> {successMessage}
        </div>
      )}

      {/* Success Modal with Token */}
      {submittedTicket && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>✅ Issue Submitted Successfully!</h2>
              <button className="modal-close" onClick={() => setSubmittedTicket(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Your issue has been submitted. Save this token to view your report anytime:</p>
              <div className="token-box">
                <input 
                  type="text" 
                  value={submittedTicket?.access_token || ''} 
                  readOnly 
                  className="token-input"
                />
                <button 
                  className="btn btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(submittedTicket.access_token)
                    alert('Token copied to clipboard!')
                  }}
                >
                  📋 Copy Token
                </button>
              </div>
              <p className="token-note">🔒 Share this token with support staff or use it to check your report status</p>
              <div className="ticket-preview">
                <h3>{submittedTicket?.title}</h3>
                <p><strong>Reference ID:</strong> {submittedTicket?.id?.substring(0, 8).toUpperCase()}</p>
                <p><strong>Status:</strong> {submittedTicket?.status}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setSubmittedTicket(null)
                  setViewMode('search')
                  setSearchToken(submittedTicket?.access_token || '')
                }}
              >
                View My Report
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setSubmittedTicket(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="mode-tabs">
        <button 
          className={`tab-btn ${viewMode === 'submit' ? 'active' : ''}`}
          onClick={() => setViewMode('submit')}
        >
          📝 Submit Issue
        </button>
        <button 
          className={`tab-btn ${viewMode === 'search' ? 'active' : ''}`}
          onClick={() => setViewMode('search')}
        >
          🔍 View My Report
        </button>
      </div>

      {/* Submit Mode */}
      {viewMode === 'submit' && (
        <div className="dashboard-content">
        {/* Issue Submission Form */}
        <section className="create-ticket-section">
          <h2>📝 Submit New Issue</h2>
          <form onSubmit={handleSubmit} className="ticket-form">
            
            {/* Reporter Information */}
            <fieldset className="form-fieldset">
              <legend>Reporter Information</legend>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reporter_name">Full Name *</label>
                  <input
                    type="text"
                    id="reporter_name"
                    name="reporter_name"
                    value={formData.reporter_name}
                    onChange={handleInputChange}
                    placeholder="Your full name"
                    disabled={submitting}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reporter_email">Email *</label>
                  <input
                    type="email"
                    id="reporter_email"
                    name="reporter_email"
                    value={formData.reporter_email}
                    onChange={handleInputChange}
                    placeholder="your.email@company.com"
                    disabled={submitting}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="reporter_department">Department *</label>
                <input
                  type="text"
                  id="reporter_department"
                  name="reporter_department"
                  value={formData.reporter_department}
                  onChange={handleInputChange}
                  placeholder="e.g., Sales, Marketing, IT"
                  disabled={submitting}
                  required
                />
              </div>
            </fieldset>

            {/* Issue Details */}
            <fieldset className="form-fieldset">
              <legend>Issue Details</legend>
              <div className="form-group">
                <label htmlFor="title">Issue Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Broken chair in office 202"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Detailed Description *</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Provide detailed information about the issue..."
                  rows="4"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    disabled={submitting}
                    required
                  >
                    <option value="furniture">🪑 Furniture</option>
                    <option value="it_equipment">💻 IT Equipment</option>
                    <option value="facility">🏢 Facility</option>
                    <option value="utilities">⚡ Utilities</option>
                    <option value="safety">🚨 Safety</option>
                    <option value="other">📋 Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="priority">Priority *</label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    disabled={submitting}
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="location">Location/Office *</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g., Building A, Floor 2, Office 202"
                  disabled={submitting}
                  required
                />
              </div>
            </fieldset>

            <button 
              type="submit" 
              className="btn btn-primary btn-large"
              disabled={submitting}
            >
              {submitting ? '⏳ Submitting...' : '✓ Submit Issue'}
            </button>
          </form>
        </section>

        {/* Tickets List */}
        <section className="tickets-section">
          <div className="section-header">
            <h2>📋 My Issues ({tickets.length})</h2>
            <button 
              className="btn btn-secondary"
              onClick={fetchTickets}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="loading">
              <p>Loading issues...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">
              <p>No issues yet. Submit one to get started!</p>
            </div>
          ) : (
            <div className="tickets-list">
              {tickets.map(ticket => (
                <div key={ticket.id} className="ticket-card">
                  <div className="ticket-header">
                    <div className="ticket-title-section">
                      <h3>{ticket.title}</h3>
                      <div className="ticket-meta-tags">
                        <span className="category-badge">{getCategoryLabel(ticket.category)}</span>
                      </div>
                    </div>
                    <div className="ticket-badges">
                      <span 
                        className="badge priority-badge"
                        style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                      >
                        {ticket.priority}
                      </span>
                      <span 
                        className="badge status-badge"
                        style={{ backgroundColor: getStatusColor(ticket.status) }}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <p className="ticket-description">{ticket.description}</p>

                  <div className="ticket-details">
                    <div className="detail-item">
                      <strong>Reporter:</strong> {ticket.reporter_name} ({ticket.reporter_email})
                    </div>
                    <div className="detail-item">
                      <strong>Department:</strong> {ticket.reporter_department}
                    </div>
                    <div className="detail-item">
                      <strong>Location:</strong> {ticket.location}
                    </div>
                  </div>

                  <div className="ticket-footer">
                    <small className="ticket-meta">
                      ID: {ticket.id.substring(0, 8)}...
                    </small>
                    <small className="ticket-date">
                      Submitted: {formatDate(ticket.created_at)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      )}

      {/* Search Mode */}
      {viewMode === 'search' && (
        <div className="search-section">
          <div className="search-container">
            <h2>🔍 View Your Report</h2>
            <p>Enter the token you received when submitting your issue</p>
            
            <form onSubmit={handleSearchTicket} className="search-form">
              <div className="form-group">
                <label htmlFor="searchToken">Ticket Token</label>
                <input
                  type="text"
                  id="searchToken"
                  value={searchToken}
                  onChange={(e) => setSearchToken(e.target.value)}
                  placeholder="Paste your token here"
                  disabled={searchLoading}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={searchLoading}
              >
                {searchLoading ? '🔄 Searching...' : '🔍 Search'}
              </button>
            </form>

            {searchedTicket && (
              <div className="ticket-card ticket-card-full">
                <div className="ticket-header">
                  <div className="ticket-title-section">
                    <h3>{searchedTicket.title}</h3>
                    <div className="ticket-meta-tags">
                      <span className="category-badge">{getCategoryLabel(searchedTicket.category)}</span>
                    </div>
                  </div>
                  <div className="ticket-badges">
                    <span 
                      className="badge priority-badge"
                      style={{ backgroundColor: getPriorityColor(searchedTicket.priority) }}
                    >
                      {searchedTicket.priority}
                    </span>
                    <span 
                      className="badge status-badge"
                      style={{ backgroundColor: getStatusColor(searchedTicket.status) }}
                    >
                      {searchedTicket.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <p className="ticket-description">{searchedTicket.description}</p>

                <div className="ticket-details">
                  <div className="detail-item">
                    <strong>Reporter:</strong> {searchedTicket.reporter_name}
                  </div>
                  <div className="detail-item">
                    <strong>Email:</strong> {searchedTicket.reporter_email}
                  </div>
                  <div className="detail-item">
                    <strong>Department:</strong> {searchedTicket.reporter_department}
                  </div>
                  <div className="detail-item">
                    <strong>Location:</strong> {searchedTicket.location}
                  </div>
                  <div className="detail-item">
                    <strong>Reference ID:</strong> {searchedTicket.id.substring(0, 8).toUpperCase()}
                  </div>
                </div>

                <div className="ticket-footer">
                  <small className="ticket-date">
                    Submitted: {formatDate(searchedTicket.created_at)}
                  </small>
                  <small className="ticket-date">
                    Last Updated: {formatDate(searchedTicket.updated_at)}
                  </small>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
