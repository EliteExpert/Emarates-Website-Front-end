// script.js - Complete Rewrite

// BACKEND CONFIGURATION - ADD THIS AT THE TOP
const BACKEND_URL = "https://emarates-website-production.up.railway.app";

// JWT Token Management
function storeToken(token) {
    localStorage.setItem('jwt_token', token);
}

function getToken() {
    return localStorage.getItem('jwt_token');
}

function removeToken() {
    localStorage.removeItem('jwt_token');
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Emirates PTFS Website Loaded');
    
    // Check for token in URL after Discord redirect
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        storeToken(token);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('✅ JWT Token stored from URL');
    }
    
    initAll();
});

// Main initialization function
async function initAll() {
    console.log('🔄 Initializing all components...');
    initMobileOptimizations();
    initNavigation();
    initSmoothScrolling();
    initBookingForm();
    initFlightStatus();
    initDiscordLogin();
    initModal();
    updateCommunityStats();
    initPageFeatures();
    
    // Check authentication
    const userData = await checkAuth();
    updateUIForAuth(userData);
    
    // Set active navigation link
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// Navigation functionality
function initNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (!hamburger || !navMenu) return;
    
    // Toggle mobile menu
    hamburger.addEventListener('click', function() {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            if (hamburger && navMenu) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    });
    
    // Change navbar style on scroll
    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (header) {
            if (window.scrollY > 100) {
                header.style.background = 'rgba(26, 26, 26, 0.95)';
                header.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
            } else {
                header.style.background = 'rgba(26, 26, 26, 0.9)';
                header.style.boxShadow = 'none';
            }
        }
    });
}

// Smooth scrolling for anchor links
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerHeight = document.querySelector('header')?.offsetHeight || 70;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Booking form functionality
function initBookingForm() {
    const bookingForm = document.getElementById('booking-form');
    if (!bookingForm) return;
    
    // Set minimum date for departure to today
    const today = new Date().toISOString().split('T')[0];
    const departureInput = document.getElementById('departure');
    
    if (departureInput) {
        departureInput.min = today;
    }
    
    // Form submission
    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form values
        const from = document.getElementById('from')?.value || '';
        const to = document.getElementById('to')?.value || '';
        const departure = document.getElementById('departure')?.value || '';
        const passengers = document.getElementById('passengers')?.value || '1';
        const flightClass = document.getElementById('class')?.value || 'economy';
        const name = document.getElementById('passenger-name')?.value || '';
        
        const token = getToken();
        if (!token) {
            alert('Please log in to book flights');
            return;
        }
        
        try {
            const response = await fetch(`${BACKEND_URL}/generate_itinerary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: name,
                    departure: from,
                    destination: to,
                    class: flightClass,
                    departure_date: departure
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`Flight booked successfully! PNR: ${result.pnr}`);
                window.location.href = '/my-flights';
            } else {
                alert(`Booking failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Booking error:', error);
            alert('Booking failed. Please try again.');
        }
    });
}

// Flight status functionality
function initFlightStatus() {
    setInterval(updateFlightStatus, 30000);
    updateFlightStatus();
}

function updateFlightStatus() {
    const updateTimeElement = document.getElementById('update-time');
    if (updateTimeElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        updateTimeElement.textContent = timeString;
    }
}

// Discord login functionality
function initDiscordLogin() {
    const discordLoginBtn = document.getElementById('discord-login');
    if (!discordLoginBtn) return;
    
    discordLoginBtn.addEventListener('click', function() {
        window.location.href = `${BACKEND_URL}/auth/discord`;
    });
}

// Modal functionality
function initModal() {
    const modal = document.getElementById('login-modal');
    const closeBtn = document.querySelector('.close-modal');
    
    if (!modal || !closeBtn) return;
    
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
}

