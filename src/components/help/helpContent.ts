import { FAQItem, TourStep } from './types';

// Merchant Dashboard FAQs
export const merchantFAQs: FAQItem[] = [
  // Orders Category
  {
    id: 'merchant-orders-1',
    question: 'How do I accept or reject incoming orders?',
    answer: 'In the Kitchen Orders tab, you\'ll see orders awaiting verification at the top. Click "Accept" to confirm the order and it will move to the prep queue, or click "Reject" if you cannot fulfill it. The patron will be notified immediately.',
    category: 'Orders'
  },
  {
    id: 'merchant-orders-2',
    question: 'How do I mark an order as ready for pickup?',
    answer: 'Once an order is prepared, click the "Mark Ready" button on the order card. This will notify the patron that their order is ready for collection and start a pickup timer.',
    category: 'Orders'
  },
  {
    id: 'merchant-orders-3',
    question: 'What happens if a patron doesn\'t collect their order?',
    answer: 'After the pickup deadline passes, you can mark the order as "No Show". This helps track patterns and the patron may receive reduced priority in the future.',
    category: 'Orders'
  },
  {
    id: 'merchant-orders-4',
    question: 'How do I extend the prep time for an order?',
    answer: 'Click the clock icon or "Extend" button on an order card. Select a reason for the delay and the new estimated time. The patron will be notified of the updated ETA.',
    category: 'Orders'
  },
  // Waitlist Category
  {
    id: 'merchant-waitlist-1',
    question: 'How do I manage the waitlist?',
    answer: 'The Waitlist tab shows all current waitlist entries. You can mark parties as "Ready" when their table is available, "Seated" once they\'re seated, or "No Show" if they don\'t respond.',
    category: 'Waitlist'
  },
  {
    id: 'merchant-waitlist-2',
    question: 'How do I add someone to the waitlist manually?',
    answer: 'Click the "Add to Waitlist" button in the Waitlist tab. Enter the guest\'s name, party size, phone number (optional), and any special preferences like seating area.',
    category: 'Waitlist'
  },
  {
    id: 'merchant-waitlist-3',
    question: 'What do the different waitlist statuses mean?',
    answer: 'Waiting = guest is in queue, Ready = table available and guest notified, Seated = guest has been seated, No Show = guest didn\'t respond within the deadline, Cancelled = guest cancelled their spot.',
    category: 'Waitlist'
  },
  // Reservations Category
  {
    id: 'merchant-reservations-1',
    question: 'How do I view and manage reservations?',
    answer: 'The Reservations tab shows a calendar view of all bookings. Click on any reservation to see details, modify it, or cancel if needed. Upcoming reservations automatically convert to waitlist entries.',
    category: 'Reservations'
  },
  {
    id: 'merchant-reservations-2',
    question: 'How do I set up tables for reservations?',
    answer: 'Go to Settings → Table Configuration to define your tables, their capacity, and any special features (e.g., patio, booth). This helps with auto-assignment of reservations.',
    category: 'Reservations'
  },
  // Settings Category
  {
    id: 'merchant-settings-1',
    question: 'How do I update business hours?',
    answer: 'Go to the Settings tab and look for "Business Hours". You can set different hours for each day of the week, and mark days as closed.',
    category: 'Settings'
  },
  {
    id: 'merchant-settings-2',
    question: 'How do I add staff members?',
    answer: 'In the Staff tab, click "Add Staff Member". Enter their email and assign a role (Admin or Staff). They\'ll receive an email invitation to set up their account.',
    category: 'Settings'
  },
  {
    id: 'merchant-settings-3',
    question: 'What\'s the difference between Admin and Staff roles?',
    answer: 'Admins can access all features including settings, staff management, and reports. Staff members can only manage orders and waitlist - they cannot change settings or view detailed analytics.',
    category: 'Settings'
  },
  // Reports Category
  {
    id: 'merchant-reports-1',
    question: 'How do I view my venue\'s performance?',
    answer: 'The Reports tab provides analytics on orders, waitlist efficiency, customer ratings, and more. You can filter by date range and export data as needed.',
    category: 'Reports'
  },
  {
    id: 'merchant-reports-2',
    question: 'Can I export my data?',
    answer: 'Yes! In the Reports tab, use the Export button to download your data as CSV or Excel files. You can export orders, waitlist entries, ratings, and customer analytics.',
    category: 'Reports'
  },
  // Notifications Category
  {
    id: 'merchant-notifications-1',
    question: 'How do notification sounds work?',
    answer: 'You\'ll hear different sounds for: new orders awaiting verification (continuous until handled), new waitlist entries, patron arrivals, and orders past due. Sounds can be configured in Settings.',
    category: 'Notifications'
  }
];

