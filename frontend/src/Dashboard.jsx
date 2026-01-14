import { useState, useEffect } from 'react'
import './Dashboard.css'

const API_BASE_URL = 'http://localhost:8000'

export default function Dashboard() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
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

  // Handle form submission to create a new ticket
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Title and description are required')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      
      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          status: formData.status
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create ticket: ${response.statusText}`)
      }

      // Reset form and fetch updated tickets
      setFormData({ title: '', description: '', status: 'open' })
      await fetchTickets()
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
      case 'closed':
        return '#28a745'
      default:
        return '#6c757d'
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🎫 PacificSupport Dashboard</h1>
        <p>Manage your support tickets</p>
      </header>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="dashboard-content">
        {/* Create Ticket Form */}
        <section className="create-ticket-section">
          <h2>Create New Ticket</h2>
          <form onSubmit={handleSubmit} className="ticket-form">
            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter ticket title"
                disabled={submitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter ticket description"
                rows="4"
                disabled={submitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                disabled={submitting}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </form>
        </section>

        {/* Tickets List */}
        <section className="tickets-section">
          <div className="section-header">
            <h2>Tickets ({tickets.length})</h2>
            <button 
              className="btn btn-secondary"
              onClick={fetchTickets}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="loading">
              <p>Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">
              <p>No tickets yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="tickets-list">
              {tickets.map(ticket => (
                <div key={ticket.id} className="ticket-card">
                  <div className="ticket-header">
                    <h3>{ticket.title}</h3>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(ticket.status) }}
                    >
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="ticket-description">{ticket.description}</p>
                  <div className="ticket-footer">
                    <small className="ticket-meta">
                      ID: {ticket.id.substring(0, 8)}...
                    </small>
                    <small className="ticket-date">
                      Created: {formatDate(ticket.created_at)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