// Community statistics
function updateCommunityStats() {
    const memberCount = document.getElementById('member-count');
    const flightCount = document.getElementById('flight-count');
    const onlineCount = document.getElementById('online-count');
    const eventCount = document.getElementById('event-count');
    
    if (memberCount) {
        const baseMembers = 400;
        const baseFlights = 40;
        const baseOnline = 5;
        const baseEvents = 8;
        
        const randomMembers = baseMembers + Math.floor(Math.random() * 10);
        const randomFlights = baseFlights + Math.floor(Math.random() * 1);
        const randomOnline = baseOnline + Math.floor(Math.random() * 3) - 15;
        const randomEvents = baseEvents + Math.floor(Math.random() * 10) - 5;
        
        memberCount.textContent = `${randomMembers.toLocaleString()}+`;
        if (flightCount) flightCount.textContent = `${randomFlights.toLocaleString()}+`;
        if (onlineCount) onlineCount.textContent = `${Math.max(40, randomOnline).toLocaleString()}+`;
        if (eventCount) eventCount.textContent = `${Math.max(5, randomEvents).toLocaleString()}+`;
    }
    
    setTimeout(updateCommunityStats, 30000);
}

// Authentication functions
async function checkAuth() {
    const token = getToken();
    if (!token) {
        return { logged_in: false };
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/user`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const userData = await response.json();
        return userData;
    } catch (error) {
        console.error('Auth check failed:', error);
        return { logged_in: false };
    }
}

function updateUIForAuth(userData) {
    const discordLoginBtn = document.getElementById('discord-login');
    const userInfoContainer = document.getElementById('user-info-container');
    const userWelcome = document.getElementById('user-welcome');
    const myFlightsNavItem = document.querySelector('.nav-item a[href="my-flights.html"]')?.closest('.nav-item');
    
    if (userData.logged_in) {
        // Hide login button
        if (discordLoginBtn) {
            discordLoginBtn.style.display = 'none';
        }
        
        // Show user info
        if (userInfoContainer) {
            const avatarUrl = userData.user.avatar 
                ? `https://cdn.discordapp.com/avatars/${userData.user.id}/${userData.user.avatar}.png?size=64`
                : 'https://cdn.discordapp.com/embed/avatars/0.png';
            
            userInfoContainer.innerHTML = `
                <div class="user-info">
                    <img src="${avatarUrl}" alt="Avatar" class="user-avatar">
                    <span class="user-name">${userData.user.global_name || userData.user.username}</span>
                </div>
                <button class="logout-btn" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            `;
            userInfoContainer.style.display = 'flex';
        }
        
        // Show welcome message
        if (userWelcome) {
            userWelcome.innerHTML = `Welcome, ${userData.user.global_name || userData.user.username}!`;
            userWelcome.style.display = 'block';
        }
        
        // Show My Flights in navigation
        if (myFlightsNavItem) {
            myFlightsNavItem.style.display = 'list-item';
        }
    } else {
        // Show login button
        if (discordLoginBtn) {
            discordLoginBtn.style.display = 'flex';
        }
        
        // Hide user info
        if (userInfoContainer) {
            userInfoContainer.style.display = 'none';
        }
        
        // Hide welcome message
        if (userWelcome) {
            userWelcome.style.display = 'none';
        }
        
        // Hide My Flights in navigation
        if (myFlightsNavItem) {
            myFlightsNavItem.style.display = 'none';
        }
    }
}

// Logout function
function logout() {
    removeToken();
    window.location.href = '/';
}

// Initialize page-specific functionality
function initPageFeatures() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (currentPage === 'booking.html') {
        initBookingPage();
    } else if (currentPage === 'status.html') {
        initStatusPage();
    } else if (currentPage === 'join.html') {
        initJoinPage();
    } else if (currentPage === 'my-flights.html') {
        initializeMyFlightsDirect();
    }
}

// Booking page specific functionality
function initBookingPage() {
    const tripType = document.getElementById('trip-type');
    const returnField = document.getElementById('return-field');
    
    if (tripType && returnField) {
        tripType.addEventListener('change', function() {
            returnField.style.display = this.value === 'oneway' ? 'none' : 'block';
        });
    }
}

