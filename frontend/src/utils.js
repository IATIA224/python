/**
 * Performance optimization utilities for the Pacific Support Dashboard
 */

// Debounce function to prevent excessive API calls
export const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Request deduplication - prevents duplicate requests for the same resource
const requestCache = new Map()

export const getCachedRequest = (key, fetcher, cacheDuration = 5000) => {
  const now = Date.now()
  
  if (requestCache.has(key)) {
    const cached = requestCache.get(key)
    if (now - cached.timestamp < cacheDuration) {
      return cached.promise
    }
  }
  
  const promise = fetcher().finally(() => {
    // Clear cache after duration
    setTimeout(() => {
      if (requestCache.has(key)) {
        requestCache.delete(key)
      }
    }, cacheDuration)
  })
  
  requestCache.set(key, { promise, timestamp: now })
  return promise
}

// Throttle function for scroll and resize events
export const throttle = (func, limit) => {
  let inThrottle
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Batch multiple updates into a single state update
export const batchUpdates = (updates) => {
  return Promise.all(updates).then(results => {
    return results
  })
}

// Optimize list rendering with memoization
export const memoizeCallback = (callback, dependencies) => {
  const cache = new WeakMap()
  
  return (...args) => {
    const key = args[0]
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = callback(...args)
    cache.set(key, result)
    return result
  }
}

// Local storage with expiration
export const setStorageWithExpiry = (key, value, expiryMs) => {
  const now = new Date()
  const item = {
    value: value,
    expiry: now.getTime() + expiryMs
  }
  localStorage.setItem(key, JSON.stringify(item))
}

export const getStorageWithExpiry = (key) => {
  const itemStr = localStorage.getItem(key)
  if (!itemStr) {
    return null
  }
  
  const item = JSON.parse(itemStr)
  const now = new Date()
  
  if (now.getTime() > item.expiry) {
    localStorage.removeItem(key)
    return null
  }
  
  return item.value
}

// Performance monitoring
export const measurePerformance = (label, fn) => {
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  console.log(`[${label}] took ${(end - start).toFixed(2)}ms`)
  return result
}

// Async performance monitoring
export const measureAsyncPerformance = async (label, asyncFn) => {
  const start = performance.now()
  const result = await asyncFn()
  const end = performance.now()
  console.log(`[${label}] took ${(end - start).toFixed(2)}ms`)
  return result
}
