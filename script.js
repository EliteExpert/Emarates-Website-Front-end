// script.js - Complete Rewrite

// BACKEND CONFIGURATION - ADD THIS AT THE TOP
const BACKEND_URL = "https://emarates-website-production.up.railway.app";

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Emirates PTFS Website Loaded');
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
        
        try {
            const response = await fetch(`${BACKEND_URL}/generate_itinerary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',  // ADDED
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
    try {
        const response = await fetch(`${BACKEND_URL}/api/user`, {
            credentials: 'include'  // ADDED
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
                <button class="logout-btn" onclick="window.location.href='${BACKEND_URL}/auth/logout'">
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
    try {
        const response = await fetch(`${BACKEND_URL}/api/my-flights`, {
            credentials: 'include'  // ADDED
       