// Status page specific functionality
function initStatusPage() {
    const searchInput = document.getElementById('flight-search');
    const searchButton = document.querySelector('.status-search .btn');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', function() {
            const flightNumber = searchInput.value.trim().toUpperCase();
            if (flightNumber) {
                alert(`Searching for flight ${flightNumber}...`);
                searchInput.value = '';
            }
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchButton.click();
            }
        });
    }
}

// Join page specific functionality
function initJoinPage() {
    setInterval(updateDiscordActivity, 15000);
}

function updateDiscordActivity() {
    const members = document.querySelectorAll('.member .status');
    members.forEach(member => {
        if (Math.random() < 0.1) {
            const statuses = ['online', 'idle'];
            const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
            member.className = 'status';
            member.classList.add(newStatus);
        }
    });
}

// My Flights page functionality - DIRECT VERSION
function initializeMyFlightsDirect() {
    console.log('📍 Initializing My Flights page');
    
    checkAuth().then(userData => {
        if (userData.logged_in) {
            document.getElementById('login-prompt').style.display = 'none';
            document.getElementById('flights-content').style.display = 'block';
            document.getElementById('welcome-message').textContent = 
                `Welcome back, ${userData.user.global_name || userData.user.username}!`;
            loadUserFlights();
        } else {
            document.getElementById('login-prompt').style.display = 'block';
            document.getElementById('flights-content').style.display = 'none';
            const discordLoginPrompt = document.getElementById('discord-login-prompt');
            if (discordLoginPrompt) {
                discordLoginPrompt.addEventListener('click', function() {
                    window.location.href = `${BACKEND_URL}/auth/discord`;
                });
            }
        }
    }).catch(error => {
        console.error('Auth error:', error);
    });
}