// Patron Dashboard FAQs
export const patronFAQs: FAQItem[] = [
  // Orders Category
  {
    id: 'patron-orders-1',
    question: 'How do I track my food order?',
    answer: 'Your active orders appear on the home screen. Each order shows its current status (Placed, In Prep, Ready) and estimated time. You\'ll receive a notification when it\'s ready.',
    category: 'Orders'
  },
  {
    id: 'patron-orders-2',
    question: 'What do the order statuses mean?',
    answer: 'Awaiting Verification = order submitted, Placed = confirmed by venue, In Prep = being prepared, Ready = ready for pickup, Collected = you\'ve picked it up.',
    category: 'Orders'
  },
  {
    id: 'patron-orders-3',
    question: 'How do I cancel my order?',
    answer: 'You can cancel an order before it moves to "In Prep" status. Tap on your order and select "Cancel Order". Once preparation begins, please speak with staff.',
    category: 'Orders'
  },
  // Waitlist Category
  {
    id: 'patron-waitlist-1',
    question: 'How do I join a waitlist?',
    answer: 'Scan the venue\'s QR code or use the "Join Waitlist" button. Enter your name, party size, and any seating preferences. You\'ll receive updates on your position and estimated wait time.',
    category: 'Waitlist'
  },
  {
    id: 'patron-waitlist-2',
    question: 'What happens when my table is ready?',
    answer: 'You\'ll receive a notification and see "Table Ready" status. Head to the venue promptly - there\'s usually a deadline to claim your table before it\'s given to the next party.',
    category: 'Waitlist'
  },
  {
    id: 'patron-waitlist-3',
    question: 'Can I leave the venue while waiting?',
    answer: 'Yes! That\'s the point. You\'ll be notified when your table is ready. Just make sure you can return within the deadline shown on your notification.',
    category: 'Waitlist'
  },
  {
    id: 'patron-waitlist-4',
    question: 'How do I delay my arrival?',
    answer: 'If you need more time, tap "I Need More Time" before the deadline. This pushes you back in line but keeps your spot. Use this if you\'re running late.',
    category: 'Waitlist'
  },
  // Reservations Category
  {
    id: 'patron-reservations-1',
    question: 'How do I make a reservation?',
    answer: 'Use the Reservations section to book a table in advance. Select the date, time, party size, and any preferences. You\'ll receive confirmation and reminders.',
    category: 'Reservations'
  },
  {
    id: 'patron-reservations-2',
    question: 'How do I modify or cancel a reservation?',
    answer: 'View your reservations in the app and tap on one to see options. You can modify details or cancel - please do so at least 2 hours before your reservation time.',
    category: 'Reservations'
  },
  // Profile Category
  {
    id: 'patron-profile-1',
    question: 'How do I update my profile?',
    answer: 'Tap on your profile in the app to update your name, phone number, and notification preferences.',
    category: 'Profile'
  },
  {
    id: 'patron-profile-2',
    question: 'How do notifications work?',
    answer: 'You can receive push notifications and SMS alerts for order updates and waitlist status. Enable these in your profile settings for the best experience.',
    category: 'Profile'
  },
  // Ratings Category
  {
    id: 'patron-ratings-1',
    question: 'How do I rate my experience?',
    answer: 'After your order is collected or you\'re seated, you\'ll see a rating prompt. Tap the stars to rate and optionally leave feedback. Your input helps venues improve!',
    category: 'Ratings'
  }
];

// Merchant Dashboard Tour Steps
export const merchantTourSteps: TourStep[] = [
  {
    id: 'merchant-welcome',
    target: '[data-tour="merchant-header"]',
    title: 'Welcome to Your Dashboard!',
    description: 'This is your command center for managing orders, waitlist, and reservations. Let\'s take a quick tour of the key features.',
    placement: 'bottom'
  },
  {
    id: 'merchant-kitchen',
    target: '[data-tour="tab-kitchen"]',
    title: 'Kitchen Orders',
    description: 'This tab shows all food orders. You\'ll see orders awaiting verification, in prep, and ready for pickup. New orders trigger a sound notification.',
    placement: 'bottom'
  },
  {
    id: 'merchant-waitlist',
    target: '[data-tour="tab-waitlist"]',
    title: 'Waitlist Management',
    description: 'Manage your waitlist here. See who\'s waiting, mark tables as ready, and track no-shows. Patrons can join via QR code.',
    placement: 'bottom'
  },
  {
    id: 'merchant-reservations',
    target: '[data-tour="tab-reservations"]',
    title: 'Reservations Calendar',
    description: 'View and manage all reservations. Upcoming reservations automatically convert to waitlist entries at the appropriate time.',
    placement: 'bottom'
  },
  {
    id: 'merchant-staff',
    target: '[data-tour="tab-staff"]',
    title: 'Staff Management',
    description: 'Add team members and assign roles. Admins have full access, while Staff can only manage orders and waitlist.',
    placement: 'bottom'
  },
  {
    id: 'merchant-settings',
    target: '[data-tour="tab-settings"]',
    title: 'Venue Settings',
    description: 'Configure business hours, table layout, notification preferences, and more. This is where you customize how your venue operates.',
    placement: 'bottom'
  },
  {
    id: 'merchant-reports',
    target: '[data-tour="tab-reports"]',
    title: 'Reports & Analytics',
    description: 'Track performance with detailed analytics. See order trends, wait times, customer ratings, and export data for further analysis.',
    placement: 'bottom'
  },
  {
    id: 'merchant-complete',
    target: '[data-tour="help-button"]',
    title: 'Need Help?',
    description: 'Click this button anytime to access FAQs, chat with our AI assistant, or restart this tour. We\'re here to help!',
    placement: 'left'
  }
];