// Load user flights - SIMPLE VERSION WITH CANCEL BUTTON
async function loadUserFlights() {
    const token = getToken();
    if (!token) {
        document.getElementById('flights-list').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Please log in to view your flights.</p>
            </div>
        `;
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/my-flights`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        const flightsList = document.getElementById('flights-list');
        const noFlights = document.getElementById('no-flights');
        
        if (data.success && data.flights && data.flights.length > 0) {
            let flightsHTML = '';
            
            data.flights.forEach((flight) => {
                flightsHTML += `
                <div class="flight-booking-card" data-pnr="${flight.pnr}">
                    <div class="flight-booking-header">
                        <div class="flight-route-large">
                            <span class="city">${flight.departure}</span>
                            <i class="fas fa-long-arrow-alt-right"></i>
                            <span class="city">${flight.destination}</span>
                        </div>
                        <div class="booking-status ${flight.status.toLowerCase()}">${flight.status}</div>
                    </div>
                    
                    <div class="flight-booking-details">
                        <div class="detail-group">
                            <label>Flight Number</label>
                            <span>${flight.flight_number}</span>
                        </div>
                        <div class="detail-group">
                            <label>PNR</label>
                            <span class="pnr-code">${flight.pnr}</span>
                        </div>
                        <div class="detail-group">
                            <label>Class</label>
                            <span>${flight.class}</span>
                        </div>
                        <div class="detail-group">
                            <label>Departure</label>
                            <span>${flight.departure_time} • ${flight.departure_name}</span>
                        </div>
                        <div class="detail-group">
                            <label>Arrival</label>
                            <span>${flight.arrival_time} • ${flight.destination_name}</span>
                        </div>
                        <div class="detail-group">
                            <label>Booking Date</label>
                            <span>${new Date(flight.booking_date).toLocaleDateString()}</span>
                        </div>
                    </div>
                    
                    <div class="flight-booking-actions">
                        <a href="${BACKEND_URL}/serve_image/${flight.pnr}" target="_blank" class="btn outline">
                            <i class="fas fa-download"></i> Download Itinerary
                        </a>
                        <button class="btn danger cancel-flight-btn" data-pnr="${flight.pnr}" 
                                style="background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; margin-left: 10px;"
                                onclick="cancelFlight('${flight.pnr}')">
                            <i class="fas fa-times"></i> Cancel Flight
                        </button>
                    </div>
                </div>
                `;
            });
            
            flightsList.innerHTML = flightsHTML;
            noFlights.style.display = 'none';
            flightsList.style.display = 'block';
        } else {
            flightsList.style.display = 'none';
            noFlights.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading flights:', error);
        document.getElementById('flights-list').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading flights. Please try again.</p>
            </div>
        `;
    }
}

// CANCEL FLIGHT FUNCTION WITH CONFIRMATION AND BACKEND DELETION
async function cancelFlight(pnr) {
    // Show confirmation dialog
    const confirmed = confirm('Are you sure you want to cancel this flight? This action cannot be undone.');
    
    if (!confirmed) {
        console.log('Cancellation cancelled by user');
        return;
    }
    
    console.log('Cancelling flight:', pnr);
    
    const token = getToken();
    if (!token) {
        alert('Please log in to cancel flights');
        return;
    }
    
    try {
        // Call backend to delete the flight data
        const response = await fetch(`${BACKEND_URL}/api/cancel-flight`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ pnr: pnr })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Only remove from frontend if backend deletion was successful
            const flightCard = document.querySelector(`.flight-booking-card:has(button[onclick="cancelFlight('${pnr}')"])`);
            if (flightCard) {
                // Add smooth removal animation
                flightCard.style.transition = 'all 0.3s ease';
                flightCard.style.opacity = '0';
                flightCard.style.transform = 'translateX(-100%)';
                
                setTimeout(() => {
                    flightCard.remove();
                    console.log('Flight removed from page and backend');
                    
                    // Check if no flights left
                    const remainingFlights = document.querySelectorAll('.flight-booking-card');
                    if (remainingFlights.length === 0) {
                        document.getElementById('flights-list').style.display = 'none';
                        document.getElementById('no-flights').style.display = 'block';
                    }
                }, 300);
            }
        } else {
            alert('Failed to cancel flight: ' + result.error);
        }
    } catch (error) {
        console.error('Cancel flight error:', error);
        alert('Failed to cancel flight. Please try again.');
    }
}

// Global function to reinitialize components
function reinitComponents() {
    initNavigation();
    initDiscordLogin();
    initModal();
    
    // Re-check auth and update UI
    checkAuth().then(userData => {
        updateUIForAuth(userData);
    });
    
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// Video background fallback
window.addEventListener('load', function() {
    const video = document.getElementById('bg-video');
    if (!video) return;
    
    setTimeout(function() {
        if (video.readyState === 0) {
            const homeSection = document.querySelector('.home-section');
            if (homeSection) {
                homeSection.style.backgroundImage = 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url("https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80")';
                homeSection.style.backgroundSize = 'cover';
                homeSection.style.backgroundPosition = 'center';
                document.querySelector('.video-background').style.display = 'none';
            }
        }
    }, 3000);
});

// Mobile-specific optimizations
function initMobileOptimizations() {
  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
  // Better touch handling
  if ('ontouchstart' in window) {
    document.documentElement.classList.add('touch-device');
  }
  
  // Load video only on desktop
  if (window.innerWidth > 768) {
    const video = document.getElementById('bg-video');
    if (video) {
      video.preload = 'auto';
    }
  }
}

// Make functions globally available for HTML onclick events
window.cancelFlight = cancelFlight;
window.reinitComponents = reinitComponents;
window.logout = logout;

// Force center header
document.addEventListener('DOMContentLoaded', function() {
    const userContainer = document.querySelector('.user-info-container');
    if (userContainer && userContainer.innerHTML.trim() === '') {
        userContainer.remove(); // Completely remove empty container
    }
});