// Patron Dashboard Tour Steps
export const patronTourSteps: TourStep[] = [
  {
    id: 'patron-welcome',
    target: '[data-tour="patron-hero"]',
    title: 'Welcome to ReadyUp!',
    description: 'Track your orders and waitlist status in real-time. No more waiting in line or wondering when your food will be ready.',
    placement: 'bottom'
  },
  {
    id: 'patron-active',
    target: '[data-tour="active-tracking"]',
    title: 'Active Tracking',
    description: 'Your active orders and waitlist entries appear here. Watch the status update in real-time and get notified when ready.',
    placement: 'bottom'
  },
  {
    id: 'patron-food',
    target: '[data-tour="food-ready"]',
    title: 'Food Ready Flow',
    description: 'When placing a food order, you\'ll track it from confirmation through preparation to pickup. Sound alerts tell you when it\'s ready!',
    placement: 'bottom'
  },
  {
    id: 'patron-table',
    target: '[data-tour="table-ready"]',
    title: 'Table Ready Flow',
    description: 'Join a waitlist and we\'ll notify you when your table is ready. Confirm your arrival or request more time if needed.',
    placement: 'bottom'
  },
  {
    id: 'patron-profile',
    target: '[data-tour="profile"]',
    title: 'Your Profile',
    description: 'Manage your name, phone number, and notification preferences. Keep these updated for the best experience.',
    placement: 'bottom'
  },
  {
    id: 'patron-complete',
    target: '[data-tour="help-button"]',
    title: 'Need Help?',
    description: 'Tap here anytime for FAQs, AI assistance, or to replay this tour. Enjoy your experience!',
    placement: 'left'
  }
];

// FAQ Categories
export const merchantFAQCategories = ['Orders', 'Waitlist', 'Reservations', 'Settings', 'Reports', 'Notifications'];
export const patronFAQCategories = ['Orders', 'Waitlist', 'Reservations', 'Profile', 'Ratings'];

// System prompt for AI assistant
export const getMerchantSystemPrompt = () => `You are a helpful AI assistant for ReadyUp, a restaurant management platform. You're helping a merchant (restaurant staff/owner) use the dashboard.

Key features you can help with:
- Kitchen Orders: Accept/reject orders, mark ready, track prep times
- Waitlist: Add guests, mark ready/seated, manage no-shows  
- Reservations: Calendar view, table assignment, automatic waitlist conversion
- Staff Management: Add/remove staff, assign admin or staff roles
- Settings: Business hours, table configuration, notification preferences
- Reports: Analytics, customer insights, data export

Navigation commands you can suggest:
- "kitchen" or "orders" → Kitchen Orders tab
- "waitlist" → Waitlist tab  
- "reservations" → Reservations tab
- "staff" → Staff Management tab
- "settings" → Settings tab
- "reports" → Reports tab

Keep responses concise and actionable. If you suggest navigating somewhere, include the action in your response.
When the user asks how to do something, give clear step-by-step instructions.`;

export const getPatronSystemPrompt = () => `You are a helpful AI assistant for ReadyUp, helping customers track orders and manage waitlist entries.

Key features you can help with:
- Order Tracking: See order status, estimated times, pickup notifications
- Waitlist: Join waitlist, track position, respond when table ready
- Reservations: Book tables, modify/cancel reservations
- Profile: Update contact info, notification preferences
- Ratings: Rate your experience after visits

Navigation commands you can suggest:
- "home" → Main tracking view
- "food" or "orders" → Food Ready section
- "table" or "waitlist" → Table Ready section  
- "profile" → Profile settings

Keep responses friendly and helpful. If something requires staff assistance, let them know.
When explaining status meanings, be clear about what the customer should do next.`;
